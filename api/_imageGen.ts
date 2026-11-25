import dotenv from 'dotenv';
import type { IncomingMessage as HttpIncomingMessage, ServerResponse } from 'http';
import { redactApiKeys, resolveImageGenConfig } from './_env.js';
import { readJsonBody, sendJson } from './_gemini.js';

if (!process.env.VERCEL) {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const ASPECT_DIMENSIONS: Record<ImageAspectRatio, { width: number; height: number }> = {
  '1:1': { width: 768, height: 768 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 896, height: 672 },
  '3:4': { width: 672, height: 896 },
};

const UPSTREAM_IMAGE_TIMEOUT_MS = 25000;

interface ImageGenResult {
  buffer: Buffer;
  mimeType: string;
}

class ImageProviderError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      retryable: boolean;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = 'ImageProviderError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

function parseRetrySeconds(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const num = Number(raw.trim());
  if (Number.isFinite(num) && num > 0) {
    return Math.ceil(num);
  }
  return undefined;
}

function normalizeImageMime(rawMime: string | null): string {
  const lower = (rawMime || '').split(';')[0].trim().toLowerCase();
  if (lower === 'image/png' || lower === 'image/jpeg' || lower === 'image/webp') {
    return lower;
  }
  if (lower === 'image/jpg') {
    return 'image/jpeg';
  }
  return 'image/png';
}

function combineSignals(parent: AbortSignal, timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('TIMEOUT')), timeoutMs);
  const onParentAbort = () => controller.abort(new Error('ABORTED'));
  parent.addEventListener('abort', onParentAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parent.removeEventListener('abort', onParentAbort);
    },
  };
}

async function generateViaHuggingFace(
  prompt: string,
  width: number,
  height: number,
  token: string,
  parentSignal: AbortSignal,
): Promise<ImageGenResult> {
  const endpoint =
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell';

  for (let attempt = 0; attempt < 2; attempt++) {
    const { signal, cleanup } = combineSignals(parentSignal, UPSTREAM_IMAGE_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width,
            height,
            num_inference_steps: 4,
          },
        }),
        signal,
      });

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.toLowerCase().startsWith('image/')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 512) {
          throw new ImageProviderError('Image provider returned an empty image.', {
            status: 502,
            code: 'EMPTY_IMAGE',
            retryable: true,
          });
        }
        return { buffer, mimeType: normalizeImageMime(contentType) };
      }

      const bodyText = await response.text().catch(() => '');
      let parsedError: { error?: string; estimated_time?: number } | null = null;
      try {
        parsedError = JSON.parse(bodyText) as { error?: string; estimated_time?: number };
      } catch {
        parsedError = null;
      }

      if (response.status === 503 && attempt === 0) {
        const waitMs = Math.min(3500, Math.max(1200, (parsedError?.estimated_time ?? 2) * 1000));
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new ImageProviderError(
          'Image API configuration error: Your Hugging Face token (HF_TOKEN) was rejected as invalid or lacks Inference Providers permission.',
          {
            status: 403,
            code: 'IMAGE_API_KEY_INVALID',
            retryable: false,
          },
        );
      }

      if (response.status === 402 || response.status === 429) {
        const retryAfterSeconds = parseRetrySeconds(response.headers.get('retry-after')) ?? 30;
        throw new ImageProviderError(
          'Hugging Face free monthly inference quota or rate limit was reached. Please try again later.',
          {
            status: 429,
            code: 'IMAGE_RATE_LIMITED',
            retryable: true,
            retryAfterSeconds,
          },
        );
      }

      throw new ImageProviderError(
        parsedError?.error
          ? `Image service error: ${redactApiKeys(parsedError.error).slice(0, 160)}`
          : 'Unable to generate image right now. Please try again.',
        {
          status: response.status >= 500 ? 502 : 400,
          code: 'IMAGE_UPSTREAM_ERROR',
          retryable: response.status >= 500,
        },
      );
    } catch (err) {
      if (err instanceof ImageProviderError) throw err;
      if (parentSignal.aborted) {
        throw new ImageProviderError('Generation cancelled.', {
          status: 499,
          code: 'ABORTED',
          retryable: false,
        });
      }
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'TIMEOUT')) {
        throw new ImageProviderError(
          'Image generation took too long. Please try again.',
          {
            status: 504,
            code: 'IMAGE_TIMEOUT',
            retryable: true,
          },
        );
      }
      throw new ImageProviderError('Unable to reach the image generation service.', {
        status: 502,
        code: 'IMAGE_UPSTREAM_ERROR',
        retryable: true,
      });
    } finally {
      cleanup();
    }
  }

  throw new ImageProviderError('The image model is warming up. Please try again in a moment.', {
    status: 503,
    code: 'IMAGE_MODEL_LOADING',
    retryable: true,
    retryAfterSeconds: 5,
  });
}

async function generateViaCloudflare(
  prompt: string,
  width: number,
  height: number,
  accountId: string,
  apiToken: string,
  parentSignal: AbortSignal,
): Promise<ImageGenResult> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
    accountId,
  )}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

  const { signal, cleanup } = combineSignals(parentSignal, UPSTREAM_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        steps: 4,
        width,
        height,
      }),
      signal,
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    if (response.ok && contentType.startsWith('image/')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 512) {
        throw new ImageProviderError('Image provider returned an empty image.', {
          status: 502,
          code: 'EMPTY_IMAGE',
          retryable: true,
        });
      }
      return { buffer, mimeType: normalizeImageMime(contentType) };
    }

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      result?: { image?: string };
      errors?: Array<{ code?: number; message?: string }>;
    } | null;

    if (response.ok && payload?.result?.image) {
      const buffer = Buffer.from(payload.result.image, 'base64');
      if (buffer.length >= 512) {
        return { buffer, mimeType: 'image/jpeg' };
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new ImageProviderError(
        'Image API configuration error: Your Cloudflare Workers AI credentials were rejected.',
        {
          status: 403,
          code: 'IMAGE_API_KEY_INVALID',
          retryable: false,
        },
      );
    }

    if (response.status === 429) {
      const retryAfterSeconds = parseRetrySeconds(response.headers.get('retry-after')) ?? 30;
      throw new ImageProviderError(
        'Cloudflare Workers AI daily free limit (10,000 Neurons) or rate limit reached. Please try again later.',
        {
          status: 429,
          code: 'IMAGE_RATE_LIMITED',
          retryable: true,
          retryAfterSeconds,
        },
      );
    }

    const detail = payload?.errors?.[0]?.message;
    throw new ImageProviderError(
      detail
        ? `Image service error: ${redactApiKeys(detail).slice(0, 160)}`
        : 'Unable to generate image right now. Please try again.',
      {
        status: response.status >= 500 ? 502 : 400,
        code: 'IMAGE_UPSTREAM_ERROR',
        retryable: response.status >= 500,
      },
    );
  } catch (err) {
    if (err instanceof ImageProviderError) throw err;
    if (parentSignal.aborted) {
      throw new ImageProviderError('Generation cancelled.', {
        status: 499,
        code: 'ABORTED',
        retryable: false,
      });
    }
    if (err instanceof Error && (err.name === 'AbortError' || err.message === 'TIMEOUT')) {
      throw new ImageProviderError('Image generation took too long. Please try again.', {
        status: 504,
        code: 'IMAGE_TIMEOUT',
        retryable: true,
      });
    }
    throw new ImageProviderError('Unable to reach Cloudflare Workers AI.', {
      status: 502,
      code: 'IMAGE_UPSTREAM_ERROR',
      retryable: true,
    });
  } finally {
    cleanup();
  }
}

async function generateViaPollinations(
  prompt: string,
  width: number,
  height: number,
  apiKey: string | undefined,
  parentSignal: AbortSignal,
): Promise<ImageGenResult> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const encodedPrompt = encodeURIComponent(prompt);
  const baseUrl = apiKey
    ? `https://gen.pollinations.ai/image/${encodedPrompt}`
    : `https://image.pollinations.ai/prompt/${encodedPrompt}`;
  const url = `${baseUrl}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

  const { signal, cleanup } = combineSignals(parentSignal, UPSTREAM_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal,
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    if (response.ok && contentType.startsWith('image/')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 512) {
        throw new ImageProviderError('Image provider returned an empty image.', {
          status: 502,
          code: 'EMPTY_IMAGE',
          retryable: true,
        });
      }
      return { buffer, mimeType: normalizeImageMime(contentType) };
    }

    const rawText = await response.text().catch(() => '');
    let errJson: { error?: { code?: string; message?: string } | string } | null = null;
    try {
      errJson = JSON.parse(rawText) as { error?: { code?: string; message?: string } | string };
    } catch {
      errJson = null;
    }

    if (response.status === 401 || response.status === 403) {
      throw new ImageProviderError(
        'Image API configuration error: Your Pollinations API key (POLLINATIONS_API_KEY) is invalid or expired.',
        {
          status: 403,
          code: 'IMAGE_API_KEY_INVALID',
          retryable: false,
        },
      );
    }

    if (response.status === 402 || response.status === 429) {
      const retryAfterSeconds = parseRetrySeconds(response.headers.get('retry-after')) ?? 45;
      const errMessage =
        typeof errJson?.error === 'object' ? errJson.error?.message : errJson?.error;
      const isPublicCooldown = !apiKey || (errMessage && /every\s+\d+\s+seconds/i.test(errMessage));
      throw new ImageProviderError(
        isPublicCooldown
          ? `Free public image limit reached (1 image every 45 seconds per IP). Wait ${retryAfterSeconds}s and retry, or configure HF_TOKEN or CLOUDFLARE_API_TOKEN for higher limits.`
          : 'Pollinations credit or rate limit reached. Please try again later.',
        {
          status: 429,
          code: 'IMAGE_RATE_LIMITED',
          retryable: true,
          retryAfterSeconds,
        },
      );
    }

    throw new ImageProviderError(
      'The image generator is temporarily busy. Please try again in a moment.',
      {
        status: response.status >= 500 ? 502 : 400,
        code: 'IMAGE_UPSTREAM_ERROR',
        retryable: true,
        retryAfterSeconds: 4,
      },
    );
  } catch (err) {
    if (err instanceof ImageProviderError) throw err;
    if (parentSignal.aborted) {
      throw new ImageProviderError('Generation cancelled.', {
        status: 499,
        code: 'ABORTED',
        retryable: false,
      });
    }
    if (err instanceof Error && (err.name === 'AbortError' || err.message === 'TIMEOUT')) {
      throw new ImageProviderError('Image generation took too long. Please try again.', {
        status: 504,
        code: 'IMAGE_TIMEOUT',
        retryable: true,
      });
    }
    throw new ImageProviderError('Unable to reach the image generation service.', {
      status: 502,
      code: 'IMAGE_UPSTREAM_ERROR',
      retryable: true,
    });
  } finally {
    cleanup();
  }
}

export async function handleGenerateImageRequest(
  req: HttpIncomingMessage & { body?: unknown },
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: 'Method not allowed.',
      code: 'METHOD_NOT_ALLOWED',
      retryable: false,
    });
    return;
  }

  let body: { prompt?: unknown; aspectRatio?: unknown };
  try {
    body = (await readJsonBody(req)) as { prompt?: unknown; aspectRatio?: unknown };
  } catch {
    sendJson(res, 400, {
      error: 'Invalid JSON request body.',
      code: 'INVALID_JSON',
      retryable: false,
    });
    return;
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 2) {
    sendJson(res, 400, {
      error: 'Please enter a descriptive prompt (at least 2 characters) to generate an image.',
      code: 'INVALID_PROMPT',
      retryable: false,
    });
    return;
  }

  if (prompt.length > 800) {
    sendJson(res, 400, {
      error: 'Prompt is too long. Please keep image prompts under 800 characters.',
      code: 'INVALID_PROMPT',
      retryable: false,
    });
    return;
  }

  const requestedRatio =
    typeof body?.aspectRatio === 'string' && body.aspectRatio in ASPECT_DIMENSIONS
      ? (body.aspectRatio as ImageAspectRatio)
      : '1:1';
  const { width, height } = ASPECT_DIMENSIONS[requestedRatio];

  const config = resolveImageGenConfig();
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  const startMs = Date.now();
  try {
    let result: ImageGenResult;

    if (config.providerId === 'huggingface' && config.hfToken) {
      result = await generateViaHuggingFace(
        prompt,
        width,
        height,
        config.hfToken,
        controller.signal,
      );
    } else if (
      config.providerId === 'cloudflare' &&
      config.cloudflareAccountId &&
      config.cloudflareApiToken
    ) {
      result = await generateViaCloudflare(
        prompt,
        width,
        height,
        config.cloudflareAccountId,
        config.cloudflareApiToken,
        controller.signal,
      );
    } else if (config.providerId === 'pollinations_key' && config.pollinationsApiKey) {
      result = await generateViaPollinations(
        prompt,
        width,
        height,
        config.pollinationsApiKey,
        controller.signal,
      );
    } else {
      result = await generateViaPollinations(
        prompt,
        width,
        height,
        undefined,
        controller.signal,
      );
    }

    const base64 = result.buffer.toString('base64');
    const dataUrl = `data:${result.mimeType};base64,${base64}`;

    res.setHeader('Server-Timing', `image-gen;desc="${config.providerId}";dur=${Date.now() - startMs}`);
    sendJson(res, 200, {
      ok: true,
      dataUrl,
      mimeType: result.mimeType,
      width,
      height,
      aspectRatio: requestedRatio,
      provider: config.providerLabel,
      providerId: config.providerId,
      usageLimitNote: config.freeTierNote,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    if (err instanceof ImageProviderError) {
      console.error('[api/generate-image error]', {
        providerId: config.providerId,
        code: err.code,
        status: err.status,
        detail: redactApiKeys(err.message).slice(0, 240),
      });
      if (err.status === 429 && err.retryAfterSeconds) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
      }
      sendJson(res, err.status, {
        error: err.message,
        code: err.code,
        retryable: err.retryable,
        retryAfterSeconds: err.retryAfterSeconds,
      });
      return;
    }

    console.error('[api/generate-image error]', {
      providerId: config.providerId,
      code: 'IMAGE_UNEXPECTED_ERROR',
      detail: err instanceof Error ? redactApiKeys(err.message).slice(0, 240) : String(err),
    });
    sendJson(res, 502, {
      error: 'Unable to generate the image right now. Please try again.',
      code: 'IMAGE_UPSTREAM_ERROR',
      retryable: true,
    });
  }
}
