'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  disabled,
  loading,
  placeholder = 'Send a message…',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-background via-brand-background to-transparent pt-6">
      <div className="mx-auto max-w-3xl px-4 pb-6 md:px-6">
        <div
          className={cn(
            'relative flex items-end gap-2 rounded-xl border border-brand-tertiary/20 bg-brand-surface-container shadow-2xl shadow-black/40',
            'transition-colors focus-within:border-brand-tertiary/60',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'min-h-[44px] w-full resize-none bg-transparent px-4 py-3 pr-12 text-[15px] text-brand-on-surface placeholder:text-brand-on-surface-variant/60',
              'focus:outline-none disabled:opacity-50',
            )}
          />
          <div className="absolute bottom-2 right-2">
            {loading && onStop ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-brand-on-surface transition hover:bg-white/20"
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim() || disabled}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded transition',
                  value.trim() && !disabled
                    ? 'bg-gradient-to-r from-brand-primary to-brand-tertiary text-white shadow-lg shadow-brand-primary/30 hover:shadow-brand-primary/50'
                    : 'bg-white/10 text-brand-on-surface-variant/50',
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-brand-on-surface-variant/60">
          LAW AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
