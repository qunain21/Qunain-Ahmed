import { memo, useEffect, useState } from 'react';
import { Download, Images, RotateCcw, Trash2, X } from 'lucide-react';
import { GeneratedImageRecord } from '../types/chat';
import { downloadDataUrlImage } from '../lib/imageUtils';
import { formatRelativeTime } from '../lib/storage';
import { ImageHealthInfo } from '../lib/imageGenApi';

const SAMPLE_IMAGE_PROMPTS = [
  'Minimalist ceramic coffee cup on warm oak table, soft morning window light',
  'Aerial view of turquoise coastal cliffs and crashing waves at golden hour',
  'Isometric cozy bookshop interior with warm reading lamps, detailed illustration',
];

interface ImageGalleryViewProps {
  images: GeneratedImageRecord[];
  healthInfo: ImageHealthInfo | null;
  onReusePrompt: (prompt: string) => void;
  onDeleteImage: (id: string) => void;
}

export const ImageGalleryView = memo(function ImageGalleryView({
  images,
  healthInfo,
  onReusePrompt,
  onDeleteImage,
}: ImageGalleryViewProps) {
  const [previewItem, setPreviewItem] = useState<GeneratedImageRecord | null>(null);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewItem]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 py-2">
      <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl dark:text-white">
            Generated Images
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Saved automatically in this browser. Download or reuse any prompt at any time.
          </p>
        </div>
        {healthInfo && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {healthInfo.freeTierNote}
          </p>
        )}
      </div>

      {images.length === 0 ? (
        <section className="flex min-h-[45dvh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Images className="h-8 w-8 text-slate-300 dark:text-slate-700" aria-hidden="true" />
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-900 dark:text-white">
            No generated images yet
          </h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Turn on Create image in the chat bar or try one of these prompts to generate your first image.
          </p>
          <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-3">
            {SAMPLE_IMAGE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onReusePrompt(prompt)}
                className="min-h-[68px] rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left text-xs leading-relaxed text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((item) => (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => setPreviewItem(item)}
                aria-label={`Preview generated image: ${item.prompt}`}
                className="block aspect-square w-full overflow-hidden bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-slate-950"
              >
                <img
                  src={item.dataUrl}
                  alt={item.prompt}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                />
              </button>

              <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
                <div>
                  <p className="line-clamp-2 text-sm leading-snug font-medium text-slate-900 dark:text-slate-100">
                    {item.prompt}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    <span>{item.aspectRatio}</span>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        downloadDataUrlImage(item.dataUrl, item.prompt, item.mimeType)
                      }
                      aria-label={`Download image for ${item.prompt}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReusePrompt(item.prompt)}
                      aria-label={`Reuse prompt: ${item.prompt}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reuse</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteImage(item.id)}
                    aria-label={`Delete saved image: ${item.prompt}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-slate-400 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/90 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.prompt}
          onClick={() => setPreviewItem(null)}
        >
          <div className="fixed top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadDataUrlImage(
                  previewItem.dataUrl,
                  previewItem.prompt,
                  previewItem.mimeType,
                );
              }}
              aria-label="Download generated image"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              aria-label="Close preview"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/80 text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <img
            src={previewItem.dataUrl}
            alt={previewItem.prompt}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82dvh] max-w-full rounded-xl object-contain shadow-2xl"
          />
          <p
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl text-center text-sm text-slate-300"
          >
            {previewItem.prompt}
          </p>
        </div>
      )}
    </div>
  );
});
