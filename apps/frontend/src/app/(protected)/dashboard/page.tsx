'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { apiFetch, ApiError } from '@/lib/api';
import type { IUser } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<IUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const me = await apiFetch<IUser>('/api/v1/auth/me');
        setProfile(me);
      } catch (e) {
        if (e instanceof ApiError) setError(e.message);
        else setError('Không tải được hồ sơ');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  if (status === 'loading') {
    return (
      <main className="relative min-h-[60vh] overflow-hidden bg-brand-background text-brand-on-surface-variant">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]"
        />
        <div className="relative container py-12">Đang tải…</div>
      </main>
    );
  }

  return (
    <main className="relative h-full overflow-y-auto bg-brand-background text-brand-on-surface">
      {/* Soft cyan glow at the top — matches landing/chat backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.10),transparent_60%)]"
      />
      <div className="container relative py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bảng điều khiển</h1>
        <Button
          variant="outline"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="border-brand-outline-variant/30 text-brand-on-surface bg-white/5 hover:bg-white/10 hover:text-brand-tertiary transition-all"
        >
          Đăng xuất
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="max-w-xl glass-card border-brand-outline-variant/30 text-brand-on-surface">
        <CardHeader>
          <CardTitle className="text-brand-on-surface">Hồ sơ</CardTitle>
          <CardDescription className="text-brand-on-surface-variant">Thông tin tài khoản của bạn từ máy chủ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-brand-on-surface-variant">Đang tải hồ sơ…</p>
          ) : profile ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-brand-on-surface-variant">Họ tên</dt>
              <dd className="font-medium text-brand-on-surface">{profile.fullName}</dd>
              <dt className="text-brand-on-surface-variant">Email</dt>
              <dd className="font-medium text-brand-on-surface">{profile.email}</dd>
              <dt className="text-brand-on-surface-variant">Vai trò</dt>
              <dd className="font-medium text-brand-on-surface">{profile.role}</dd>
              <dt className="text-brand-on-surface-variant">Đang hoạt động</dt>
              <dd className="font-medium text-brand-on-surface">{profile.isActive ? 'Có' : 'Không'}</dd>
            </dl>
          ) : (
            <p className="text-brand-on-surface-variant">Không có dữ liệu hồ sơ</p>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
