'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, ShieldCheck, ScrollText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDisclaimerGate } from '@/hooks/use-disclaimer-gate';

interface DisclaimerPoint {
  icon: 'info' | 'gavel' | 'shield' | 'lock';
  title: string;
  body: string;
}

const POINTS: DisclaimerPoint[] = [
  {
    icon: 'info',
    title: 'Không thay thế tư vấn pháp lý chuyên nghiệp',
    body: 'LAW AI cung cấp thông tin tham khảo dựa trên dữ liệu pháp lý và tiền lệ. Nội dung do hệ thống tạo ra KHÔNG cấu thành tư vấn pháp lý, ý kiến luật sư, hoặc khuyến nghị hành động cho vụ việc cụ thể của bạn.',
  },
  {
    icon: 'gavel',
    title: 'Cần xác minh với nguồn chính thức',
    body: 'Các văn bản pháp luật, án lệ và nghị định được hệ thống tổng hợp có thể đã được sửa đổi, bổ sung hoặc bãi bỏ. Bạn có trách nhiệm kiểm tra lại với cơ quan có thẩm quyền trước khi áp dụng.',
  },
  {
    icon: 'shield',
    title: 'Giới hạn trách nhiệm pháp lý',
    body: 'Chúng tôi không chịu trách nhiệm đối với bất kỳ thiệt hại nào phát sinh từ việc sử dụng hoặc không thể sử dụng thông tin do LAW AI cung cấp, kể cả trong bối cảnh tố tụng hoặc giao dịch pháp lý.',
  },
  {
    icon: 'lock',
    title: 'Bảo mật & quyền riêng tư',
    body: 'Vui lòng KHÔNG đưa vào hệ thống thông tin bí mật, dữ liệu cá nhân nhạy cảm, hoặc tài liệu thuộc diện bảo mật nghề nghiệp luật sư – khách hàng.',
  },
];

const ICONS = {
  info: ScrollText,
  gavel: AlertTriangle,
  shield: ShieldCheck,
  lock: AlertTriangle,
} as const;

/**
 * Modal dialog shown the first time a user enters the chat section. The
 * user must read the disclaimer, type their full name, tick the checkbox,
 * and click "Tôi đã hiểu và chấp nhận" before they can start chatting.
 *
 * Acceptance is stored in localStorage (versioned) so they only have to do
 * this once per browser, unless the disclaimer text changes (version bump).
 */
export function DisclaimerGate() {
  const { isOpen, accept } = useDisclaimerGate();
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState(false);
  const nameId = useId();
  const checkboxId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Autofocus the name input when the dialog opens so the user can start
  // typing immediately.
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Lock body scroll while open + close on Escape (we don't allow Escape to
  // dismiss without accepting, but it should still work as a no-op feedback).
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const nameTrimmed = fullName.trim();
  const isNameValid = nameTrimmed.length >= 2;
  const isFormValid = isNameValid && agreed;
  const showNameError = touched && !isNameValid;
  const showCheckboxError = touched && !agreed;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isFormValid) return;
    accept(nameTrimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-gate-title"
      aria-describedby="disclaimer-gate-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 sm:py-10"
    >
      {/* Backdrop — not clickable to dismiss; the user must accept to proceed. */}
      <div
        aria-hidden
        className="absolute inset-0 animate-in fade-in-0 bg-black/75 backdrop-blur-md duration-200"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={cn(
          'relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border',
          'border-amber-500/30 bg-brand-surface-container shadow-2xl shadow-black/70',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          'max-h-[calc(100vh-3rem)]',
        )}
      >
        {/* Top accent line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"
        />

        {/* Header */}
        <div className="flex items-start gap-4 border-b border-amber-500/15 px-6 py-5 sm:px-8">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-500"
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="disclaimer-gate-title"
              className="font-headline text-xl font-semibold text-brand-on-surface sm:text-2xl"
            >
              Miễn trừ trách nhiệm
            </h2>
            <p
              id="disclaimer-gate-desc"
              className="mt-1 text-sm leading-relaxed text-brand-on-surface-variant"
            >
              Trước khi bắt đầu trò chuyện với LAW AI, vui lòng đọc kỹ các điều khoản
              dưới đây và xác nhận bạn đã hiểu rõ.
            </p>
          </div>
          {/* No close (×) — the user must explicitly accept to proceed. */}
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
            <ul className="space-y-3">
              {POINTS.map((p) => {
                const Icon = ICONS[p.icon];
                return (
                  <li
                    key={p.title}
                    className="flex gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-label text-sm font-semibold uppercase tracking-wide text-brand-on-surface">
                        {p.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-brand-on-surface-variant">
                        {p.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Confirmation form */}
          <div className="border-t border-amber-500/15 bg-black/20 px-6 py-5 sm:px-8">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={nameId}
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant"
                >
                  Họ và tên <span className="text-amber-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  id={nameId}
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                  className={cn(
                    'w-full rounded-lg border bg-brand-surface-container-lowest px-3.5 py-2.5 text-sm text-brand-on-surface',
                    'placeholder:text-brand-on-surface-variant/40 focus:outline-none focus:ring-2',
                    showNameError
                      ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/30'
                      : 'border-brand-outline-variant/30 focus:border-amber-400 focus:ring-amber-400/30',
                  )}
                  aria-invalid={showNameError}
                  aria-describedby={showNameError ? `${nameId}-error` : undefined}
                />
                {showNameError && (
                  <p id={`${nameId}-error`} className="mt-1.5 text-xs text-red-300">
                    Vui lòng nhập họ và tên đầy đủ (ít nhất 2 ký tự).
                  </p>
                )}
              </div>

              <label
                htmlFor={checkboxId}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  showCheckboxError
                    ? 'border-red-400/50 bg-red-500/[0.06]'
                    : 'border-brand-outline-variant/25 bg-white/[0.03] hover:bg-white/[0.06]',
                )}
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-amber-500 accent-amber-500 focus:ring-2 focus:ring-amber-400/40"
                />
                <span className="text-sm leading-relaxed text-brand-on-surface-variant">
                  Tôi đã đọc, hiểu rõ và{' '}
                  <span className="font-semibold text-brand-on-surface">
                    đồng ý chấp nhận
                  </span>{' '}
                  toàn bộ điều khoản miễn trừ trách nhiệm nêu trên. Tôi hiểu rằng
                  LAW AI chỉ là công cụ hỗ trợ nghiên cứu, không thay thế luật
                  sư, và tôi sẽ tự chịu trách nhiệm về các quyết định pháp lý
                  của mình.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!isFormValid}
              className={cn(
                'mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold',
                'shadow-md transition-all',
                isFormValid
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/50'
                  : 'cursor-not-allowed bg-white/10 text-brand-on-surface-variant/50',
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Tôi đã hiểu và chấp nhận
            </button>

            <p className="mt-3 text-center text-[11px] text-brand-on-surface-variant/60">
              Xác nhận này sẽ được lưu trên trình duyệt này. Bạn chỉ cần thực
              hiện một lần cho đến khi nội dung miễn trừ được cập nhật.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Small utility export so other components (e.g. footer link) can re-open
 * the disclaimer dialog on demand, even after the user has accepted it.
 * Currently unused but kept for future "View disclaimer" affordance.
 */
export function DisclaimerTrigger() {
  return null;
}
