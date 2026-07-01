'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { apiFetch, ApiError } from '@/lib/api';
import type { IUser } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  User,
  Mail,
  Shield,
  CheckCircle,
  Calendar,
  Zap,
  Loader2,
  LogOut,
  LayoutDashboard,
  Lock,
} from 'lucide-react';
import { UserRole } from '@law-ai/shared';

export default function DashboardPage() {
  const { data: session, status, update } = useSession();
  const [profile, setProfile] = useState<IUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = session?.user?.role === UserRole.ADMIN;

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const me = await apiFetch<IUser>('/api/v1/auth/me');
        setProfile(me);
      } catch (e) {
        if (e instanceof ApiError) setError(e.message);
        else setError('Không tải được thông tin hồ sơ');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
    }
  }, [profile]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Vô thời hạn';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getPlanGradient = (planId: string | undefined) => {
    switch (planId?.toLowerCase()) {
      case 'premium':
        return 'from-amber-400 to-amber-600 text-amber-950';
      case 'pro':
        return 'from-sky-400 to-brand-primary text-sky-950';
      case 'basic':
        return 'from-emerald-400 to-emerald-600 text-emerald-950';
      default:
        return 'from-slate-600 to-slate-800 text-slate-100';
    }
  };

  const getPlanName = (planId: string | undefined) => {
    switch (planId?.toLowerCase()) {
      case 'premium':
        return 'Gói Pro';
      case 'pro':
        return 'Gói Plus';
      case 'basic':
        return 'Gói Cơ bản';
      default:
        return 'Gói Miễn phí';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (password && password.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await apiFetch<IUser>(`/api/v1/users/${profile.id}`, {
        method: 'PATCH',
        body: {
          fullName,
          password: password || undefined,
        },
      });

      setProfile(updatedUser);
      setPassword('');
      setConfirmPassword('');

      // Update next-auth session name dynamically
      await update({
        name: updatedUser.fullName,
      });

      toast.success('Cập nhật thông tin tài khoản thành công!');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Cập nhật thất bại';
      toast.error('Lỗi cập nhật', { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="relative min-h-[60vh] overflow-hidden bg-brand-background text-brand-on-surface-variant">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.22),transparent_60%)]"
        />
        <div className="relative flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full overflow-y-auto bg-brand-background text-brand-on-surface">
      {/* Cyan gradient glow overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,229,255,0.22),transparent_60%)]"
      />

      <div className="container relative max-w-5xl px-6 py-10">
        {/* Upper toolbar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-outline-variant/30 bg-brand-surface-container/60 px-3 py-1 text-xs font-semibold tracking-wider uppercase text-brand-on-surface">
            <LayoutDashboard className="h-3.5 w-3.5 text-brand-primary" />
            Tài khoản của tôi
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="border-brand-outline-variant/30 text-brand-on-surface bg-white/5 hover:bg-white/10 hover:text-brand-tertiary transition-all gap-2"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            {error}
          </div>
        )}

        {/* Dashboard Content Grid */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left: Update Profile Form (2 columns) */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/30 p-6 md:p-8 shadow-xl">
              <h3 className="text-xl font-bold text-brand-on-surface flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-brand-primary" />
                Cập nhật thông tin tài khoản
              </h3>
              <p className="text-xs text-brand-on-surface-variant/80 mb-6">
                Chỉnh sửa họ tên hiển thị và thay đổi mật khẩu đăng nhập của bạn.
              </p>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                  {/* Họ tên */}
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">
                      Họ và tên
                    </label>
                    <Input
                      id="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 text-brand-on-surface focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30 h-11 rounded-xl"
                      placeholder="Nhập họ và tên..."
                    />
                  </div>

                  {/* Email (Disabled) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/60 flex items-center gap-1.5">
                      Địa chỉ Email
                      <span className="text-[10px] text-brand-on-surface-variant/40 font-normal lowercase">(không thể thay đổi)</span>
                    </label>
                    <Input
                      type="email"
                      disabled
                      value={profile?.email || ''}
                      className="border-brand-outline-variant/15 bg-white/[0.02] text-brand-on-surface-variant/60 h-11 rounded-xl cursor-not-allowed opacity-60"
                    />
                  </div>

                  <div className="border-t border-brand-outline-variant/10 my-6 pt-6 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-secondary flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Thay đổi mật khẩu (Để trống nếu không đổi)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mật khẩu mới */}
                      <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">
                          Mật khẩu mới
                        </label>
                        <Input
                          id="password"
                          type="password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 text-brand-on-surface focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30 h-11 rounded-xl"
                          placeholder="Tối thiểu 6 ký tự..."
                        />
                      </div>

                      {/* Xác nhận mật khẩu mới */}
                      <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">
                          Xác nhận mật khẩu
                        </label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 text-brand-on-surface focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30 h-11 rounded-xl"
                          placeholder="Nhập lại mật khẩu mới..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-brand-outline-variant/10">
                  <Button
                    type="submit"
                    disabled={isSaving || !fullName.trim()}
                    className="bg-gradient-to-r from-brand-primary to-brand-tertiary font-semibold text-white px-6 h-11 rounded-xl hover:-translate-y-0.5 transition-all shadow-md gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Lưu thay đổi
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Info Panels (1 column) */}
          <div className="space-y-6">
            {/* Subscription Box */}
            <div className="glass-card relative overflow-hidden rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/40 p-6 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">
                Gói dịch vụ hiện tại
              </h3>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 bg-gradient-to-br ${getPlanGradient(profile?.subscriptionPlan)} shadow-md shrink-0`}>
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold uppercase text-brand-on-surface tracking-wide">
                      {getPlanName(profile?.subscriptionPlan)}
                    </h4>
                    <p className="text-xs text-brand-on-surface-variant">
                      Trạng thái: <span className="font-semibold text-emerald-400">Hoạt động</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-brand-outline-variant/10 pt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand-on-surface-variant/70 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Hạn sử dụng:
                  </span>
                  <span className="font-bold text-brand-on-surface">
                    {formatDate(profile?.subscriptionExpiresAt)}
                  </span>
                </div>
              </div>

              {profile?.subscriptionPlan === 'free' && (
                <div className="mt-6">
                  <Link href="/pricing" className="w-full">
                    <Button className="w-full gap-2 bg-gradient-to-r from-brand-secondary to-amber-500 font-semibold text-black hover:-translate-y-0.5 transition-all shadow-md text-xs">
                      <Zap className="h-4 w-4" />
                      Nâng cấp Hội viên Pro
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Panel (Read-only metadata) */}
            <div className="glass-card rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/20 p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80 pb-3 border-b border-brand-outline-variant/10">
                Thông tin hệ thống
              </h3>

              <div className="mt-4 space-y-4">
                {/* Role */}
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand-secondary" />
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-brand-on-surface-variant/60">Quyền hạn</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      profile?.role === 'admin'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {profile?.role || 'user'}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-brand-on-surface-variant/60">Trạng thái tài khoản</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
                      Đang hoạt động
                    </span>
                  </div>
                </div>

                {/* Created At */}
                {profile?.createdAt && (
                  <div className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-brand-on-surface-variant/60">Ngày tạo tài khoản</p>
                      <p className="text-xs font-semibold text-brand-on-surface">
                        {new Date(profile.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

