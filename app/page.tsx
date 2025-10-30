'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import clsx from 'clsx';
import styles from './page.module.css';
import { useChatManager } from '@/hooks/useChatManager';
import type { ChatMessage, ChatSession } from '@/types/chat';
import { EmojiIcon, MenuIcon, PlusIcon, SearchIcon, SendIcon, TrashIcon } from '@/components/icons';

const EMOJIS = [
  { symbol: '😊', label: 'Smiling face with smiling eyes' },
  { symbol: '😂', label: 'Face with tears of joy' },
  { symbol: '❤️', label: 'Red heart' },
  { symbol: '👍', label: 'Thumbs up' },
  { symbol: '🤔', label: 'Thinking face' },
  { symbol: '😎', label: 'Smiling face with sunglasses' },
  { symbol: '🎉', label: 'Party popper' }
];

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  });
};

const formatHistoryMeta = (session: ChatSession) => {
  const updated = new Date(session.updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return updated.toLocaleDateString();
};

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div className={clsx(styles.message, isUser ? styles.userMessage : styles.assistantMessage)}>
      <div className={styles.messageContent}>{message.content}</div>
      <span className={styles.timestamp}>{formatTimestamp(message.timestamp)}</span>
    </div>
  );
};

export default function Home() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    searchTerm,
    setSearchTerm,
    isTyping,
    sendMessage,
    createSession,
    removeSession
  } = useChatManager();

  const [message, setMessage] = useState('');
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const term = searchTerm.toLowerCase();
    return sessions.filter((session) => {
      if (session.title.toLowerCase().includes(term)) return true;
      return session.messages.some((msg) => msg.content.toLowerCase().includes(term));
    });
  }, [sessions, searchTerm]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [message]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [activeSession?.messages.length, isTyping]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const platform = typeof navigator !== 'undefined' ? navigator.platform ?? '' : '';
      const isMac = /mac/i.test(platform);
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier) return;

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        setIsSidebarOpen(true);
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        const session = createSession();
        setMessage('');
        setIsEmojiOpen(false);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        setIsSidebarOpen(false);
        setActiveSessionId(session.id);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [createSession, setActiveSessionId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!isEmojiOpen) return;
      if (emojiPickerRef.current?.contains(target)) return;
      if (emojiButtonRef.current?.contains(target as Node)) return;
      setIsEmojiOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiOpen]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeSessionId]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage(message);
    setMessage('');
    setIsEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((prev) => prev + emoji);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const nextValue = message.slice(0, start) + emoji + message.slice(end);
    setMessage(nextValue);

    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    });
  };

  const handleTextareaKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.app}>
      <div className={clsx(styles.sidebarOverlay, { [styles.sidebarOverlayVisible]: isSidebarOpen })} onClick={() => setIsSidebarOpen(false)} />
      <div className={styles.layout}>
        <aside className={clsx(styles.sidebar, { [styles.sidebarOpen]: isSidebarOpen })} aria-label="Chat history sidebar">
          <div className={styles.sidebarContent}>
            <div className={styles.sidebarHeader}>
              <h2>History</h2>
              <button
                type="button"
                className={styles.newChatButton}
                onClick={() => {
                  const session = createSession();
                  setMessage('');
                  setIsEmojiOpen(false);
                  setActiveSessionId(session.id);
                }}
                aria-label="Start a new chat"
              >
                <PlusIcon width={18} height={18} />
              </button>
            </div>
            <div className={styles.searchBar}>
              <SearchIcon className={styles.searchIcon} />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search conversations"
                className={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search chat history"
              />
            </div>
            <div className={styles.historyList} role="list">
              {filteredSessions.length === 0 && (
                <p style={{ opacity: 0.6 }}>No conversations found.</p>
              )}
              {filteredSessions.map((session) => (
                <button
                  type="button"
                  role="listitem"
                  key={session.id}
                  className={clsx(styles.historyItem, session.id === activeSessionId && styles.historyItemActive)}
                  onClick={() => setActiveSessionId(session.id)}
                  aria-current={session.id === activeSessionId}
                >
                  <span className={styles.historyTitle}>{session.title || 'New Chat'}</span>
                  <span className={styles.historyMeta}>{formatHistoryMeta(session)}</span>
                  <button
                    type="button"
                    className={styles.historyDelete}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSession(session.id);
                    }}
                    aria-label="Delete conversation"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </button>
              ))}
            </div>
            <footer className={styles.profile}>
              <div className={styles.profileInfo}>
                <span className={styles.profileName}>Alex Morgan</span>
                <span className={styles.profileStatus}>Ready to assist</span>
              </div>
              <div className={styles.profileAvatar} aria-hidden="true">
                AM
              </div>
            </footer>
          </div>
        </aside>
        <section className={styles.chatWrapper}>
          <header className={styles.chatHeader}>
            <button className={styles.mobileMenuButton} type="button" onClick={() => setIsSidebarOpen((prev) => !prev)} aria-label="Toggle chat history">
              <MenuIcon width={20} height={20} />
            </button>
            <div>
              <strong>{activeSession?.title ?? 'New Chat'}</strong>
            </div>
            <div style={{ width: 40 }} aria-hidden="true" />
          </header>
          <div className={styles.chatArea} ref={chatScrollRef} role="log" aria-live="polite">
            {!activeSession || activeSession.messages.length === 0 ? (
              <div className={styles.emptyState}>
                <div>
                  <h1 style={{ marginBottom: 12 }}>Welcome to your local ChatGPT replica</h1>
                  <p style={{ maxWidth: 420, margin: '0 auto', opacity: 0.7 }}>
                    Start a conversation, and messages will be saved automatically to your browser. Use <strong>Ctrl/Cmd + N</strong> for a new chat and <strong>Ctrl/Cmd + K</strong> to search history.
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.messages}>
                {activeSession.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isTyping && (
                  <div className={styles.typingIndicator} role="status" aria-live="polite" aria-label="Assistant is typing">
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                    <span className={styles.typingDot} />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      <div className={styles.inputBar}>
        <form
          className={styles.inputArea}
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
          aria-label="Message input area"
        >
          <label htmlFor="chat-input" className={styles.srOnly}>
            Type your message
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            className={styles.textarea}
            placeholder="Send a message..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            aria-label="Type your message"
          />
          <div className={styles.inputActions}>
            <div style={{ position: 'relative' }}>
              <button
                ref={emojiButtonRef}
                type="button"
                className={styles.iconButton}
                onClick={() => setIsEmojiOpen((prev) => !prev)}
                aria-expanded={isEmojiOpen}
                aria-controls="emoji-picker"
                aria-label="Insert emoji"
              >
                <EmojiIcon width={20} height={20} />
              </button>
              {isEmojiOpen && (
                <div className={styles.emojiPicker} ref={emojiPickerRef} id="emoji-picker" role="dialog" aria-label="Emoji picker">
                  <div className={styles.emojiList}>
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji.symbol}
                        type="button"
                        className={styles.emojiItem}
                        onClick={() => handleEmojiSelect(emoji.symbol)}
                        aria-label={emoji.label}
                      >
                        <span role="img" aria-hidden="true">
                          {emoji.symbol}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button type="submit" className={clsx(styles.iconButton, styles.sendButton)} aria-label="Send message">
              <SendIcon width={18} height={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
