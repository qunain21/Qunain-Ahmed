import { memo, useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function formatMessageTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const ChatBubble = memo(function ChatBubble({
  message,
  isStreaming = false,
}: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isUser = message.role === 'user';

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen]);

  const handleCopy = async () => {
    if (!message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (isUser) {
    const hasText = message.text.trim().length > 0;
    return (
      <>
        <div className="flex justify-end">
          <div className="max-w-[88%] sm:max-w-[75%]">
            <div className="overflow-hidden rounded-2xl rounded-br-md bg-blue-600 text-white shadow-xs">
              {message.image && (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  aria-label={`View full size image ${message.image.name}`}
                  className="block w-full bg-slate-900/15 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <img
                    src={message.image.dataUrl}
                    alt={message.image.name || 'Uploaded image'}
                    referrerPolicy="no-referrer"
                    className="max-h-72 w-full object-cover transition-opacity hover:opacity-95"
                  />
                </button>
              )}
              {hasText && (
                <div className="px-4 py-3 text-[15px] leading-[1.55]">
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </div>
              )}
            </div>
            <div className="mt-1.5 flex justify-end px-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              <span>You</span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <time dateTime={new Date(message.createdAt).toISOString()}>
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
          </div>
        </div>

        {lightboxOpen && message.image && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-label={message.image.name}
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close image preview"
              className="fixed top-4 right-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/80 text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <img
              src={message.image.dataUrl}
              alt={message.image.name || 'Uploaded image full view'}
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85dvh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        )}
      </>
    );
  }

  const isWaitingFirstChunk = isStreaming && message.text.length === 0;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] sm:max-w-[82%]">
        <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3.5 text-slate-800 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          {isWaitingFirstChunk ? (
            <div
              className="flex items-center gap-2.5 py-0.5 text-sm text-slate-500 dark:text-slate-400"
              role="status"
              aria-live="polite"
            >
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.24s] dark:bg-slate-500" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.12s] dark:bg-slate-500" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-slate-500" />
              </span>
              <span>Thinking...</span>
            </div>
          ) : (
            <MarkdownRenderer content={message.text} />
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center text-xs text-slate-500 tabular-nums dark:text-slate-400">
            <span>Assistant</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <time dateTime={new Date(message.createdAt).toISOString()}>
              {formatMessageTime(message.createdAt)}
            </time>
          </div>

          {message.text.length > 0 && !isWaitingFirstChunk && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied response' : 'Copy response'}
              className="inline-flex min-h-[36px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
