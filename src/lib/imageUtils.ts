import { ChatImage } from '../types/chat';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024; // 15 MB raw upload cap
const MAX_DIMENSION_PX = 1280;
const TARGET_COMPRESSED_BYTES = 350 * 1024; // ~350 KB for fast upload + Local Storage efficiency
const HARD_MAX_COMPRESSED_BYTES = 850 * 1024; // Reject if still > 850 KB

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIdx + 1);
  return Math.floor((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new ImageValidationError('Could not read the selected image file.'));
      }
    };
    reader.onerror = () => {
      reject(new ImageValidationError('Failed to read the selected image file.'));
    };
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new ImageValidationError('This image file appears corrupted or unsupported.'));
    img.src = src;
  });
}

function renderToDataUrl(
  img: HTMLImageElement,
  maxDimension: number,
  mimeType: string,
  quality: number,
): string {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageValidationError('Browser canvas is unavailable for image processing.');
  }

  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}

export async function processImageFile(file: File): Promise<ChatImage> {
  const normalizedType = file.type.toLowerCase();
  const hasAllowedType = ALLOWED_MIME_TYPES.has(normalizedType);
  const hasAllowedExt = ALLOWED_EXTENSIONS.test(file.name);

  if (!hasAllowedType && !hasAllowedExt) {
    throw new ImageValidationError(
      'Unsupported image format. Please choose a JPG, JPEG, PNG, or WEBP image.',
    );
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new ImageValidationError(
      'Image is too large (over 15 MB). Please choose a smaller image.',
    );
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  // Prefer WebP for crisp compression (or JPEG fallback if WebP encoding isn't supported)
  let outputMime = normalizedType === 'image/png' || normalizedType === 'image/webp'
    ? 'image/webp'
    : 'image/jpeg';

  let compressed = renderToDataUrl(img, MAX_DIMENSION_PX, outputMime, 0.84);
  if (outputMime === 'image/webp' && !compressed.startsWith('data:image/webp')) {
    outputMime = 'image/jpeg';
    compressed = renderToDataUrl(img, MAX_DIMENSION_PX, outputMime, 0.82);
  }

  let sizeBytes = estimateDataUrlBytes(compressed);

  if (sizeBytes > TARGET_COMPRESSED_BYTES) {
    compressed = renderToDataUrl(img, 1024, outputMime, 0.72);
    sizeBytes = estimateDataUrlBytes(compressed);
  }

  if (sizeBytes > TARGET_COMPRESSED_BYTES) {
    compressed = renderToDataUrl(img, 896, 'image/jpeg', 0.65);
    outputMime = 'image/jpeg';
    sizeBytes = estimateDataUrlBytes(compressed);
  }

  if (sizeBytes > HARD_MAX_COMPRESSED_BYTES) {
    throw new ImageValidationError(
      'Image could not be compressed enough for browser storage. Try a smaller image.',
    );
  }

  return {
    dataUrl: compressed,
    mimeType: outputMime,
    name: file.name || 'uploaded-image',
    sizeBytes,
  };
}

export async function optimizeDataUrlForStorage(
  dataUrl: string,
  mimeType: string,
): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number }> {
  const initialSize = estimateDataUrlBytes(dataUrl);
  if (initialSize <= 320 * 1024) {
    return { dataUrl, mimeType, sizeBytes: initialSize };
  }

  try {
    const img = await loadImageElement(dataUrl);
    let outputMime = 'image/webp';
    let optimized = renderToDataUrl(img, 1024, outputMime, 0.86);
    if (!optimized.startsWith('data:image/webp')) {
      outputMime = 'image/jpeg';
      optimized = renderToDataUrl(img, 1024, outputMime, 0.85);
    }
    let sizeBytes = estimateDataUrlBytes(optimized);
    if (sizeBytes > 350 * 1024) {
      optimized = renderToDataUrl(img, 896, 'image/jpeg', 0.78);
      outputMime = 'image/jpeg';
      sizeBytes = estimateDataUrlBytes(optimized);
    }
    return { dataUrl: optimized, mimeType: outputMime, sizeBytes };
  } catch {
    return { dataUrl, mimeType, sizeBytes: initialSize };
  }
}

export function downloadDataUrlImage(
  dataUrl: string,
  promptOrName: string,
  mimeType = 'image/png',
): void {
  const ext =
    mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? 'jpg'
      : mimeType.includes('webp')
        ? 'webp'
        : 'png';

  const slug = promptOrName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  const filename = `swiftchat-${slug || 'generated-image'}.${ext}`;

  const link = document.createElement('a');
  let objectUrl: string | null = null;

  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx !== -1) {
      const base64 = dataUrl.slice(commaIdx + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
    } else {
      link.href = dataUrl;
    }
  } catch {
    link.href = dataUrl;
  }

  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (objectUrl) {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 1500);
  }
}
