import dotenv from 'dotenv';
import type { IncomingMessage as HttpIncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI, Content, Part, ThinkingLevel } from '@google/genai';
import {
  ConversationLanguage,
  isUrduScript,
  looksLikeRomanUrdu,
  matchInstantReply,
} from '../src/lib/quickReplies.js';
import { isValidTimeZone, parseDateTimeQuery } from '../src/lib/dateTimeHelper.js';
import {
  fetchLiveWeatherReply,
  parseWeatherQuery,
  resolveDynamicDateTimeReply,
} from './_weather.js';

// Load .env.local first, then .env without overriding runtime-injected secrets
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_FREE_MODEL = 'gemini-4-hydrogen';
const MAX_SERVER_RETRIES = 1;
const MAX_AUTO_RETRY_DELAY_MS = 1000;
const UPSTREAM_CONNECT_TIMEOUT_MS = 14000;
const STREAM_IDLE_TIMEOUT_MS = 14000;
const MAX_BODY_BYTES = 6 * 1024 * 1024;

interface IncomingImage {
  mimeType: string;
  dataUrl: string;
}

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
  image?: IncomingImage;
}

export interface ParsedApiError {
  status: number;
  code:
    | 'API_KEY_MISSING'
    | 'API_KEY_INVALID'
    | 'RATE_LIMITED_TEMPORARY'
    | 'DAILY_QUOTA_EXCEEDED'
    | 'INVALID_REQUEST'
    | 'MODEL_UNAVAILABLE'
    | 'REQUEST_TIMEOUT'
    | 'UPSTREAM_ERROR';
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

function buildSystemInstruction(
  language: ConversationLanguage,
  latestText: string,
  hasImage: boolean,
  clientTimeZone?: string,
): string {
  const tz = isValidTimeZone(clientTimeZone) ? clientTimeZone : 'UTC';
  const todayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const dateContext = `Today is ${todayStr} (${tz}). Keep answers short and direct for simple questions.`;
  const imageHint = hasImage ? ' Inspect the image carefully to answer or extract text.' : '';
  if (isUrduScript(latestText)) {
    return `${dateContext} Reply concisely in Urdu script.${imageHint}`;
  }
  if (language === 'urdu' || looksLikeRomanUrdu(latestText)) {
    return `${dateContext} Reply concisely in clear Roman Urdu (or Urdu if written in Urdu script).${imageHint}`;
  }
  return `${dateContext}${imageHint}`;
}

const DATA_URL_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function readJsonBody(
  req: HttpIncomingMessage & { body?: unknown },
): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return JSON.parse(req.body);
    }
    return req.body;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function parseImagePart(image: unknown): Part | null {
  if (!image || typeof image !== 'object') return null;
  const candidate = image as { dataUrl?: unknown };
  if (typeof candidate.dataUrl !== 'string') return null;

  const match = DATA_URL_REGEX.exec(candidate.dataUrl);
  if (!match) return null;

  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const base64Data = match[2];

  if (base64Data.length > 5_500_000) {
    return null;
  }

  return {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('ABORTED'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('ABORTED'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function parseDurationToSeconds(raw: string): number | undefined {
  const trimmed = raw.trim().toLowerCase();
  const msMatch = /^(\d+(?:\.\d+)?)\s*ms$/.exec(trimmed);
  if (msMatch) {
    return Math.max(1, Math.ceil(Number(msMatch[1]) / 1000));
  }
  const secMatch = /^(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?$/.exec(trimmed);
  if (secMatch) {
    return Math.max(1, Math.ceil(Number(secMatch[1])));
  }
  const num = Number(trimmed);
  if (Number.isFinite(num) && num > 0) {
    return Math.ceil(num);
  }
  return undefined;
}

interface GoogleRpcErrorShape {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      '@type'?: string;
      retryDelay?: string;
      reason?: string;
      violations?: Array<{
        quotaMetric?: string;
        quotaId?: string;
        quotaValue?: string;
        description?: string;
      }>;
    }>;
  };
}

function extractRpcErrorPayload(rawMessage: string): GoogleRpcErrorShape['error'] | null {
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart === -1) return null;
  try {
    const parsed = JSON.parse(rawMessage.slice(jsonStart)) as GoogleRpcErrorShape;
    return parsed?.error ?? null;
  } catch {
    return null;
  }
}

export function parseGeminiError(err: unknown): ParsedApiError {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage === 'GEMINI_API_KEY_MISSING') {
    return {
      status: 500,
      code: 'API_KEY_MISSING',
      message: 'API configuration error. Please check your Gemini API key.',
      retryable: false,
    };
  }

  const errObj = err as {
    status?: number;
    headers?: { get?: (name: string) => string | null };
    response?: { headers?: Record<string, string | undefined> };
  };

  const rpcError = extractRpcErrorPayload(rawMessage);
  const httpStatus = errObj?.status ?? rpcError?.code;
  const rpcStatus = rpcError?.status?.toUpperCase() ?? '';
  const detailText = rpcError?.message ?? rawMessage;
  const lower = detailText.toLowerCase();

  let retryAfterSeconds: number | undefined;

  const headerRetryAfter =
    errObj?.headers?.get?.('retry-after') ??
    errObj?.response?.headers?.['retry-after'];
  if (headerRetryAfter) {
    retryAfterSeconds = parseDurationToSeconds(headerRetryAfter);
  }

  if (rpcError?.details) {
    for (const detail of rpcError.details) {
      if (detail['@type']?.includes('RetryInfo') && typeof detail.retryDelay === 'string') {
        const parsed = parseDurationToSeconds(detail.retryDelay);
        if (parsed !== undefined) {
          retryAfterSeconds = parsed;
        }
      }
    }
  }

  if (retryAfterSeconds === undefined) {
    const textRetryMatch = /retry\s+(?:in|after)\s+(\d+(?:\.\d+)?\s*(?:ms|s(?:ec(?:ond)?s?)?))/i.exec(
      detailText,
    );
    if (textRetryMatch) {
      retryAfterSeconds = parseDurationToSeconds(textRetryMatch[1]);
    }
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    rpcStatus === 'PERMISSION_DENIED' ||
    rpcStatus === 'UNAUTHENTICATED' ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('api key expired')
  ) {
    return {
      status: 403,
      code: 'API_KEY_INVALID',
      message: 'API configuration error. Please check your Gemini API key.',
      retryable: false,
    };
  }

  const isRateOrQuota =
    httpStatus === 429 ||
    rpcStatus === 'RESOURCE_EXHAUSTED' ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('quota');

  if (isRateOrQuota) {
    const violations =
      rpcError?.details?.flatMap((d) =>
        Array.isArray(d.violations) ? d.violations : [],
      ) ?? [];

    const hasZeroLimit =
      violations.some((v) => v.quotaValue === '0') ||
      /\blimit:\s*0\b/i.test(detailText);

    const hasDailyViolation =
      violations.some(
        (v) =>
          (v.quotaId && /perday|daily/i.test(v.quotaId)) ||
          (v.quotaMetric && /per_day|daily/i.test(v.quotaMetric)),
      ) ||
      /requestsperday|per\s*day|daily\s*limit|free_tier_requests.*limit:\s*0/i.test(detailText);

    const hasMinuteViolation =
      violations.some(
        (v) =>
          (v.quotaId && /perminute/i.test(v.quotaId)) ||
          (v.quotaMetric && /per_minute/i.test(v.quotaMetric)),
      ) || /per\s*minute|rpm|tpm|too many requests/i.test(detailText);

    if (hasZeroLimit || (hasDailyViolation && !hasMinuteViolation)) {
      return {
        status: 429,
        code: 'DAILY_QUOTA_EXCEEDED',
        message: 'Your Gemini free-tier quota has been reached. Please try again when your quota resets.',
        retryable: false,
      };
    }

    return {
      status: 429,
      code: 'RATE_LIMITED_TEMPORARY',
      message: 'Too many requests. Please wait a moment and try again.',
      retryable: true,
      retryAfterSeconds: retryAfterSeconds ?? 5,
    };
  }

  if (httpStatus === 404 || rpcStatus === 'NOT_FOUND') {
    return {
      status: 404,
      code: 'MODEL_UNAVAILABLE',
      message: 'The selected Gemini model is currently unavailable for this API key.',
      retryable: false,
    };
  }

  if (httpStatus === 400 || rpcStatus === 'INVALID_ARGUMENT') {
    return {
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'The message or image could not be processed. Please edit your prompt and try again.',
      retryable: false,
    };
  }

  return {
    status: 502,
    code: 'UPSTREAM_ERROR',
    message: 'Unable to reach the AI service right now. Please try again in a moment.',
    retryable: true,
    retryAfterSeconds: retryAfterSeconds ?? 3,
  };
}

async function nextChunkWithTimeout<T>(
  iterator: AsyncIterator<T>,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<IteratorResult<T>> {
  if (signal.aborted) {
    throw new Error('ABORTED');
  }

  return new Promise<IteratorResult<T>>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      void iterator.return?.().catch(() => {});
      reject(new Error('UPSTREAM_TIMEOUT'));
    }, timeoutMs);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void iterator.return?.().catch(() => {});
      reject(new Error('ABORTED'));
    };

    signal.addEventListener('abort', onAbort, { once: true });

    iterator
      .next()
      .then((res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(res);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
}

async function openStreamWithFirstChunk(
  ai: GoogleGenAI,
  model: string,
  contents: Content[],
  systemInstruction: string,
  signal: AbortSignal,
) {
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, UPSTREAM_CONNECT_TIMEOUT_MS);

  const onParentAbort = () => timeoutController.abort();
  signal.addEventListener('abort', onParentAbort, { once: true });

  const thinkingLevel =
    model === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;

  let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
  try {
    stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        abortSignal: timeoutController.signal,
        thinkingConfig: { thinkingLevel },
        systemInstruction,
      },
    });
  } catch (err) {
    if (timedOut) {
      throw new Error('UPSTREAM_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener('abort', onParentAbort);
  }

  const iterator = stream[Symbol.asyncIterator]();
  while (true) {
    const next = await nextChunkWithTimeout(iterator, STREAM_IDLE_TIMEOUT_MS, signal);
    if (next.done) {
      throw new Error('EMPTY_UPSTREAM_RESPONSE');
    }
    const text = next.value.text;
    if (text && text.length > 0) {
      return { iterator, firstText: text, model };
    }
  }
}

async function createStreamWithSmartRetry(
  ai: GoogleGenAI,
  contents: Content[],
  systemInstruction: string,
  signal: AbortSignal,
) {
  let activeModel = PRIMARY_MODEL;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_SERVER_RETRIES; attempt++) {
    if (signal.aborted) {
      throw new Error('ABORTED');
    }

    try {
      return await openStreamWithFirstChunk(
        ai,
        activeModel,
        contents,
        systemInstruction,
        signal,
      );
    } catch (err) {
      lastError = err;

      if (signal.aborted || (err instanceof Error && err.message === 'ABORTED')) {
        throw err;
      }

      if (
        err instanceof Error &&
        (err.message === 'UPSTREAM_TIMEOUT' || err.message === 'EMPTY_UPSTREAM_RESPONSE')
      ) {
        if (attempt < MAX_SERVER_RETRIES) {
          continue;
        }
        throw err;
      }

      const parsed = parseGeminiError(err);

      if (
        (parsed.code === 'MODEL_UNAVAILABLE' || parsed.code === 'DAILY_QUOTA_EXCEEDED') &&
        activeModel === PRIMARY_MODEL
      ) {
        activeModel = FALLBACK_FREE_MODEL;
        return await openStreamWithFirstChunk(
          ai,
          activeModel,
          contents,
          systemInstruction,
          signal,
        );
      }

      if (!parsed.retryable || attempt === MAX_SERVER_RETRIES) {
        throw lastError;
      }

      const requestedDelayMs = parsed.retryAfterSeconds
        ? parsed.retryAfterSeconds * 1000
        : 450 * Math.pow(2, attempt);

      if (parsed.code === 'RATE_LIMITED_TEMPORARY' && requestedDelayMs > MAX_AUTO_RETRY_DELAY_MS) {
        throw lastError;
      }

      const jitterMs = Math.floor(Math.random() * 150);
      await sleep(Math.min(MAX_AUTO_RETRY_DELAY_MS, requestedDelayMs) + jitterMs, signal);
    }
  }

  throw lastError;
}

export async function handleChatRequest(
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

  let body: { messages?: unknown; language?: unknown; timeZone?: unknown };
  try {
    body = (await readJsonBody(req)) as {
      messages?: unknown;
      language?: unknown;
      timeZone?: unknown;
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INVALID_JSON';
    if (code === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, {
        error: 'Message payload is too large. Please use a smaller image.',
        code: 'PAYLOAD_TOO_LARGE',
        retryable: false,
      });
      return;
    }
    sendJson(res, 400, {
      error: 'Invalid request body.',
      code: 'INVALID_JSON',
      retryable: false,
    });
    return;
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    sendJson(res, 400, {
      error: 'Please enter a message or upload an image before sending.',
      code: 'EMPTY_MESSAGES',
      retryable: false,
    });
    return;
  }

  const language: ConversationLanguage =
    body.language === 'urdu' || body.language === 'english' ? body.language : 'auto';
  const clientTimeZone =
    typeof body.timeZone === 'string' && isValidTimeZone(body.timeZone)
      ? body.timeZone
      : undefined;

  const sanitized: ChatMessageInput[] = body.messages
    .filter((m): m is ChatMessageInput => {
      if (typeof m !== 'object' || m === null) return false;
      const candidate = m as ChatMessageInput;
      if (candidate.role !== 'user' && candidate.role !== 'model') return false;
      const hasText = typeof candidate.text === 'string' && candidate.text.trim().length > 0;
      const hasValidImage = candidate.role === 'user' && parseImagePart(candidate.image) !== null;
      return hasText || hasValidImage;
    })
    .slice(-4);

  if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
    sendJson(res, 400, {
      error: 'The latest message must include text or a valid image.',
      code: 'INVALID_PROMPT',
      retryable: false,
    });
    return;
  }

  const writeSingleSseReply = (replyText: string, serverTiming: string) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Server-Timing', serverTiming);
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ text: replyText })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  };

  const latestMessage = sanitized[sanitized.length - 1];
  const latestHasImage = parseImagePart(latestMessage.image) !== null;
  if (!latestHasImage) {
    const preferUrdu =
      language === 'urdu' ||
      isUrduScript(latestMessage.text) ||
      looksLikeRomanUrdu(latestMessage.text);

    const instant = matchInstantReply(latestMessage.text, language, clientTimeZone);
    if (instant) {
      writeSingleSseReply(instant.reply, 'local;desc="instant";dur=0');
      return;
    }

    const dynamicDateQuery = parseDateTimeQuery(latestMessage.text);
    if (dynamicDateQuery) {
      const dateStart = Date.now();
      const dynamicDateReply = await resolveDynamicDateTimeReply({
        kind: dynamicDateQuery.kind,
        locationQuery: dynamicDateQuery.locationQuery,
        clientTimeZone,
        preferUrdu,
      });
      if (dynamicDateReply) {
        writeSingleSseReply(
          dynamicDateReply,
          `local;desc="datetime";dur=${Date.now() - dateStart}`,
        );
        return;
      }
    }

    const weatherQuery = parseWeatherQuery(latestMessage.text);
    if (weatherQuery) {
      const wxStart = Date.now();
      const weatherReply = await fetchLiveWeatherReply({
        locationQuery: weatherQuery.locationQuery,
        clientTimeZone,
        preferUrdu,
      });
      writeSingleSseReply(
        weatherReply,
        `weather;desc="open-meteo";dur=${Date.now() - wxStart}`,
      );
      return;
    }
  }

  let remainingImages = 1;
  const includeImageFlags = new Array<boolean>(sanitized.length).fill(false);
  for (let i = sanitized.length - 1; i >= 0 && remainingImages > 0; i--) {
    if (sanitized[i].role === 'user' && parseImagePart(sanitized[i].image) !== null) {
      includeImageFlags[i] = true;
      remainingImages--;
    }
  }

  const rawContents: Content[] = sanitized.map((m, idx) => {
    const parts: Part[] = [];
    const imagePart = includeImageFlags[idx] ? parseImagePart(m.image) : null;
    if (imagePart) {
      parts.push(imagePart);
    }

    const trimmedText = typeof m.text === 'string' ? m.text.trim() : '';
    if (trimmedText.length > 0) {
      parts.push({ text: trimmedText });
    } else if (imagePart) {
      parts.push({ text: 'Please analyze and describe this image.' });
    } else {
      parts.push({ text: '[Image attached]' });
    }

    return {
      role: m.role,
      parts,
    };
  });

  // Ensure strictly alternating user/model roles so Gemini never rejects consecutive same-role messages
  const contents: Content[] = [];
  for (const item of rawContents) {
    const prev = contents[contents.length - 1];
    if (prev && prev.role === item.role) {
      prev.parts = [...(prev.parts ?? []), ...(item.parts ?? [])];
    } else {
      contents.push(item);
    }
  }

  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient();
  } catch (err) {
    const parsed = parseGeminiError(err);
    sendJson(res, parsed.status, {
      error: parsed.message,
      code: parsed.code,
      retryable: parsed.retryable,
    });
    return;
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  const systemInstruction = buildSystemInstruction(
    language,
    latestMessage.text,
    latestHasImage,
    clientTimeZone,
  );
  const startMs = Date.now();

  try {
    const { iterator, firstText, model } = await createStreamWithSmartRetry(
      ai,
      contents,
      systemInstruction,
      controller.signal,
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Server-Timing', `gemini;desc="${model}";dur=${Date.now() - startMs}`);
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ text: firstText })}\n\n`);

    while (true) {
      if (controller.signal.aborted) {
        break;
      }
      const next = await nextChunkWithTimeout(
        iterator,
        STREAM_IDLE_TIMEOUT_MS,
        controller.signal,
      );
      if (next.done) {
        break;
      }
      const chunkText = next.value.text;
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    if (!controller.signal.aborted) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
    res.end();
  } catch (err) {
    if (controller.signal.aborted || (err instanceof Error && err.message === 'ABORTED')) {
      if (!res.writableEnded) res.end();
      return;
    }

    if (err instanceof Error && err.message === 'UPSTREAM_TIMEOUT') {
      console.error('[api/chat error] REQUEST_TIMEOUT');
      if (!res.headersSent) {
        sendJson(res, 504, {
          error: 'The AI service took too long to respond. Please try again.',
          code: 'REQUEST_TIMEOUT',
          retryable: true,
        });
      } else {
        res.write(
          `data: ${JSON.stringify({
            error: 'The AI service took too long to respond. Please try again.',
            code: 'REQUEST_TIMEOUT',
            retryable: true,
          })}\n\n`,
        );
        res.end();
      }
      return;
    }

    const parsed = parseGeminiError(err);
    console.error('[api/chat error]', parsed.code);
    if (parsed.status === 429 && parsed.retryAfterSeconds) {
      res.setHeader('Retry-After', String(parsed.retryAfterSeconds));
    }

    if (!res.headersSent) {
      sendJson(res, parsed.status, {
        error: parsed.message,
        code: parsed.code,
        retryable: parsed.retryable,
        retryAfterSeconds: parsed.retryAfterSeconds,
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: parsed.message,
          code: parsed.code,
          retryable: parsed.retryable,
          retryAfterSeconds: parsed.retryAfterSeconds,
        })}\n\n`,
      );
      res.end();
    }
  }
}
