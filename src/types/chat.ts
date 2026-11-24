export type ChatRole = 'user' | 'model';

export interface ChatImage {
  dataUrl: string;
  mimeType: string;
  name: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  image?: ChatImage;
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
