import { memo, useEffect, useRef, useState } from 'react';
import {
  Check,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { Conversation, ThemeMode } from '../types/chat';
import { formatRelativeTime } from '../lib/storage';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onRequestDelete: (conversation: Conversation) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Sidebar = memo(function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onRequestDelete,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredConversations = normalizedQuery
    ? conversations.filter(
        (conv) =>
          conv.title.toLowerCase().includes(normalizedQuery) ||
          conv.messages.some((m) => m.text.toLowerCase().includes(normalizedQuery)),
      )
    : conversations;

  const startEditing = (conv: Conversation) => {
    setEditingId(conv.id);
    setDraftTitle(conv.title);
  };

  const commitEdit = (id: string) => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRenameConversation(id, trimmed);
    }
    setEditingId(null);
    setDraftTitle('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Chat history"
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-[276px] lg:translate-x-0 dark:border-slate-800 dark:bg-slate-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-white">
            SwiftChat
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 whitespace-nowrap dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>New chat</span>
          </button>

          {conversations.length > 0 && (
            <div className="relative mt-2.5">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                aria-label="Search conversations"
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-3">
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <MessageSquare
                className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-700"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                No conversations yet
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Your chats are saved automatically in this browser.
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching conversations.
            </p>
          ) : (
            <ul className="space-y-1" role="list">
              {filteredConversations.map((conv) => {
                const isActive = conv.id === activeId;
                const isEditing = editingId === conv.id;
                const msgCount = conv.messages.length;

                if (isEditing) {
                  return (
                    <li
                      key={conv.id}
                      className="rounded-xl border border-blue-500 bg-white p-2 dark:bg-slate-950"
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitEdit(conv.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        aria-label="Rename conversation"
                        className="min-h-[36px] w-full rounded-lg bg-slate-50 px-2.5 text-sm text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-slate-100"
                      />
                      <div className="mt-1.5 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="min-h-[36px] rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => commitEdit(conv.id)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Save</span>
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={conv.id} className="group relative">
                    <div
                      className={`flex items-center gap-1 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800/90 dark:text-white'
                          : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onClose();
                        }}
                        className="min-h-[52px] min-w-0 flex-1 rounded-xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <p className="truncate text-sm font-medium">{conv.title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          {msgCount} {msgCount === 1 ? 'msg' : 'msgs'}
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          {formatRelativeTime(conv.updatedAt)}
                        </p>
                      </button>

                      <div
                        className={`flex shrink-0 items-center pr-1 transition-opacity ${
                          isActive
                            ? 'opacity-100'
                            : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(conv);
                          }}
                          aria-label={`Rename ${conv.title}`}
                          title="Rename chat"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestDelete(conv);
                          }}
                          aria-label={`Delete ${conv.title}`}
                          title="Delete chat"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-slate-400 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500" aria-hidden="true" />
              )}
              <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
            </span>
          </button>
        </div>
      </aside>
    </>
  );
});
