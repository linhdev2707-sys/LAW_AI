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
    const dismissed = localStorage.getItem('lawai.beta_dismissed');
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
    localStorage.setItem('lawai.beta_dismissed', 'true');
    setVisible(false);
  };

  const handleGoToFeedback = () => {
    localStorage.setItem('lawai.beta_dismissed', 'true');
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
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-200"
      />

      {/* Modal Content Panel */}
      <div
        className={cn(
          'relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border',
          'border-brand-primary/30 bg-brand-surface-container p-6 sm:p-8 shadow-2xl shadow-black/85',
          'animate-in fade-in-0 zoom-in-95 duration-200',
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
          className="absolute right-4 top-4 rounded-full p-1.5 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface transition-colors"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Body */}
        <div className="flex flex-col items-center text-center mt-4">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-primary/20 bg-brand-primary/10 text-brand-primary mb-5"
          >
            <Sparkles className="h-7 w-7 animate-pulse" />
          </span>

          <h2
            id="beta-popup-title"
            className="font-headline text-xl sm:text-2xl font-bold tracking-wide text-brand-on-surface"
          >
            iLaw đang thử nghiệm (Beta)
          </h2>

          <p
            id="beta-popup-desc"
            className="mt-4 text-sm sm:text-base leading-relaxed text-brand-on-surface-variant max-w-md"
          >
            Hệ thống đang hoạt động trong giai đoạn thử nghiệm (Beta) nên có thể phát sinh lỗi không mong muốn. 
            iLaw rất mong nhận được những đóng góp ý kiến của bạn để liên tục nâng cấp và hoàn thiện dịch vụ.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center w-full">
          <button
            type="button"
            onClick={handleDismiss}
            className="order-2 sm:order-1 flex items-center justify-center rounded-lg border border-brand-outline-variant/30 bg-white/[0.03] hover:bg-white/[0.07] px-6 py-3 text-sm font-semibold text-brand-on-surface transition-all active:scale-[0.98] cursor-pointer"
          >
            Để sau
          </button>
          
          <button
            type="button"
            onClick={handleGoToFeedback}
            className="order-1 sm:order-2 flex items-center justify-center rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-6 py-3 text-sm font-bold text-brand-surface-container-lowest shadow-lg shadow-brand-primary/20 transition-all hover:scale-[1.02] hover:shadow-brand-primary/40 active:scale-[0.98] cursor-pointer"
          >
            Đóng góp ý kiến
          </button>
        </div>
      </div>
    </div>
  );
}
