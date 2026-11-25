import { ChatMessage, Conversation, GeneratedImageRecord, ThemeMode } from '../types/chat';

const CONVERSATIONS_KEY = 'swiftchat_conversations_v1';
const GENERATED_IMAGES_KEY = 'swiftchat_generated_images_v1';
const ACTIVE_ID_KEY = 'swiftchat_active_id_v1';
const THEME_KEY = 'swiftchat_theme_v1';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveTitleFromPrompt(prompt: string, imageName?: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    if (imageName) {
      const base = imageName.replace(/\.[^.]+$/, '').trim();
      return base ? `Image: ${base.slice(0, 32)}` : 'Image analysis';
    }
    return 'New chat';
  }
  if (cleaned.length <= 42) {
    return cleaned;
  }
  return `${cleaned.slice(0, 40).trimEnd()}...`;
}

export function formatRelativeTime(timestamp: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function sortByUpdatedDesc(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface StorageSaveResult {
  ok: boolean;
  error?: string;
}

// READ: Retrieve all saved conversations from Local Storage
export function loadConversations(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed
      .filter(
        (item): item is Conversation =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          Array.isArray(item.messages) &&
          typeof item.createdAt === 'number' &&
          typeof item.updatedAt === 'number',
      )
      .map((conv) => ({
        ...conv,
        messages: conv.messages.filter((msg) => {
          if (!msg || typeof msg.text !== 'string') return false;
          if (msg.role === 'model') {
            const lower = msg.text.trimStart().slice(0, 256).toLowerCase();
            if (
              lower.startsWith('<!doctype html') ||
              lower.startsWith('<html') ||
              lower.includes('<title>starting server')
            ) {
              return false;
            }
          }
          return true;
        }),
      }));
    return sortByUpdatedDesc(valid);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): StorageSaveResult {
  try {
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    return { ok: true };
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22);
    return {
      ok: false,
      error: isQuota
        ? 'Browser Local Storage is full. Delete an older conversation to save new messages or images.'
        : 'Could not save conversation to browser Local Storage.',
    };
  }
}

// CREATE: Create a new empty conversation and persist it
export function createConversationRecord(initialTitle = 'New chat'): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title: initialTitle,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

// UPDATE: Rename an existing conversation
export function renameConversationInList(
  conversations: Conversation[],
  id: string,
  nextTitle: string,
): Conversation[] {
  const trimmed = nextTitle.trim();
  if (!trimmed) return conversations;
  const updated = conversations.map((conv) =>
    conv.id === id
      ? {
          ...conv,
          title: trimmed,
          updatedAt: Date.now(),
        }
      : conv,
  );
  const sorted = sortByUpdatedDesc(updated);
  saveConversations(sorted);
  return sorted;
}

// UPDATE: Append or replace messages inside a conversation
export function upsertConversationMessages(
  conversations: Conversation[],
  id: string,
  messages: ChatMessage[],
  autoTitleFrom?: { text: string; imageName?: string },
  preferredLanguage?: 'auto' | 'urdu' | 'english',
): { conversations: Conversation[]; saveResult: StorageSaveResult } {
  const now = Date.now();
  const updated = conversations.map((conv) => {
    if (conv.id !== id) return conv;
    const shouldAutoTitle =
      autoTitleFrom && (conv.title === 'New chat' || conv.messages.length === 0);
    return {
      ...conv,
      title: shouldAutoTitle
        ? deriveTitleFromPrompt(autoTitleFrom.text, autoTitleFrom.imageName)
        : conv.title,
      messages,
      preferredLanguage: preferredLanguage ?? conv.preferredLanguage,
      updatedAt: now,
    };
  });
  const sorted = sortByUpdatedDesc(updated);
  const saveResult = saveConversations(sorted);
  return { conversations: sorted, saveResult };
}

// DELETE: Remove a single conversation
export function deleteConversationInList(
  conversations: Conversation[],
  id: string,
): Conversation[] {
  const filtered = conversations.filter((conv) => conv.id !== id);
  saveConversations(filtered);
  return filtered;
}

export function loadActiveConversationId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_ID_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_ID_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore
  }
  return 'light';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

export function loadGeneratedImages(): GeneratedImageRecord[] {
  try {
    const raw = window.localStorage.getItem(GENERATED_IMAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is GeneratedImageRecord =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.prompt === 'string' &&
          typeof item.dataUrl === 'string' &&
          item.dataUrl.startsWith('data:image/') &&
          typeof item.createdAt === 'number',
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveGeneratedImages(items: GeneratedImageRecord[]): StorageSaveResult {
  try {
    window.localStorage.setItem(GENERATED_IMAGES_KEY, JSON.stringify(items));
    return { ok: true };
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22);
    return {
      ok: false,
      error: isQuota
        ? 'Browser Local Storage is full. Delete an older generated image or chat to save more.'
        : 'Could not save generated image to browser Local Storage.',
    };
  }
}

export function addGeneratedImageRecord(
  existing: GeneratedImageRecord[],
  record: GeneratedImageRecord,
): { items: GeneratedImageRecord[]; saveResult: StorageSaveResult } {
  const next = [record, ...existing.filter((item) => item.id !== record.id)].slice(0, 24);
  const saveResult = saveGeneratedImages(next);
  return { items: next, saveResult };
}

export function deleteGeneratedImageRecord(
  existing: GeneratedImageRecord[],
  id: string,
): GeneratedImageRecord[] {
  const next = existing.filter((item) => item.id !== id);
  saveGeneratedImages(next);
  return next;
}
