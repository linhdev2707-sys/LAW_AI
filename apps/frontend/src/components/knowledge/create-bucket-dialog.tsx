'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Database, X, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { BUCKET_NAME_REGEX } from '@/hooks/use-rag-admin';

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (name: string) => Promise<boolean>;
}

export function CreateBucketDialog({ open, onOpenChange, onSubmit }: CreateBucketDialogProps) {
  const [bucketName, setBucketName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form + focus input when opened
  useEffect(() => {
    if (open) {
      setBucketName('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bucketName.trim() || creating) return;
    setCreating(true);
    const ok = await onSubmit(bucketName.trim());
    setCreating(false);
    if (ok) setBucketName('');
  }

  const valid = BUCKET_NAME_REGEX.test(bucketName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <div
        aria-hidden
        onClick={() => !creating && onOpenChange(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm duration-200 animate-in fade-in-0"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container shadow-2xl shadow-black/60 duration-200 animate-in fade-in-0 zoom-in-95"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
        />
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={creating}
          aria-label="Đóng"
          className="absolute right-3 top-3 rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tertiary/15 text-brand-tertiary">
              <Database className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="font-headline text-lg font-semibold leading-snug text-brand-on-surface">
                Tạo bucket R2 mới
              </h2>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Bucket sẽ được tạo trên R2 và dùng để chứa tài liệu. Tên phải là duy nhất trên toàn
                Cloudflare.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-bucket-name">Tên bucket</Label>
            <Input
              id="new-bucket-name"
              ref={inputRef}
              placeholder="law-ai-rag-civil-code-2015"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value.toLowerCase())}
              maxLength={63}
              required
              disabled={creating}
            />
            {bucketName && !valid && (
              <p className="text-xs text-amber-300">
                Tên phải 3-63 ký tự, chỉ gồm chữ thường, số và dấu gạch ngang, bắt đầu và kết thúc
                bằng chữ/số.
              </p>
            )}
            {valid && <p className="text-xs text-emerald-300">Tên hợp lệ.</p>}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={creating}
              className="rounded-lg border border-brand-outline-variant/30 bg-white/5 px-4 py-2 text-sm font-medium text-brand-on-surface transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!valid || creating}
              className="rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/50 disabled:translate-y-0 disabled:opacity-60"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tạo…
                </span>
              ) : (
                'Tạo bucket'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
