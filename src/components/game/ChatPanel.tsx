import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessageDto } from '../../../shared/types.ts';
import { Avatar } from '../common/Avatar.tsx';

interface ChatPanelProps {
  messages: ChatMessageDto[];
  currentUserId: string;
  disabled?: boolean;
  onSend: (message: string) => Promise<void>;
}

const MAX_LENGTH = 500;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function ChatPanel({ messages, currentUserId, disabled = false, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    setError(null);
    try {
      await onSend(trimmed);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-label="Match chat"
      className="flex h-[460px] flex-col rounded-xl border border-white/10 bg-[#101524] lg:h-[540px]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-display text-sm font-semibold text-slate-100">Match Chat</h2>
        <span className="text-xs text-slate-400">Participants only</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-500">
            <p>No messages yet.</p>
            <p className="mt-1">Say good luck to your opponent.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse text-right' : ''}`}
              >
                <Avatar avatarId={msg.senderAvatar} username={msg.senderUsername} size="xs" />
                <div className={`min-w-0 max-w-[80%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`mb-1 flex items-center gap-2 text-xs text-slate-400 ${
                      isMine ? 'justify-end' : ''
                    }`}
                  >
                    <span className="font-medium text-slate-300">{msg.senderUsername}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px] tabular-nums">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p
                    className={`break-words rounded-lg px-3 py-2 text-left text-sm leading-relaxed ${
                      isMine
                        ? 'bg-indigo-600/25 text-slate-100 border border-indigo-500/30'
                        : 'bg-[#161D31] text-slate-200 border border-white/10'
                    }`}
                  >
                    {/* Rendered strictly as plain text (FR-CHAT-04) */}
                    {msg.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
        {error && (
          <p className="mb-2 text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LENGTH}
            disabled={disabled || sending}
            placeholder={disabled ? 'Reconnect to chat...' : 'Type a message...'}
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#080B14] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || sending || draft.trim().length === 0}
            aria-label="Send message"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1.5 flex justify-end text-[11px] font-mono text-slate-500 tabular-nums">
          {draft.length}/{MAX_LENGTH}
        </div>
      </form>
    </section>
  );
}
