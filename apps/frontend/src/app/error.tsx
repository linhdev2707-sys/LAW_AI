'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console
    console.error('Dữ liệu lỗi hệ thống ứng dụng frontend:', error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-brand-background px-4 py-8 text-center text-brand-on-surface">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.12),transparent_60%)]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
          <AlertTriangle className="h-8 w-8 animate-pulse" />
        </div>

        <h2 className="mb-3 font-headline text-2xl font-bold tracking-tight">
          Không thể kết nối dịch vụ
        </h2>

        <p className="mb-6 text-sm leading-relaxed text-brand-on-surface-variant">
          Đã xảy ra sự cố kết nối với hệ thống máy chủ (Backend) hoặc lỗi xử lý giao diện. Vui lòng
          thử tải lại hoặc quay lại trang chủ.
        </p>

        {error.message && (
          <div className="mb-6 max-h-32 overflow-y-auto break-all rounded-lg border border-white/5 bg-black/40 p-3 text-left font-mono text-xs text-red-200/80">
            {error.name || 'Error'}: {error.message}
          </div>
        )}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => reset()}
            className="flex items-center gap-2 bg-brand-primary text-white hover:bg-brand-primary/95"
          >
            <RefreshCw className="h-4 w-4" />
            Tải lại
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-brand-outline-variant/30 text-brand-on-surface hover:bg-white/5"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Trang chủ
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
