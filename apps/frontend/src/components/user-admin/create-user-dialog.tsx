'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { UserPlus, X, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { UserRole } from '@law-ai/shared';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (dto: { email: string; password?: string; fullName: string; role?: UserRole }) => Promise<boolean>;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateUserDialogProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.USER);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setFullName('');
      setEmail('');
      setPassword('');
      setRole(UserRole.USER);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || creating) return;
    
    setCreating(true);
    const success = await onSubmit({
      email: email.trim(),
      fullName: fullName.trim(),
      password: password.trim() || undefined,
      role,
    });
    setCreating(false);
    if (success) {
      onOpenChange(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <div
        aria-hidden
        onClick={() => !creating && onOpenChange(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-200"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container shadow-2xl shadow-black/60 animate-in fade-in-0 zoom-in-95 duration-200"
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
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tertiary/15 text-brand-tertiary">
              <UserPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="font-headline text-lg font-semibold leading-snug text-brand-on-surface">
                Thêm người dùng mới
              </h2>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Tạo tài khoản mới và gán vai trò tương ứng trong hệ thống.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullname">Họ và tên</Label>
              <Input
                id="fullname"
                ref={inputRef}
                placeholder="VD: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                required
                disabled={creating}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={100}
                required
                disabled={creating}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Mật khẩu (tùy chọn)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Để trống để tự động sinh mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={100}
                disabled={creating}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Vai trò</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                required
                disabled={creating}
                className="flex h-10 w-full rounded-md border border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 px-3 py-2 text-sm text-brand-on-surface focus-visible:border-brand-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-tertiary/30 disabled:cursor-not-allowed"
              >
                <option value={UserRole.USER}>Người dùng (User)</option>
                <option value={UserRole.LAWYER}>Luật sư (Lawyer)</option>
                <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
              </select>
            </div>
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
              disabled={creating || !fullName.trim() || !email.trim()}
              className="rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/50 disabled:translate-y-0 disabled:opacity-60"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang thêm…
                </span>
              ) : (
                'Thêm tài khoản'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
