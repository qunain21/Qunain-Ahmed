import { useEffect, useRef } from 'react';
import { AlertCircle, ArrowUp, ImagePlus, Loader2, RefreshCw, Square, X } from 'lucide-react';
import { ChatImage } from '../types/chat';
import { formatBytes } from '../lib/imageUtils';

interface ChatInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isGenerating: boolean;
  pendingImage: ChatImage | null;
  isProcessingImage: boolean;
  imageError: string | null;
  onSelectImageFile: (file: File) => void;
  onRemoveImage: () => void;
  onClearImageError: () => void;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isGenerating,
  pendingImage,
  isProcessingImage,
  imageError,
  onSelectImageFile,
  onRemoveImage,
  onClearImageError,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${Math.max(44, nextHeight)}px`;
  }, [value]);

  const canSend =
    (value.trim().length > 0 || pendingImage !== null) &&
    !isGenerating &&
    !isProcessingImage;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSubmit();
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) {
      onStop();
      return;
    }
    if (canSend) {
      onSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onSelectImageFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          onSelectImageFile(file);
          return;
        }
      }
    }
  };

  const openFilePicker = () => {
    if (isGenerating || isProcessingImage) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t border-slate-200/80 bg-white/90 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6 sm:py-3.5 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto w-full max-w-3xl space-y-2">
        {imageError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{imageError}</span>
            </div>
            <button
              type="button"
              onClick={onClearImageError}
              aria-label="Dismiss image error"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload image file"
        />

        <form
          onSubmit={handleFormSubmit}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition-colors focus-within:border-blue-500 focus-within:bg-white dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-blue-500 dark:focus-within:bg-slate-900"
        >
          {(isProcessingImage || pendingImage) && (
            <div className="mb-1.5 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
              {isProcessingImage ? (
                <div className="flex items-center gap-2.5 px-1.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
                  <span>Processing image...</span>
                </div>
              ) : (
                pendingImage && (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={pendingImage.dataUrl}
                        alt={pendingImage.name}
                        referrerPolicy="no-referrer"
                        className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-800"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                          {pendingImage.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          {formatBytes(pendingImage.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={openFilePicker}
                        disabled={isGenerating}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Change</span>
                      </button>
                      <button
                        type="button"
                        onClick={onRemoveImage}
                        disabled={isGenerating}
                        aria-label="Remove selected image"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isGenerating || isProcessingImage}
              aria-label="Upload image"
              title="Upload image (JPG, PNG, WEBP)"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </button>

            <label htmlFor="chat-message-input" className="sr-only">
              Message SwiftChat
            </label>
            <textarea
              ref={textareaRef}
              id="chat-message-input"
              rows={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                pendingImage
                  ? 'Ask a question about this image, or press Send...'
                  : 'Ask anything or upload an image...'
              }
              aria-label="Message input"
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-snug text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            {isGenerating ? (
              <button
                type="submit"
                aria-label="Stop generating"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </div>
      <p className="mx-auto mt-1.5 hidden max-w-3xl px-1 text-center text-xs text-slate-400 sm:block dark:text-slate-500">
        Enter to send · Shift + Enter for new line · JPG, PNG, WEBP supported · Saved locally
      </p>
    </div>
  );
}
