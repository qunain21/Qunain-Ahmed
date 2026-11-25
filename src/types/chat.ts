export type ChatRole = 'user' | 'model';

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export interface ChatImage {
  dataUrl: string;
  mimeType: string;
  name: string;
  sizeBytes: number;
}

export interface GeneratedImageMeta {
  prompt: string;
  provider: string;
  aspectRatio: ImageAspectRatio;
  width: number;
  height: number;
  usageLimitNote?: string;
}

export interface GeneratedImageRecord {
  id: string;
  prompt: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: ImageAspectRatio;
  provider: string;
  usageLimitNote?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  image?: ChatImage;
  kind?: 'text' | 'image_generation';
  generatedImage?: GeneratedImageMeta;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  preferredLanguage?: 'auto' | 'urdu' | 'english';
  createdAt: number;
  updatedAt: number;
}

export interface ChatErrorState {
  message: string;
  code?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export type ThemeMode = 'light' | 'dark';
