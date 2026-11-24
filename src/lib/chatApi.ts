import { ChatMessage } from '../types/chat';
import { ConversationLanguage } from './quickReplies';

export interface StreamChatMessageInput {
  role: ChatMessage['role'];
  text: string;
  image?: {
    mimeType: string;
    dataUrl: string;
  };
}

export interface StreamChatOptions {
  messages: StreamChatMessageInput[];
  language?: ConversationLanguage;
  timeZone?: string;
  signal?: AbortSignal;
  onChunk: (deltaText: string) => void;
}

export class ChatApiError extends Error {
  code: string;
  retryable: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      retryable?: boolean;
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = 'ChatApiError';
    this.code = options?.code ?? 'API_ERROR';
    this.retryable = options?.retryable ?? true;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function looksLikeHtmlPage(text: string): boolean {
  const sample = text.trimStart().slice(0, 512).toLowerCase();
  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.includes('<title>starting server') ||
    sample.includes('<title>please wait') ||
    (sample.includes('<head>') && sample.includes('<body>'))
  );
}

function parseRetryAfterHeader(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const numeric = Number(headerValue.trim());
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.ceil(numeric);
  }
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    const diff = Math.ceil((dateMs - Date.now()) / 1000);
    return diff > 0 ? diff : undefined;
  }
  return undefined;
}

const CLIENT_TIMEOUT_MS = 38000;

export async function streamChatCompletion({
  messages,
  language,
  timeZone,
  signal,
  onChunk,
}: StreamChatOptions): Promise<string> {
  let response: Response;
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const requestController = new AbortController();
  let timedOut = false;
  const triggerTimeout = () => {
    timedOut = true;
    void activeReader?.cancel().catch(() => {});
    requestController.abort();
  };
  let timeoutId = window.setTimeout(triggerTimeout, CLIENT_TIMEOUT_MS);

  const resetTimeout = () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(triggerTimeout, CLIENT_TIMEOUT_MS);
  };

  const onCallerAbort = () => {
    void activeReader?.cancel().catch(() => {});
    requestController.abort();
  };
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  const resolvedTimeZone =
    timeZone ??
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined);

  try {
    try {
      response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify({ messages, language, timeZone: resolvedTimeZone }),
        signal: requestController.signal,
      });
    } catch (err) {
      if (timedOut) {
        throw new ChatApiError('The AI took too long to respond. Please try again.', {
          code: 'REQUEST_TIMEOUT',
          retryable: true,
        });
      }
      if ((err instanceof DOMException || err instanceof Error) && err.name === 'AbortError') {
        throw err;
      }
      throw new ChatApiError(
        'Unable to connect. Please check your internet connection.',
        {
          code: 'NETWORK_ERROR',
          retryable: true,
        },
      );
    }

    resetTimeout();

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJsonResponse = contentType.includes('application/json');
    const isSseResponse = contentType.includes('text/event-stream');
    const isHtmlResponse = contentType.includes('text/html');

    if (!response.ok) {
      let errorMessage = 'Unable to connect to the AI service. Please try again.';
      let code =
        response.status === 404
          ? 'ENDPOINT_NOT_FOUND'
          : isHtmlResponse
            ? 'HTML_ERROR_RESPONSE'
            : 'API_ERROR';
      let retryable = response.status >= 500 || response.status === 429 || isHtmlResponse;
      let retryAfterSeconds = parseRetryAfterHeader(response.headers.get('Retry-After'));

      if (isJsonResponse) {
        try {
          const payload = (await response.json()) as {
            error?: string;
            code?: string;
            retryable?: boolean;
            retryAfterSeconds?: number;
          };
          if (payload.error) {
            errorMessage = payload.error;
          }
          if (payload.code) {
            code = payload.code;
          }
          if (typeof payload.retryable === 'boolean') {
            retryable = payload.retryable;
          }
          if (typeof payload.retryAfterSeconds === 'number' && payload.retryAfterSeconds > 0) {
            retryAfterSeconds = Math.ceil(payload.retryAfterSeconds);
          }
        } catch {
          // Keep safe fallback message
        }
      }

      throw new ChatApiError(errorMessage, { code, retryable, retryAfterSeconds });
    }

    // Handle non-streaming JSON responses cleanly
    if (isJsonResponse) {
      try {
        const data = (await response.json()) as {
          text?: string;
          error?: string;
          code?: string;
          retryable?: boolean;
          retryAfterSeconds?: number;
        };
        if (data.error) {
          throw new ChatApiError(data.error, {
            code: data.code ?? 'API_ERROR',
            retryable: data.retryable ?? true,
            retryAfterSeconds: data.retryAfterSeconds,
          });
        }
        if (typeof data.text === 'string' && data.text.trim().length > 0 && !looksLikeHtmlPage(data.text)) {
          onChunk(data.text);
          return data.text;
        }
      } catch (err) {
        if (err instanceof ChatApiError) throw err;
      }
      throw new ChatApiError('Unable to connect to the AI service. Please try again.', {
        code: 'INVALID_JSON_RESPONSE',
        retryable: true,
      });
    }

    // Reject HTML pages (e.g. "Starting Server..." warmup page) or unexpected non-SSE responses
    if (!isSseResponse || !response.body || isHtmlResponse) {
      throw new ChatApiError('Unable to connect to the AI service. Please try again.', {
        code: isHtmlResponse ? 'HTML_WARMUP_RESPONSE' : 'INVALID_CONTENT_TYPE',
        retryable: true,
        retryAfterSeconds: 3,
      });
    }

    const reader = response.body.getReader();
    activeReader = reader;
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let rawSample = '';

    const processEventBlock = (rawEvent: string) => {
      const lines = rawEvent.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let parsed: {
          text?: string;
          done?: boolean;
          error?: string;
          code?: string;
          retryable?: boolean;
          retryAfterSeconds?: number;
        };
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new ChatApiError(parsed.error, {
            code: parsed.code ?? 'STREAM_ERROR',
            retryable: parsed.retryable ?? true,
            retryAfterSeconds: parsed.retryAfterSeconds,
          });
        }

        if (parsed.text) {
          fullText += parsed.text;
          onChunk(parsed.text);
        }
      }
    };

    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (err) {
        if (timedOut) {
          throw new ChatApiError('The AI took too long to respond. Please try again.', {
            code: 'REQUEST_TIMEOUT',
            retryable: true,
          });
        }
        throw err;
      }

      const { done, value } = readResult;
      if (done) {
        if (timedOut) {
          throw new ChatApiError('The AI took too long to respond. Please try again.', {
            code: 'REQUEST_TIMEOUT',
            retryable: true,
          });
        }
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        if (buffer.trim().length > 0) {
          processEventBlock(buffer);
          buffer = '';
        }
        break;
      }
      resetTimeout();

      const decoded = decoder.decode(value, { stream: true });
      if (rawSample.length < 512) {
        rawSample += decoded;
      }
      if (fullText.length === 0 && looksLikeHtmlPage(rawSample)) {
        throw new ChatApiError('Unable to connect to the AI service. Please try again.', {
          code: 'HTML_WARMUP_RESPONSE',
          retryable: true,
          retryAfterSeconds: 3,
        });
      }

      buffer += decoded;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        processEventBlock(rawEvent);
      }
    }

    if (fullText.trim().length === 0) {
      throw new ChatApiError('Unable to connect to the AI service. Please try again.', {
        code: 'EMPTY_RESPONSE',
        retryable: true,
      });
    }

    return fullText;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
    activeReader?.releaseLock();
  }
}
