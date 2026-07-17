'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BetaFeedbackPopup() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if user has already dismissed the popup
    const dismissed = sessionStorage.getItem('lawai.beta_dismissed');
    if (dismissed === 'true') {
      return;
    }

    // Trigger popup after 1.5s delay
    const timer = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const handleDismiss = () => {
    sessionStorage.setItem('lawai.beta_dismissed', 'true');
    setVisible(false);
  };

  const handleGoToFeedback = () => {
    sessionStorage.setItem('lawai.beta_dismissed', 'true');
    setVisible(false);
    router.push('/feedback');
  };

  // Prevent SSR flash/mismatch
  if (!mounted || !visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-popup-title"
      aria-describedby="beta-popup-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        aria-hidden="true"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm duration-200 animate-in fade-in-0"
      />

      {/* Modal Content Panel */}
      <div
        className={cn(
          'relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border',
          'border-brand-primary/30 bg-brand-surface-container p-6 shadow-2xl shadow-black/85 sm:p-8',
          'duration-200 animate-in fade-in-0 zoom-in-95',
        )}
      >
        {/* Top accent glow line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-primary via-brand-tertiary to-brand-secondary"
        />

        {/* Close Button (X) */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Body */}
        <div className="mt-4 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-primary/20 bg-brand-primary/10 text-brand-primary"
          >
            <Sparkles className="h-7 w-7 animate-pulse" />
          </span>

          <h2
            id="beta-popup-title"
            className="font-headline text-xl font-bold tracking-wide text-brand-on-surface sm:text-2xl"
          >
            iLaw đang thử nghiệm (Beta)
          </h2>

          <p
            id="beta-popup-desc"
            className="mt-4 max-w-md text-sm leading-relaxed text-brand-on-surface-variant sm:text-base"
          >
            Hệ thống đang hoạt động trong giai đoạn thử nghiệm (Beta) nên có thể phát sinh lỗi không
            mong muốn. iLaw rất mong nhận được những đóng góp ý kiến của bạn để liên tục nâng cấp và
            hoàn thiện dịch vụ.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleDismiss}
            className="order-2 flex cursor-pointer items-center justify-center rounded-lg border border-brand-outline-variant/30 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-brand-on-surface transition-all hover:bg-white/[0.07] active:scale-[0.98] sm:order-1"
          >
            Để sau
          </button>

          <button
            type="button"
            onClick={handleGoToFeedback}
            className="order-1 flex cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-6 py-3 text-sm font-bold text-brand-surface-container-lowest shadow-lg shadow-brand-primary/20 transition-all hover:scale-[1.02] hover:shadow-brand-primary/40 active:scale-[0.98] sm:order-2"
          >
            Đóng góp ý kiến
          </button>
        </div>
      </div>
    </div>
  );
}
