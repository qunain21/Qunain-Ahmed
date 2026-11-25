import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, MessageSquarePlus, RefreshCw, AlertCircle } from 'lucide-react';
import {
  ChatErrorState,
  ChatImage,
  ChatMessage,
  Conversation,
  GeneratedImageRecord,
  ImageAspectRatio,
  ThemeMode,
} from './types/chat';
import {
  addGeneratedImageRecord,
  createConversationRecord,
  deleteConversationInList,
  deleteGeneratedImageRecord,
  generateId,
  loadActiveConversationId,
  loadConversations,
  loadGeneratedImages,
  loadTheme,
  renameConversationInList,
  saveActiveConversationId,
  saveConversations,
  saveTheme,
  upsertConversationMessages,
} from './lib/storage';
import {
  ImageValidationError,
  optimizeDataUrlForStorage,
  processImageFile,
} from './lib/imageUtils';
import {
  ChatApiError,
  looksLikeHtmlPage,
  streamChatCompletion,
} from './lib/chatApi';
import {
  extractImagePromptIntent,
  fetchImageHealthInfo,
  generateAiImage,
  ImageHealthInfo,
} from './lib/imageGenApi';
import { ConversationLanguage, matchInstantReply } from './lib/quickReplies';
import { Sidebar } from './components/Sidebar';
import { ChatBubble } from './components/ChatBubble';
import { ChatInput } from './components/ChatInput';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ImageGalleryView } from './components/ImageGalleryView';

const STARTER_PROMPTS = [
  {
    title: 'Generate an AI image',
    prompt: '/imagine Minimalist ceramic coffee cup on warm oak table, soft morning window light',
  },
  {
    title: 'Explain a concept clearly',
    prompt: 'Explain how browser Local Storage works and when to use it.',
  },
  {
    title: 'Debug or write code',
    prompt: 'Write a clean TypeScript debounce function with proper types.',
  },
  {
    title: 'Check live weather',
    prompt: 'What is the current weather in Karachi right now?',
  },
];

function getInitialChatState(): {
  conversations: Conversation[];
  activeId: string | null;
} {
  const saved = loadConversations();
  const savedActive = loadActiveConversationId();
  const activeId =
    savedActive && saved.some((c) => c.id === savedActive)
      ? savedActive
      : (saved[0]?.id ?? null);
  return { conversations: saved, activeId };
}

export default function App() {
  const [initialState] = useState(getInitialChatState);
  const [conversations, setConversations] = useState<Conversation[]>(
    initialState.conversations,
  );
  const [activeId, setActiveId] = useState<string | null>(initialState.activeId);
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'gallery'>('chat');
  const [inputValue, setInputValue] = useState('');
  const [imageMode, setImageMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageRecord[]>(() =>
    loadGeneratedImages(),
  );
  const [imageHealthInfo, setImageHealthInfo] = useState<ImageHealthInfo | null>(null);
  const [pendingImage, setPendingImage] = useState<ChatImage | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<ChatErrorState | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchImageHealthInfo().then((info) => {
      if (info) setImageHealthInfo(info);
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveActiveConversationId(activeId);
  }, [activeId]);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom(isGenerating ? 'auto' : 'smooth');
  }, [
    activeConversation?.messages.length,
    activeConversation?.messages[activeConversation?.messages.length - 1]?.text,
    isGenerating,
    scrollToBottom,
  ]);

  const handleStopGenerating = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    isSubmittingRef.current = false;
    setIsGenerating(false);
    setStreamingMsgId(null);
  }, []);

  const handleNewChat = useCallback(() => {
    if (isGenerating) {
      handleStopGenerating();
    }
    setActiveView('chat');
    setErrorState(null);
    setRetryCountdown(0);
    setImageError(null);
    setPendingImage(null);

    if (activeConversation && activeConversation.messages.length === 0) {
      return;
    }

    const existingEmpty = conversations.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      setActiveId(existingEmpty.id);
      return;
    }

    const newConv = createConversationRecord();
    setConversations((prev) => {
      const next = [newConv, ...prev];
      saveConversations(next);
      return next;
    });
    setActiveId(newConv.id);
  }, [activeConversation, conversations, handleStopGenerating, isGenerating]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveView('chat');
      if (id === activeId) return;
      if (isGenerating) {
        handleStopGenerating();
      }
      setErrorState(null);
      setRetryCountdown(0);
      setImageError(null);
      setPendingImage(null);
      setActiveId(id);
    },
    [activeId, handleStopGenerating, isGenerating],
  );

  const handleRenameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) => renameConversationInList(prev, id, title));
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const deletedId = pendingDelete.id;
    if (deletedId === activeId && isGenerating) {
      handleStopGenerating();
    }
    setConversations((prev) => {
      const next = deleteConversationInList(prev, deletedId);
      if (deletedId === activeId) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
    setPendingDelete(null);
    setErrorState(null);
  }, [activeId, handleStopGenerating, isGenerating, pendingDelete]);

  const handleSelectImageFile = useCallback(async (file: File) => {
    setImageError(null);
    setIsProcessingImage(true);
    try {
      const processed = await processImageFile(file);
      setPendingImage(processed);
    } catch (err) {
      const message =
        err instanceof ImageValidationError
          ? err.message
          : 'Failed to process the selected image. Please try another file.';
      setImageError(message);
    } finally {
      setIsProcessingImage(false);
    }
  }, []);

  const runAssistantTurn = useCallback(
    async (
      targetConvId: string,
      historyWithUser: ChatMessage[],
      firstPromptMeta?: { text: string; imageName?: string },
      language: ConversationLanguage = 'auto',
    ) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setErrorState(null);
      setRetryCountdown(0);
      setIsGenerating(true);

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: '',
        createdAt: Date.now(),
      };
      setStreamingMsgId(assistantMsg.id);

      const withPlaceholder = [...historyWithUser, assistantMsg];
      setConversations((prev) => {
        const { conversations: next } = upsertConversationMessages(
          prev,
          targetConvId,
          withPlaceholder,
          firstPromptMeta,
          language,
        );
        return next;
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulated = '';
      let chunkRafId: number | null = null;

      const flushAccumulatedToState = () => {
        if (chunkRafId !== null) {
          window.cancelAnimationFrame(chunkRafId);
          chunkRafId = null;
        }
        const snapshot = accumulated;
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id !== targetConvId) return conv;
            return {
              ...conv,
              messages: conv.messages.map((msg) =>
                msg.id === assistantMsg.id ? { ...msg, text: snapshot } : msg,
              ),
            };
          }),
        );
      };

      try {
        const recentHistory = historyWithUser.slice(-4);
        const clientTimeZone =
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined;
        await streamChatCompletion({
          messages: recentHistory.map((m, idx) => ({
            role: m.role,
            text: m.text,
            image:
              m.image && idx === recentHistory.length - 1
                ? { mimeType: m.image.mimeType, dataUrl: m.image.dataUrl }
                : undefined,
          })),
          language,
          timeZone: clientTimeZone,
          signal: controller.signal,
          onChunk: (delta) => {
            accumulated += delta;
            if (chunkRafId === null) {
              chunkRafId = window.requestAnimationFrame(() => {
                chunkRafId = null;
                const snapshot = accumulated;
                setConversations((prev) =>
                  prev.map((conv) => {
                    if (conv.id !== targetConvId) return conv;
                    return {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMsg.id ? { ...msg, text: snapshot } : msg,
                      ),
                    };
                  }),
                );
              });
            }
          },
        });
        flushAccumulatedToState();

        let storageWarning: string | undefined;
        setConversations((prev) => {
          const target = prev.find((c) => c.id === targetConvId);
          if (!target) return prev;
          const cleaned = target.messages.map((msg) =>
            msg.id === assistantMsg.id
              ? { ...msg, text: accumulated || 'No response received.' }
              : msg,
          );
          const { conversations: next, saveResult } = upsertConversationMessages(
            prev,
            targetConvId,
            cleaned,
          );
          if (!saveResult.ok && saveResult.error) {
            storageWarning = saveResult.error;
          }
          return next;
        });
        if (storageWarning) {
          setErrorState({ message: storageWarning, retryable: false });
        }
      } catch (err) {
        if (chunkRafId !== null) {
          window.cancelAnimationFrame(chunkRafId);
          chunkRafId = null;
        }
        const isAbort =
          (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError';
        if (isAbort) {
          setConversations((prev) => {
            const target = prev.find((c) => c.id === targetConvId);
            if (!target) return prev;
            const finalized = accumulated.trim()
              ? target.messages.map((msg) =>
                  msg.id === assistantMsg.id ? { ...msg, text: accumulated } : msg,
                )
              : target.messages.filter((msg) => msg.id !== assistantMsg.id);
            return upsertConversationMessages(prev, targetConvId, finalized).conversations;
          });
        } else {
          const sanitizedAccumulated =
            accumulated.trim() && !looksLikeHtmlPage(accumulated) ? accumulated : '';
          setConversations((prev) => {
            const target = prev.find((c) => c.id === targetConvId);
            if (!target) return prev;
            const withoutEmptyAssistant = sanitizedAccumulated
              ? target.messages.map((msg) =>
                  msg.id === assistantMsg.id
                    ? { ...msg, text: sanitizedAccumulated }
                    : msg,
                )
              : target.messages.filter((msg) => msg.id !== assistantMsg.id);
            return upsertConversationMessages(prev, targetConvId, withoutEmptyAssistant)
              .conversations;
          });

          const message =
            err instanceof ChatApiError
              ? err.message
              : 'Unable to connect. Please check your internet connection.';
          const code = err instanceof ChatApiError ? err.code : 'UPSTREAM_ERROR';
          const retryable = err instanceof ChatApiError ? err.retryable : true;
          const retryAfterSeconds =
            err instanceof ChatApiError ? err.retryAfterSeconds : undefined;

          setErrorState({ message, code, retryable, retryAfterSeconds });
          setRetryCountdown(retryable && retryAfterSeconds ? retryAfterSeconds : 0);
        }
      } finally {
        abortControllerRef.current = null;
        isSubmittingRef.current = false;
        setIsGenerating(false);
        setStreamingMsgId(null);
      }
    },
    [],
  );

  const runImageGenerationTurn = useCallback(
    async (
      targetConvId: string,
      historyWithUser: ChatMessage[],
      imagePrompt: string,
      ratio: ImageAspectRatio,
      firstPromptMeta?: { text: string; imageName?: string },
    ) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setErrorState(null);
      setRetryCountdown(0);
      setIsGenerating(true);

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'model',
        text: '',
        kind: 'image_generation',
        createdAt: Date.now(),
      };
      setStreamingMsgId(assistantMsg.id);

      const withPlaceholder = [...historyWithUser, assistantMsg];
      setConversations((prev) => {
        const { conversations: next } = upsertConversationMessages(
          prev,
          targetConvId,
          withPlaceholder,
          firstPromptMeta,
        );
        return next;
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await generateAiImage({
          prompt: imagePrompt,
          aspectRatio: ratio,
          signal: controller.signal,
        });

        const optimized = await optimizeDataUrlForStorage(
          result.dataUrl,
          result.mimeType,
        );

        const completedAssistantMsg: ChatMessage = {
          ...assistantMsg,
          text: `Generated image for: "${imagePrompt}"`,
          kind: 'image_generation',
          image: {
            dataUrl: optimized.dataUrl,
            mimeType: optimized.mimeType,
            name: imagePrompt.slice(0, 48),
            sizeBytes: optimized.sizeBytes,
          },
          generatedImage: {
            prompt: imagePrompt,
            provider: result.provider,
            aspectRatio: result.aspectRatio,
            width: result.width,
            height: result.height,
            usageLimitNote: result.usageLimitNote,
          },
        };

        let storageWarning: string | undefined;
        setConversations((prev) => {
          const target = prev.find((c) => c.id === targetConvId);
          if (!target) return prev;
          const updatedMsgs = target.messages.map((msg) =>
            msg.id === assistantMsg.id ? completedAssistantMsg : msg,
          );
          const { conversations: next, saveResult } = upsertConversationMessages(
            prev,
            targetConvId,
            updatedMsgs,
          );
          if (!saveResult.ok && saveResult.error) {
            storageWarning = saveResult.error;
          }
          return next;
        });

        const galleryRecord: GeneratedImageRecord = {
          id: assistantMsg.id,
          prompt: imagePrompt,
          dataUrl: optimized.dataUrl,
          mimeType: optimized.mimeType,
          width: result.width,
          height: result.height,
          aspectRatio: result.aspectRatio,
          provider: result.provider,
          usageLimitNote: result.usageLimitNote,
          createdAt: Date.now(),
        };

        setGeneratedImages((prev) => {
          const { items, saveResult } = addGeneratedImageRecord(prev, galleryRecord);
          if (!saveResult.ok && saveResult.error && !storageWarning) {
            storageWarning = saveResult.error;
          }
          return items;
        });

        if (storageWarning) {
          setErrorState({ message: storageWarning, retryable: false });
        }
      } catch (err) {
        const isAbort =
          (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError';

        setConversations((prev) => {
          const target = prev.find((c) => c.id === targetConvId);
          if (!target) return prev;
          const withoutPlaceholder = target.messages.filter(
            (msg) => msg.id !== assistantMsg.id,
          );
          return upsertConversationMessages(prev, targetConvId, withoutPlaceholder)
            .conversations;
        });

        if (!isAbort) {
          const message =
            err instanceof ChatApiError
              ? err.message
              : 'Unable to generate the image right now. Please try again.';
          const code = err instanceof ChatApiError ? err.code : 'IMAGE_GEN_ERROR';
          const retryable = err instanceof ChatApiError ? err.retryable : true;
          const retryAfterSeconds =
            err instanceof ChatApiError ? err.retryAfterSeconds : undefined;

          setErrorState({ message, code, retryable, retryAfterSeconds });
          setRetryCountdown(retryable && retryAfterSeconds ? retryAfterSeconds : 0);
        }
      } finally {
        abortControllerRef.current = null;
        isSubmittingRef.current = false;
        setIsGenerating(false);
        setStreamingMsgId(null);
      }
    },
    [],
  );

  const handleSendMessage = useCallback(
    (overrideText?: string) => {
      const textToSend = (overrideText ?? inputValueRef.current).trim();
      const imageToSend = overrideText !== undefined ? null : pendingImage;

      if (
        (!textToSend && !imageToSend) ||
        isSubmittingRef.current ||
        isGenerating ||
        isProcessingImage
      ) {
        return;
      }

      if (!overrideText) {
        setInputValue('');
        setPendingImage(null);
        setImageError(null);
      }

      const detectedImagePrompt = !imageToSend
        ? imageMode
          ? textToSend
          : extractImagePromptIntent(textToSend)
        : null;
      const isImageGenerationRequest =
        detectedImagePrompt !== null && detectedImagePrompt.length >= 2;

      const currentLanguage: ConversationLanguage =
        activeConversation?.preferredLanguage ?? 'auto';
      const clientTimeZone =
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined;
      const instantMatch =
        !imageToSend && !isImageGenerationRequest
          ? matchInstantReply(textToSend, currentLanguage, clientTimeZone)
          : null;
      const nextLanguage: ConversationLanguage =
        instantMatch?.nextLanguage ?? currentLanguage;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        text: textToSend,
        image: imageToSend ?? undefined,
        kind: isImageGenerationRequest ? 'image_generation' : 'text',
        generatedImage: isImageGenerationRequest
          ? {
              prompt: detectedImagePrompt,
              provider: imageHealthInfo?.providerLabel ?? 'AI Image Generator',
              aspectRatio,
              width: 768,
              height: 768,
            }
          : undefined,
        createdAt: Date.now(),
      };

      const instantReplyMessage: ChatMessage | null = instantMatch
        ? {
            id: generateId(),
            role: 'model',
            text: instantMatch.reply,
            createdAt: Date.now(),
          }
        : null;

      let targetId = activeId;
      let nextMessages: ChatMessage[];
      let firstPromptMeta: { text: string; imageName?: string } | undefined;
      let storageError: string | undefined;

      if (!activeConversation) {
        const newConv = createConversationRecord();
        targetId = newConv.id;
        nextMessages = instantReplyMessage
          ? [userMessage, instantReplyMessage]
          : [userMessage];
        firstPromptMeta = { text: textToSend, imageName: imageToSend?.name };

        setConversations((prev) => {
          const withNew = [newConv, ...prev];
          const { conversations: next, saveResult } = upsertConversationMessages(
            withNew,
            newConv.id,
            nextMessages,
            firstPromptMeta,
            nextLanguage,
          );
          if (!saveResult.ok && saveResult.error) {
            storageError = saveResult.error;
          }
          return next;
        });
        setActiveId(newConv.id);
      } else {
        targetId = activeConversation.id;
        nextMessages = instantReplyMessage
          ? [...activeConversation.messages, userMessage, instantReplyMessage]
          : [...activeConversation.messages, userMessage];
        if (activeConversation.messages.length === 0) {
          firstPromptMeta = { text: textToSend, imageName: imageToSend?.name };
        }
        setConversations((prev) => {
          const { conversations: next, saveResult } = upsertConversationMessages(
            prev,
            targetId!,
            nextMessages,
            firstPromptMeta,
            nextLanguage,
          );
          if (!saveResult.ok && saveResult.error) {
            storageError = saveResult.error;
          }
          return next;
        });
      }

      if (storageError) {
        setErrorState({ message: storageError, retryable: false });
      } else if (instantReplyMessage) {
        setErrorState(null);
        setRetryCountdown(0);
      }

      if (isImageGenerationRequest && detectedImagePrompt) {
        void runImageGenerationTurn(
          targetId!,
          nextMessages,
          detectedImagePrompt,
          aspectRatio,
          firstPromptMeta,
        );
      } else if (!instantReplyMessage) {
        void runAssistantTurn(targetId!, nextMessages, firstPromptMeta, nextLanguage);
      }
    },
    [
      activeConversation,
      activeId,
      aspectRatio,
      imageHealthInfo?.providerLabel,
      imageMode,
      isGenerating,
      isProcessingImage,
      pendingImage,
      runAssistantTurn,
      runImageGenerationTurn,
    ],
  );

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleToggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );
  const handleRequestDelete = useCallback(
    (conv: Conversation) => setPendingDelete(conv),
    [],
  );
  const handleSubmitCurrent = useCallback(() => handleSendMessage(), [handleSendMessage]);
  const handleRemoveImage = useCallback(() => setPendingImage(null), []);
  const handleClearImageError = useCallback(() => setImageError(null), []);
  const handleToggleImageMode = useCallback(() => {
    setImageMode((prev) => {
      const next = !prev;
      if (next) {
        setPendingImage(null);
        setImageError(null);
      }
      return next;
    });
  }, []);

  const handleReuseImagePrompt = useCallback((prompt: string) => {
    setActiveView('chat');
    setImageMode(true);
    setPendingImage(null);
    setImageError(null);
    setInputValue(prompt);
  }, []);

  const handleDeleteGeneratedImage = useCallback((id: string) => {
    setGeneratedImages((prev) => deleteGeneratedImageRecord(prev, id));
  }, []);

  const handleRetryLast = useCallback(() => {
    if (
      !activeConversation ||
      isGenerating ||
      isSubmittingRef.current ||
      retryCountdown > 0
    ) {
      return;
    }
    const msgs = activeConversation.messages;
    if (msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    const historyToSend =
      lastMsg.role === 'user' ? msgs : msgs.slice(0, msgs.length - 1);

    if (
      historyToSend.length === 0 ||
      historyToSend[historyToSend.length - 1].role !== 'user'
    ) {
      return;
    }

    // If a partial assistant bubble existed from an interrupted stream, replace it cleanly without duplicating the user message
    if (lastMsg.role === 'model') {
      setConversations((prev) =>
        upsertConversationMessages(prev, activeConversation.id, historyToSend).conversations,
      );
    }

    const lastUserMsg = historyToSend[historyToSend.length - 1];
    if (lastUserMsg.kind === 'image_generation') {
      const retryPrompt =
        lastUserMsg.generatedImage?.prompt ||
        extractImagePromptIntent(lastUserMsg.text) ||
        lastUserMsg.text;
      const retryRatio = lastUserMsg.generatedImage?.aspectRatio ?? aspectRatio;
      void runImageGenerationTurn(
        activeConversation.id,
        historyToSend,
        retryPrompt,
        retryRatio,
      );
      return;
    }

    void runAssistantTurn(
      activeConversation.id,
      historyToSend,
      undefined,
      activeConversation.preferredLanguage ?? 'auto',
    );
  }, [
    activeConversation,
    aspectRatio,
    isGenerating,
    retryCountdown,
    runAssistantTurn,
    runImageGenerationTurn,
  ]);

  const messages = activeConversation?.messages ?? [];
  const headerTitle = activeConversation?.title ?? 'New chat';

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        open={sidebarOpen}
        onClose={handleCloseSidebar}
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onRequestDelete={handleRequestDelete}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat history"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1 className="truncate font-display text-base font-semibold text-slate-900 dark:text-white">
              {activeView === 'gallery' ? 'Image Gallery' : headerTitle}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div
              className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900"
              role="tablist"
              aria-label="Workspace view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'chat'}
                onClick={() => setActiveView('chat')}
                className={`min-h-[34px] rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-3 ${
                  activeView === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === 'gallery'}
                onClick={() => setActiveView('gallery')}
                className={`min-h-[34px] rounded-md px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 sm:px-3 ${
                  activeView === 'gallery'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {generatedImages.length > 0
                  ? `Images (${generatedImages.length})`
                  : 'Images'}
              </button>
            </div>

            {activeView === 'chat' && messages.length > 0 && (
              <span className="hidden text-xs text-slate-500 tabular-nums md:inline dark:text-slate-400">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
            )}
            <button
              type="button"
              onClick={handleNewChat}
              aria-label="Start new chat"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-8">
          {activeView === 'gallery' ? (
            <ImageGalleryView
              images={generatedImages}
              healthInfo={imageHealthInfo}
              onReusePrompt={handleReuseImagePrompt}
              onDeleteImage={handleDeleteGeneratedImage}
            />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {messages.length === 0 ? (
                <section className="flex min-h-[55dvh] flex-col items-center justify-center py-6 text-center">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                    How can I help today?
                  </h2>
                  <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">
                    Ask a question, upload an image to analyze, or generate custom AI images. Everything stays saved in your browser.
                  </p>

                <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      className="min-h-[68px] rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/80"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isStreaming={isGenerating && msg.id === streamingMsgId}
                />
              ))
            )}

            {errorState && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                  <p className="leading-relaxed">{errorState.message}</p>
                </div>
                {errorState.retryable && (
                  <button
                    type="button"
                    onClick={handleRetryLast}
                    disabled={isGenerating || retryCountdown > 0}
                    className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 self-end rounded-xl border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-700 tabular-nums transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-red-600 sm:self-auto dark:border-red-800 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>
                      {retryCountdown > 0 ? `Retry in ${retryCountdown}s` : 'Retry'}
                    </span>
                  </button>
                )}
              </div>
            )}

              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </main>

        {activeView === 'chat' && (
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmitCurrent}
            onStop={handleStopGenerating}
            isGenerating={isGenerating}
            pendingImage={pendingImage}
            isProcessingImage={isProcessingImage}
            imageError={imageError}
            onSelectImageFile={handleSelectImageFile}
            onRemoveImage={handleRemoveImage}
            onClearImageError={handleClearImageError}
            imageMode={imageMode}
            onToggleImageMode={handleToggleImageMode}
            aspectRatio={aspectRatio}
            onChangeAspectRatio={setAspectRatio}
            freeTierNote={imageHealthInfo?.freeTierNote}
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete conversation?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" will be permanently removed from this browser.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
