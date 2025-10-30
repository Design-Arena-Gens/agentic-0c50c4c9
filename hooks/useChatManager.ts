'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ChatSession } from '@/types/chat';
import { HISTORY_STORAGE_KEY, storage } from '@/lib/storage';

const generateAssistantResponse = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "I'm here when you're ready to chat.";
  }

  return `You said: "${trimmed}"\n\nThis demo assistant runs entirely in your browser. Try starting a new chat, searching history, or adding emojis!`;
};

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createMessage = (role: ChatMessage['role'], content: string): ChatMessage => ({
  id: createId(),
  role,
  content,
  timestamp: new Date().toISOString()
});

export interface UseChatManagerOptions {
  assistantDelay?: number;
}

export const useChatManager = ({ assistantDelay = 800 }: UseChatManagerOptions = {}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = storage.getAll();
    const sorted = [...existing].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const initialSessions = sorted.length ? sorted : [storage.createEmptySession()];
    setSessions(initialSessions);

    const lastActive = storage.getLastActive();
    const fallbackId = initialSessions[0]?.id ?? null;
    const nextActive = lastActive && initialSessions.find((session) => session.id === lastActive) ? lastActive : fallbackId;
    setActiveSessionId(nextActive);

    if (!sorted.length) {
      storage.put(initialSessions);
      if (nextActive) {
        storage.setLastActive(nextActive);
      }
    }
  }, []);

  useEffect(() => {
    if (!sessions.length) return;
    storage.put(sessions);
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    storage.setLastActive(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === HISTORY_STORAGE_KEY) {
        const nextSessions = storage.getAll();
        setSessions(nextSessions);
      }
      if (event.key === 'chatgpt-ui-last-active') {
        setActiveSessionId(storage.getLastActive());
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? null, [activeSessionId, sessions]);

  const upsertSession = useCallback((updated: ChatSession) => {
    setSessions((prev) => {
      const others = prev.filter((session) => session.id !== updated.id);
      return [updated, ...others].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }, []);

  const createSession = useCallback(() => {
    const session = storage.createEmptySession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    return session;
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== id);
      if (!next.length) {
        const fallback = storage.createEmptySession();
        setActiveSessionId(fallback.id);
        return [fallback];
      }

      if (id === activeSessionId) {
        setActiveSessionId(next[0].id);
      }

      return next;
    });
  }, [activeSessionId]);

  const updateSession = useCallback(
    (id: string, updater: (session: ChatSession) => ChatSession) => {
      const session = sessions.find((item) => item.id === id);
      if (!session) return;
      const next = updater(session);
      upsertSession(next);
    },
    [sessions, upsertSession]
  );

  const ensureActiveSession = useCallback(() => {
    if (activeSession) return activeSession;
    if (sessions.length === 0) {
      return createSession();
    }
    const fallback = sessions[0];
    setActiveSessionId(fallback.id);
    return fallback;
  }, [activeSession, createSession, sessions]);

  const scheduleAssistantResponse = useCallback(
    (sessionId: string, prompt: string) => {
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        const responseMessage = createMessage('assistant', generateAssistantResponse(prompt));
        updateSession(sessionId, (session) => ({
          ...session,
          title: session.title === 'New Chat' && session.messages.length === 1 ? prompt.slice(0, 40) || 'New Chat' : session.title,
          messages: [...session.messages, responseMessage],
          updatedAt: responseMessage.timestamp
        }));
        setIsTyping(false);
      }, assistantDelay);
    },
    [assistantDelay, updateSession]
  );

  const sendMessage = useCallback(
    (content: string) => {
      const sanitized = content.trim();
      if (!sanitized) return;

      const session = ensureActiveSession();
      const message = createMessage('user', sanitized);
      updateSession(session.id, (current) => {
        const nextTitle = current.messages.length === 0 ? sanitized.slice(0, 40) || 'New Chat' : current.title;
        return {
          ...current,
          title: nextTitle,
          messages: [...current.messages, message],
          updatedAt: message.timestamp
        };
      });
      scheduleAssistantResponse(session.id, sanitized);
    },
    [ensureActiveSession, scheduleAssistantResponse, updateSession]
  );

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setIsTyping(false);
  }, []);

  useEffect(() => () => stopTyping(), [stopTyping]);

  return {
    sessions,
    activeSession,
    activeSessionId,
    searchTerm,
    setSearchTerm,
    isTyping,
    sendMessage,
    createSession,
    removeSession,
    setActiveSessionId,
    stopTyping
  };
};
