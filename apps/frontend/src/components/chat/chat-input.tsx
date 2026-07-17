'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModePicker } from './mode-picker';
import type { ChatMode } from '@law-ai/shared';

interface ChatInputProps {
  onSend: (content: string, mode: ChatMode) => void;
  onStop?: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  maxLength?: number;
  /**
   * Currently selected chat mode. The ChatInput renders a `ModePicker`
   * so the user can change it before sending. The page owns this state
   * and persists it across renders / sessions via localStorage.
   */
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  /**
   * If provided, the input is force-disabled while `isBlocked` is true
   * and a countdown banner is shown above the textarea. The hook that
   * drives this is `useRateLimit` (typically via `useConversationStream`).
   */
  rateLimit?: {
    isBlocked: boolean;
    secondsRemaining: number;
  };
}

const DEFAULT_MAX = 4000;

export function ChatInput({
  onSend,
  onStop,
  disabled,
  loading,
  placeholder = 'Nhập tin nhắn…',
  maxLength = DEFAULT_MAX,
  mode,
  onModeChange,
  rateLimit,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem('tour:mode-picker:dismissed');
      if (dismissed !== 'true') {
        setShowTour(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const dismissTour = () => {
    try {
      window.localStorage.setItem('tour:mode-picker:dismissed', 'true');
    } catch {
      // ignore
    }
    setShowTour(false);
  };

  // Auto-grow textarea up to a max height.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  // Focus on mount so the user can type immediately.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || loading) return;
    if (rateLimit?.isBlocked) return;
    onSend(trimmed, mode);
    setValue('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isRateLimited = rateLimit?.isBlocked ?? false;
  const canSend = value.trim().length > 0 && !disabled && !isRateLimited;
  const remaining = maxLength - value.length;
  const isNearLimit = remaining < 200;
  const isOverLimit = remaining < 0;
  const effectivePlaceholder = isRateLimited ? `Đang chờ hết giới hạn tốc độ…` : placeholder;

  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-background via-brand-background/95 to-transparent pt-8">
      <div className="mx-auto max-w-3xl px-4 pb-4 md:px-6">
        {/* Rate-limit banner — shown above the input while the BE has
            429'd us. Auto-clears when the countdown reaches 0. */}
        {isRateLimited && rateLimit && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Bạn đang gửi quá nhanh. Vui lòng đợi{' '}
              <span className="font-mono font-semibold">{rateLimit.secondsRemaining}s</span> trước
              khi gửi tin nhắn tiếp theo.
            </span>
          </div>
        )}

        <div
          className={cn(
            'relative flex items-end gap-2 rounded-2xl border bg-brand-surface-container shadow-2xl shadow-black/40 transition-colors',
            isOverLimit
              ? 'border-red-400/60 focus-within:border-red-400'
              : 'border-brand-tertiary/25 focus-within:border-brand-tertiary/60',
          )}
        >
          {/* Mode picker onboarding tutorial tooltip */}
          {showTour && (
            <div className="absolute bottom-[52px] left-2 z-40 w-72 rounded-xl border border-brand-primary/30 bg-brand-surface-container-high p-4 shadow-xl shadow-black/50 duration-300 animate-in fade-in-0 slide-in-from-bottom-2">
              {/* Small downward pointing arrow */}
              <div className="absolute bottom-[-6px] left-[14px] h-3 w-3 rotate-45 border-b border-r border-brand-primary/30 bg-brand-surface-container-high" />

              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-headline text-xs font-bold uppercase tracking-wider text-brand-primary">
                    💡 Chế Độ Trả Lời AI
                  </h4>
                </div>
                <p className="font-body text-xs leading-relaxed text-brand-on-surface-variant">
                  Nhấp vào đây để chuyển đổi chế độ phản hồi của AI phù hợp với nhu cầu của bạn:
                </p>
                <ul className="space-y-1 font-body text-[11px] text-brand-on-surface-variant/80">
                  <li className="flex items-center gap-1.5">
                    <span className="font-bold text-brand-on-surface">⚡ Nhanh</span>: Trò chuyện
                    phản hồi tức thì
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="font-bold text-brand-on-surface">🧠 Sâu</span>: Lập luận chi
                    tiết (Admin)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="font-bold text-brand-on-surface">📖 Tra cứu</span>: Chỉ trích
                    dẫn điều luật gốc
                  </li>
                </ul>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={dismissTour}
                    className="rounded bg-brand-primary px-2.5 py-1 font-body text-[11px] font-bold text-white shadow transition-all hover:bg-brand-primary/95"
                  >
                    Tôi đã hiểu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mode picker — replaces the (previously disabled) paperclip
              attachment button. Selecting a mode here only affects the
              NEXT message; the page owns the state. */}
          <ModePicker
            value={mode}
            onChange={onModeChange}
            disabled={disabled || loading || isRateLimited}
          />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={effectivePlaceholder}
            disabled={disabled || isRateLimited}
            rows={1}
            maxLength={maxLength + 100 /* allow over so user can see error */}
            className={cn(
              'min-h-[44px] w-full resize-none bg-transparent px-2 py-3 pr-12 text-[15px] text-brand-on-surface placeholder:text-brand-on-surface-variant/60',
              'focus:outline-none disabled:opacity-50',
            )}
          />

          {/* Send / Stop button */}
          <div className="absolute bottom-2 right-2">
            {loading && onStop ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-brand-on-surface transition hover:bg-white/20"
                aria-label="Dừng tạo"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend || isOverLimit}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                  canSend && !isOverLimit
                    ? 'bg-gradient-to-r from-brand-primary to-brand-tertiary text-white shadow-lg shadow-brand-primary/30 hover:shadow-brand-primary/50'
                    : 'bg-white/10 text-brand-on-surface-variant/50',
                )}
                aria-label="Gửi tin nhắn"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer row: char counter */}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 px-1 text-xs text-brand-on-surface-variant/60">
          <div className="flex items-center gap-3">
            {isOverLimit && (
              <span className="flex items-center gap-1 text-red-300">
                <AlertCircle className="h-3 w-3" />
                Vượt quá {Math.abs(remaining)} ký tự
              </span>
            )}
            {isNearLimit && !isOverLimit && (
              <span className="text-amber-300">Còn {remaining} ký tự</span>
            )}
            <span>
              {value.length}/{maxLength}
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-1 text-center text-[11px] text-brand-on-surface-variant/50">
          iLaw có thể mắc sai sót · Vui lòng kiểm chứng các thông tin quan trọng
        </p>
      </div>
    </div>
  );
}
