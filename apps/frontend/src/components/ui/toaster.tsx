'use client';

/**
 * App-wide toast notifications.
 *
 * Wraps `sonner`'s `<Toaster />` with a dark theme that matches the
 * iLaw brand palette (navy surface + cyan accent). Import
 * `toast` from `sonner` and call:
 *
 *   import { toast } from 'sonner';
 *   toast.success('Đã lưu');
 *   toast.error('Có lỗi xảy ra');
 *   toast.info('Đang xử lý…');
 *   toast.loading('Đang tải');
 *   toast('Thông báo chung');
 *   toast.promise(fetchData(), { loading: '...', success: '...', error: '...' });
 */
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            'group toast bg-brand-surface-container/95 border border-brand-outline-variant/20 text-brand-on-surface shadow-2xl shadow-black/40 backdrop-blur-xl',
          description: 'text-brand-on-surface-variant/80',
          actionButton: 'bg-brand-tertiary text-white',
          cancelButton: 'bg-white/5 text-brand-on-surface-variant',
          success: 'border-emerald-400/40 [&>[data-icon]]:text-emerald-400',
          error: 'border-red-400/40 [&>[data-icon]]:text-red-400',
          info: 'border-cyan-400/40 [&>[data-icon]]:text-cyan-400',
          warning: 'border-amber-400/40 [&>[data-icon]]:text-amber-400',
        },
      }}
    />
  );
}
