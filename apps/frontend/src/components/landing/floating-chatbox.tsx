'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Sparkles, ArrowRight, Minus, AlertCircle, Maximize2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { streamInternalChatMessage, type InternalHistoryMessage } from '@/lib/internal-chat';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  /** True khi đang stream, dùng để hiển thị caret nhấp nháy. */
  streaming?: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'ai',
    content:
      'Xin chào! Tôi là iLaw AI 👋 Hãy thử hỏi tôi bất kỳ câu hỏi pháp lý nào, ví dụ: "Thủ tục đăng ký kết hôn cần giấy tờ gì?"',
  },
];

const SUGGESTIONS = [
  'Hợp đồng thuê nhà hết hạn xử lý sao?',
  'Thủ tục đăng ký kết hôn?',
  'Quyền của người lao động khi bị sa thải?',
];

export function FloatingChatbox() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll xuống cuối khi có tin nhắn mới / streaming
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming, open]);

  // Hủy stream khi component unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    setError(null);
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Build history từ các message user/assistant gần nhất (tối đa 6 lượt = 12 msg)
    const history: InternalHistoryMessage[] = messages
      .filter((m) => !m.streaming && m.id !== 'welcome')
      .slice(-12)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    // Tạo message AI rỗng để stream vào
    const aiMsgId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', content: '', streaming: true }]);
    setStreaming(true);

    try {
      const ac = await streamInternalChatMessage(
        { content, history },
        {
          onDelta: ({ content: delta }) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + delta } : m)),
            );
          },
          onDone: () => {
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m)),
            );
          },
          onError: ({ message }) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, streaming: false, content: m.content || message } : m,
              ),
            );
            setError(message);
          },
        },
      );
      abortRef.current = ac;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại';
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false, content: message } : m)),
      );
      setError(message);
    } finally {
      setStreaming(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }

  return (
    <>
      {/* Nút bong bóng chat nổi (định vị ở góc dưới bên phải, z-[9999] để đảm bảo luôn ở trên cùng) */}
      <button
        type="button"
        onClick={() => {
          // eslint-disable-next-line no-console
          console.log('[FloatingChatbox] toggle, was:', open);
          setOpen((v) => !v);
          setMinimized(false);
        }}
        aria-label={open ? 'Đóng chat' : 'Mở chat thử'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '20px',
          zIndex: 9999,
        }}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-[9999px] bg-gradient-to-br from-brand-primary to-brand-tertiary text-white shadow-2xl shadow-brand-primary/40 transition-all duration-300 hover:scale-105 hover:shadow-brand-primary/60',
          open && 'rotate-90',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-[9999px] bg-brand-tertiary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-[9999px] bg-brand-tertiary ring-2 ring-brand-background" />
          </span>
        )}
      </button>

      {/* Khung chat */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '20px',
            zIndex: 9999,
          }}
          className={cn(
            'flex w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200',
            minimized ? 'h-14' : 'h-[min(560px,calc(100vh-8rem))]',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-brand-outline-variant/15 bg-gradient-to-r from-brand-primary/15 to-brand-tertiary/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[9999px] bg-gradient-to-br from-brand-primary to-brand-tertiary text-white shadow-md">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-brand-on-surface">iLaw AI</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={status === 'authenticated' ? '/chat' : '/login?callbackUrl=/chat'}
                title="Mở trang chat đầy đủ"
                className="rounded p-1.5 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="rounded p-1.5 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!minimized && (
            <>
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-end gap-2',
                      m.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
                  >
                    {m.role === 'ai' && (
                      <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9999px] bg-gradient-to-br from-brand-primary to-brand-tertiary text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                        m.role === 'user'
                          ? 'rounded-br-sm bg-gradient-to-r from-brand-primary to-brand-tertiary text-white'
                          : 'rounded-bl-sm border border-brand-outline-variant/15 bg-brand-surface-container-low/80 text-brand-on-surface',
                      )}
                    >
                      {m.content}
                      {m.streaming && (
                        <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
                      )}
                    </div>
                  </div>
                ))}

                {/* Gợi ý câu hỏi khi mới mở (chỉ hiện khi chưa chat gì) */}
                {messages.length === 1 && !streaming && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] uppercase tracking-wider text-brand-on-surface-variant/70">
                      Gợi ý nhanh
                    </p>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSend(s)}
                        disabled={streaming}
                        className="block w-full rounded-xl border border-brand-outline-variant/20 bg-white/[0.02] px-3 py-2 text-left text-xs text-brand-on-surface transition-colors hover:border-brand-tertiary/40 hover:bg-brand-tertiary/5 hover:text-brand-tertiary disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2.5 text-xs text-red-200">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (streaming) handleStop();
                  else handleSend();
                }}
                className="border-t border-brand-outline-variant/15 bg-brand-surface-container-low/40 p-3"
              >
                <div className="flex items-center gap-2 rounded-[9999px] border border-brand-outline-variant/20 bg-brand-surface-container/80 px-3 py-1.5 focus-within:border-brand-tertiary/50 focus-within:ring-1 focus-within:ring-brand-tertiary/30">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={streaming ? 'AI đang trả lời...' : 'Hỏi iLaw điều gì đó...'}
                    disabled={streaming}
                    className="flex-1 bg-transparent text-sm text-brand-on-surface placeholder:text-brand-on-surface-variant/60 focus:outline-none disabled:opacity-50"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() && !streaming}
                    aria-label={streaming ? 'Dừng' : 'Gửi'}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9999px] text-white transition-opacity disabled:opacity-40',
                      streaming
                        ? 'bg-red-500/80 hover:bg-red-500'
                        : 'bg-gradient-to-r from-brand-primary to-brand-tertiary',
                    )}
                  >
                    {streaming ? (
                      <span className="h-2.5 w-2.5 rounded-sm bg-white" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-center text-[11px] text-brand-on-surface/80">
                  iLaw có thể sai, vui lòng kiểm tra lại thông tin.
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
