'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Send, Square, Paperclip, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const DEFAULT_MAX = 4000;

export function ChatInput({
  onSend,
  onStop,
  disabled,
  loading,
  placeholder = 'Nhập tin nhắn…',
  maxLength = DEFAULT_MAX,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

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
    onSend(trimmed);
    setValue('');
    setAttachedFile(null);
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handlePickFile(file: File | null) {
    setAttachedFile(file);
  }

  const canSend = value.trim().length > 0 && !disabled;
  const remaining = maxLength - value.length;
  const isNearLimit = remaining < 200;
  const isOverLimit = remaining < 0;

  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-background via-brand-background/95 to-transparent pt-8">
      <div className="mx-auto max-w-3xl px-4 pb-4 md:px-6">
        {/* Attached file chip */}
        {attachedFile && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-tertiary/30 bg-brand-surface-container px-3 py-2 text-sm text-brand-on-surface">
            <Paperclip className="h-4 w-4 text-brand-tertiary" />
            <span className="flex-1 truncate">{attachedFile.name}</span>
            <span className="text-xs text-brand-on-surface-variant">
              {(attachedFile.size / 1024).toFixed(1)} KB
            </span>
            <button
              type="button"
              onClick={() => handlePickFile(null)}
              className="rounded p-0.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
              aria-label="Bỏ đính kèm"
            >
              ×
            </button>
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
          {/* Hidden file input (placeholder for future file-upload feature) */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.txt"
          />

          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Đính kèm tài liệu (sắp ra mắt)"
            aria-label="Đính kèm tài liệu"
            className="ml-2 mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-tertiary disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={disabled}
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

        {/* Footer row: char counter + tip + disclaimer */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-brand-on-surface-variant/60">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Nhấn <kbd className="rounded border border-brand-outline-variant/30 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> để gửi, <kbd className="rounded border border-brand-outline-variant/30 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Shift + Enter</kbd> để xuống dòng
            </span>
            <span className="flex items-center gap-1 sm:hidden">
              <kbd className="rounded border border-brand-outline-variant/30 bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> gửi
            </span>
          </div>
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
          LAW AI có thể mắc sai sót · Vui lòng kiểm chứng các thông tin quan trọng
        </p>
      </div>
    </div>
  );
}
