'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Accessible confirmation dialog.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Xoá cuộc trò chuyện?"
 *     description="Hành động này không thể hoàn tác."
 *     variant="danger"
 *     confirmLabel="Xoá"
 *     onConfirm={async () => { await chatApi.remove(id); }}
 *   />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  variant = 'default',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Close on Escape; focus cancel button on open so accidental Enter doesn't
  // trigger the destructive action.
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onOpenChange(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onOpenChange]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Caller is responsible for showing the error toast; keep the dialog
      // open so the user can retry or cancel.
    }
  }

  const isDanger = variant === 'danger';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-desc' : undefined}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => !loading && onOpenChange(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm duration-200 animate-in fade-in-0"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl shadow-black/60',
          'duration-200 animate-in fade-in-0 zoom-in-95',
          isDanger
            ? 'border-red-400/30 bg-brand-surface-container'
            : 'border-brand-tertiary/25 bg-brand-surface-container',
        )}
      >
        {/* Top accent line */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-px',
            isDanger
              ? 'bg-gradient-to-r from-transparent via-red-400/70 to-transparent'
              : 'bg-gradient-to-r from-transparent via-brand-tertiary to-transparent',
          )}
        />

        {/* Close (×) */}
        <button
          type="button"
          onClick={() => !loading && onOpenChange(false)}
          aria-label="Đóng"
          className="absolute right-3 top-3 rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface disabled:opacity-50"
          disabled={loading}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          {/* Icon + title */}
          <div className="mb-4 flex items-start gap-3">
            {isDanger && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="confirm-dialog-title"
                className="font-headline text-lg font-semibold leading-snug text-brand-on-surface"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="confirm-dialog-desc"
                  className="mt-1.5 text-sm leading-relaxed text-brand-on-surface-variant"
                >
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-lg border border-brand-outline-variant/30 bg-white/5 px-4 py-2 text-sm font-medium text-brand-on-surface transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all',
                'hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60',
                isDanger
                  ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/30 hover:shadow-lg hover:shadow-red-500/50'
                  : 'bg-gradient-to-r from-brand-primary to-brand-tertiary shadow-brand-primary/30 hover:shadow-lg hover:shadow-brand-primary/50',
              )}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Đang xử lý…
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based helper for one-off confirmations without managing state.
 * Returns a Promise<boolean>: true if confirmed, false if cancelled.
 *
 * NOTE: This is a low-level helper. Prefer the <ConfirmDialog> component
 * for normal use so you can customize title/description/variant per call.
 * This is kept for places that already use a hook-free API.
 */
export function useConfirm() {
  return (title: string, description?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // The actual UI is rendered by ConfirmDialog. useConfirm is here as
      // a placeholder for future ergonomic helpers. The sidebar uses
      // ConfirmDialog directly via state.
      resolve(window.confirm(description ? `${title}\n\n${description}` : title));
    });
  };
}
