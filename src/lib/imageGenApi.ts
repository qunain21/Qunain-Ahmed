import { ImageAspectRatio } from '../types/chat';
import { ChatApiError, looksLikeHtmlPage } from './chatApi';

export interface GenerateImageResponse {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: ImageAspectRatio;
  provider: string;
  providerId: string;
  usageLimitNote?: string;
}

export interface ImageHealthInfo {
  providerId: string;
  providerLabel: string;
  hasKey: boolean;
  source: string | null;
  freeTierNote: string;
}

const IMAGE_REQUEST_TIMEOUT_MS = 32000;

export function extractImagePromptIntent(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith('/imagine')) {
    const rest = trimmed.slice('/imagine'.length).trim();
    return rest.length >= 2 ? rest : null;
  }

  const explicitPattern =
    /^(?:please\s+|can you\s+|could you\s+)?(?:generate|create|draw|make|design|render|paint|sketch)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:image|picture|photo|illustration|artwork|logo|wallpaper|poster|portrait)\s+(?:of|showing|with|featuring|depicting)\s+(.+)$/i;
  const match = explicitPattern.exec(trimmed);
  if (match && match[1]) {
    const prompt = match[1].trim();
    return prompt.length >= 2 ? prompt : null;
  }

  return null;
}

export async function fetchImageHealthInfo(): Promise<ImageHealthInfo | null> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) return null;
    const data = (await res.json()) as { imageGeneration?: ImageHealthInfo };
    return data?.imageGeneration ?? null;
  } catch {
    return null;
  }
}

export async function generateAiImage(options: {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
  signal?: AbortSignal;
}): Promise<GenerateImageResponse> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, IMAGE_REQUEST_TIMEOUT_MS);

  const onParentAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          prompt: options.prompt,
          aspectRatio: options.aspectRatio ?? '1:1',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) {
        throw new ChatApiError('Image generation took too long. Please try again.', {
          code: 'IMAGE_TIMEOUT',
          retryable: true,
        });
      }
      if ((err instanceof DOMException || err instanceof Error) && err.name === 'AbortError') {
        throw err;
      }
      throw new ChatApiError('Unable to connect to the image service. Please check your connection.', {
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    const isHtml = contentType.includes('text/html');

    if (isHtml) {
      throw new ChatApiError('Server is warming up. Please retry in a moment.', {
        code: 'HTML_WARMUP_RESPONSE',
        retryable: true,
        retryAfterSeconds: 3,
      });
    }

    if (!isJson) {
      const rawText = await response.text().catch(() => '');
      if (looksLikeHtmlPage(rawText)) {
        throw new ChatApiError('Server is warming up. Please retry in a moment.', {
          code: 'HTML_WARMUP_RESPONSE',
          retryable: true,
          retryAfterSeconds: 3,
        });
      }
      throw new ChatApiError('Unable to reach the image generation endpoint. Please try again.', {
        code: 'INVALID_CONTENT_TYPE',
        retryable: true,
      });
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      dataUrl?: string;
      mimeType?: string;
      width?: number;
      height?: number;
      aspectRatio?: ImageAspectRatio;
      provider?: string;
      providerId?: string;
      usageLimitNote?: string;
      error?: string;
      code?: string;
      retryable?: boolean;
      retryAfterSeconds?: number;
    };

    if (!response.ok || !payload.ok || !payload.dataUrl || !payload.dataUrl.startsWith('data:image/')) {
      throw new ChatApiError(
        typeof payload.error === 'string' && payload.error.trim()
          ? payload.error
          : 'Could not generate image. Please try again.',
        {
          code: payload.code ?? 'IMAGE_GEN_ERROR',
          retryable: typeof payload.retryable === 'boolean' ? payload.retryable : response.status >= 500 || response.status === 429,
          retryAfterSeconds:
            typeof payload.retryAfterSeconds === 'number' && payload.retryAfterSeconds > 0
              ? Math.ceil(payload.retryAfterSeconds)
              : undefined,
        },
      );
    }

    return {
      dataUrl: payload.dataUrl,
      mimeType: payload.mimeType ?? 'image/png',
      width: payload.width ?? 768,
      height: payload.height ?? 768,
      aspectRatio: payload.aspectRatio ?? (options.aspectRatio ?? '1:1'),
      provider: payload.provider ?? 'Free AI Image Tier',
      providerId: payload.providerId ?? 'pollinations_free',
      usageLimitNote: payload.usageLimitNote,
    };
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener('abort', onParentAbort);
  }
}
