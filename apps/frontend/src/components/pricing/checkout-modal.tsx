'use client';

import Link from 'next/link';
import Image from 'next/image';
import { X, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { PricingPlan } from '@/data/pricing/plans';

export interface BankDetails {
  bankId: string;
  accountNo: string;
  accountName: string;
  amount: number;
}

interface CheckoutModalProps {
  plan: PricingPlan;
  bankDetails: BankDetails | null;
  transferContent: string | null;
  transactionCode: string | null;
  qrUrl: string | null;
  paymentSuccess: boolean;
  confirming: boolean;
  durationMonths: number;
  onClose: () => void;
  onConfirm: () => void;
  onCopy: (text: string, type: string) => void;
}

/**
 * Modal shown after the user selects a paid plan. Renders the VietQR code,
 * transfer info, copy buttons, and either the payment or success view.
 *
 * Visual structure and copy are kept identical to the original inline
 * implementation in `app/pricing/page.tsx`.
 */
export function CheckoutModal({
  plan,
  bankDetails,
  transferContent,
  transactionCode,
  qrUrl,
  paymentSuccess,
  confirming,
  durationMonths,
  onClose,
  onConfirm,
  onCopy,
}: CheckoutModalProps) {
  const fallbackQr = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    `2|99|00020101021238580010A00000072701240006970422011005273766020208QRIB11010303VND53037045406${plan.priceVal}5802VN62150811iLaw${plan.id.toUpperCase()}6304`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="glass-card relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        {paymentSuccess ? (
          <SuccessView planName={plan.name} onClose={onClose} />
        ) : (
          <PaymentView
            plan={plan}
            bankDetails={bankDetails}
            transferContent={transferContent}
            transactionCode={transactionCode}
            qrUrl={qrUrl ?? fallbackQr}
            confirming={confirming}
            durationMonths={durationMonths}
            onClose={onClose}
            onConfirm={onConfirm}
            onCopy={onCopy}
          />
        )}
      </div>
    </div>
  );
}

function SuccessView({ planName, onClose }: { planName: string; onClose: () => void }) {
  return (
    <div className="py-6 text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <div>
        <h3 className="font-headline text-xl font-bold text-brand-on-surface">Kích hoạt thành công!</h3>
        <p className="mt-2 text-sm text-brand-on-surface-variant">
          Tài khoản của bạn đã được nâng cấp thành công lên gói <strong>{planName}</strong>. Vui lòng vào chat để trải nghiệm ngay.
        </p>
      </div>
      <div className="pt-4 flex gap-3">
        <Button
          asChild
          className="flex-1 rounded-xl bg-gradient-to-r from-brand-primary to-brand-tertiary py-3 text-xs font-bold text-white"
        >
          <Link href="/chat">Vào phòng chat ngay</Link>
        </Button>
        <Button
          onClick={onClose}
          variant="ghost"
          className="flex-1 rounded-xl border border-brand-outline-variant/30 py-3 text-xs font-bold"
        >
          Đóng
        </Button>
      </div>
    </div>
  );
}

interface PaymentViewProps {
  plan: PricingPlan;
  bankDetails: BankDetails | null;
  transferContent: string | null;
  transactionCode: string | null;
  qrUrl: string;
  confirming: boolean;
  durationMonths: number;
  onClose: () => void;
  onConfirm: () => void;
  onCopy: (text: string, type: string) => void;
}

function PaymentView({
  plan,
  bankDetails,
  transferContent,
  transactionCode,
  qrUrl,
  confirming,
  durationMonths,
  onClose,
  onConfirm,
  onCopy,
}: PaymentViewProps) {
  // The original page uses session-stripped email when neither a transfer
  // content nor a transaction code is provided. We don't have direct access
  // to the session here, so the page passes a precomputed fallback in
  // `transferContent` instead — see the page for the composition.
  const fallbackDesc = transferContent || transactionCode || '';

  const bankId = bankDetails?.bankId || 'MB';
  const accountNo = bankDetails?.accountNo || '935275401';
  const accountName = bankDetails?.accountName || 'NGUYEN VAN NHAT LINH';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-headline text-lg font-bold text-brand-on-surface">Thanh toán chuyển khoản</h3>
        <p className="text-xs text-brand-on-surface-variant">Quét mã QR qua ứng dụng ngân hàng của bạn để thanh toán tự động.</p>
      </div>

      {/* Plan detail summary */}
      <div className="rounded-xl border border-brand-outline-variant/20 bg-white/[0.02] p-4 flex justify-between items-center text-sm">
        <div>
          <span className="text-brand-on-surface font-semibold">Gói {plan.name}</span>
          <span className="block text-xs text-brand-on-surface-variant">Thời hạn sử dụng: {durationMonths} tháng</span>
        </div>
        <div className="text-right">
          <span className="font-headline font-bold text-brand-secondary text-lg">
            {bankDetails?.amount ? bankDetails.amount.toLocaleString('vi-VN') : plan.price}
          </span>
          <span className="ml-1 text-sm font-semibold text-brand-on-surface-variant">VND</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-80 w-80 overflow-hidden rounded-xl bg-white p-2">
          <Image
            src={qrUrl}
            alt="VietQR code thanh toan"
            fill
            sizes="320px"
            // QR code is generated binary — next/image optimization
            // (AVIF/WebP, srcset) cannot help and would just round-trip
            // through the optimizer. Pass through.
            unoptimized
            className="object-contain"
          />
        </div>
      </div>

      {/* Transfer Info */}
      <div className="space-y-2 text-xs font-body text-brand-on-surface-variant">
        <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
          <span>Ngân hàng</span>
          <span className="font-semibold text-brand-on-surface flex items-center gap-1">
            {bankId}
            <button onClick={() => onCopy(bankId, 'bank')} className="p-0.5 text-brand-tertiary hover:bg-white/5 rounded">
              <Copy className="h-3 w-3" />
            </button>
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
          <span>Số tài khoản</span>
          <span className="font-semibold text-brand-on-surface flex items-center gap-1 font-mono">
            {accountNo}
            <button onClick={() => onCopy(accountNo, 'acc')} className="p-0.5 text-brand-tertiary hover:bg-white/5 rounded">
              <Copy className="h-3 w-3" />
            </button>
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
          <span>Chủ tài khoản</span>
          <span className="font-semibold text-brand-on-surface">{accountName}</span>
        </div>
        <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
          <span>Số tiền</span>
          <span className="font-semibold text-brand-secondary font-mono">
            {bankDetails?.amount ? bankDetails.amount.toLocaleString('vi-VN') : plan.price}
            <span className="ml-1 text-xs text-brand-on-surface-variant">VND</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Nội dung chuyển khoản</span>
          <span className="font-semibold text-brand-on-surface flex items-center gap-1 font-mono uppercase bg-brand-surface-container-highest px-2 py-0.5 rounded border border-brand-outline-variant/30 text-[11px]">
            {fallbackDesc}
            <button
              onClick={() => onCopy(fallbackDesc, 'desc')}
              className="p-0.5 text-brand-tertiary hover:bg-white/5 rounded"
            >
              <Copy className="h-3 w-3" />
            </button>
          </span>
        </div>
        <p className="text-[10px] text-brand-tertiary text-center pt-1">
          Chú ý: Hãy ghi đúng nội dung để hệ thống nhận diện và kích hoạt tự động.
        </p>
      </div>

      {/* Confirm Action */}
      <div className="pt-2 flex gap-3">
        <Button
          onClick={onConfirm}
          disabled={confirming}
          className="flex-1 rounded-xl bg-gradient-to-r from-brand-primary to-brand-tertiary py-3 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 disabled:opacity-50"
        >
          {confirming ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
              Đang đối soát...
            </span>
          ) : (
            'Xác nhận đã chuyển khoản'
          )}
        </Button>
        <Button
          onClick={onClose}
          variant="ghost"
          className="flex-1 rounded-xl border border-brand-outline-variant/30 py-3 text-xs font-bold"
        >
          Đóng
        </Button>
      </div>
    </div>
  );
}

/**
 * Toast helper used by the parent page. Re-exported here so the page can
 * stay decoupled from `sonner` for the copy-to-clipboard flow.
 */
export function notifyCopySuccess() {
  toast.success('Đã sao chép vào bộ nhớ tạm');
}
