'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { HelpCircle } from 'lucide-react';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingFooter } from '@/components/landing/landing-footer';
import { Container } from '@/components/landing/container';

import {
  PricingHeader,
  PlanCard,
  TrustRow,
  FaqItem,
  LawyerCtaCard,
  CheckoutModal,
  type BankDetails,
} from '@/components/pricing';
import { PLANS, type PricingPlan } from '@/data/pricing/plans';
import { FAQ_ITEMS } from '@/data/pricing/faq';

import { apiFetch } from '@/lib/api';

export default function PricingPage() {
  const { data: session, update } = useSession();

  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [transactionCode, setTransactionCode] = useState<string | null>(null);
  const [transferContent, setTransferContent] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);

  async function handleSelectPlan(plan: PricingPlan) {
    if (plan.id === 'free') return;
    if (!session) {
      toast.error('Vui lòng đăng nhập để nâng cấp gói hội viên');
      return;
    }
    setLoadingCheckout(true);
    try {
      const res = await apiFetch<{
        id: string;
        code: string;
        plan: string;
        amount: number;
        qrUrl: string;
        bankId: string;
        accountNo: string;
        accountName: string;
        transferContent: string;
      }>('/api/v1/payments/checkout', {
        method: 'POST',
        body: { planId: plan.id, durationMonths: selectedDuration },
      });

      setSelectedPlan(plan);
      setTransactionCode(res.code);
      setTransferContent(res.transferContent);
      setQrUrl(res.qrUrl);
      setBankDetails({
        bankId: res.bankId,
        accountNo: res.accountNo,
        accountName: res.accountName,
        amount: res.amount,
      });
      setPaymentSuccess(false);
      setConfirming(false);
    } catch (err: any) {
      toast.error(err.message || 'Không thể khởi tạo thanh toán');
    } finally {
      setLoadingCheckout(false);
    }
  }

  useEffect(() => {
    if (!selectedPlan || !transactionCode || paymentSuccess) return;

    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await apiFetch<{ code: string; status: string; paidAt: string | null }>(
          `/api/v1/payments/status/${transactionCode}`,
        );

        if (res.status === 'completed') {
          setPaymentSuccess(true);
          toast.success('Thanh toán thành công!', {
            description: `Chúc mừng bạn đã nâng cấp thành công gói ${selectedPlan.name}!`,
          });
          await update({
            subscriptionPlan: selectedPlan.id,
            subscriptionExpiresAt: res.paidAt
              ? new Date(new Date(res.paidAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
              : new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Lỗi khi kiểm tra trạng thái giao dịch:', err);
      }
    };

    intervalId = setInterval(checkStatus, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedPlan, transactionCode, paymentSuccess, update]);

  function handleCopy(text: string, _type: string) {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào bộ nhớ tạm');
  }

  async function handleConfirmPayment() {
    if (!transactionCode) return;
    setConfirming(true);
    try {
      const res = await apiFetch<{ code: string; status: string; paidAt: string | null }>(
        `/api/v1/payments/status/${transactionCode}`,
      );

      if (res.status === 'completed') {
        setPaymentSuccess(true);
        toast.success('Thanh toán thành công!', {
          description: `Chúc mừng bạn đã nâng cấp thành công gói ${selectedPlan?.name}!`,
        });
        await update({
          subscriptionPlan: selectedPlan?.id,
          subscriptionExpiresAt: res.paidAt
            ? new Date(new Date(res.paidAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : new Date().toISOString(),
        });
      } else {
        try {
          await apiFetch(`/api/v1/payments/status/${transactionCode}/confirm-transfer`, {
            method: 'POST',
          });
          toast.success('Đã gửi yêu cầu xác nhận thanh toán!', {
            description: 'Ban quản trị sẽ đối chiếu sao kê và kích hoạt tài khoản trong ít phút.',
          });
        } catch (confirmErr) {
          console.error('Failed to notify transfer confirmation:', confirmErr);
          toast.info('Hệ thống chưa nhận được khoản chuyển. Vui lòng đợi trong giây lát hoặc nhấp kiểm tra lại sau.');
        }
      }
    } catch (err: any) {
      toast.error('Đã có lỗi xảy ra khi kiểm tra trạng thái.');
    } finally {
      setConfirming(false);
    }
  }

  function handleCloseModal() {
    setSelectedPlan(null);
  }

  const fallbackTransferContent = selectedPlan
    ? `iLaw ${selectedPlan.name.toUpperCase()} ${
        session?.user?.email ? session.user.email.split('@')[0] : 'GUEST'
      }`
    : '';

  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <LandingNavbar />

      <main className="relative pt-32 pb-24">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />

        <Container className="relative z-10 max-w-[1600px]">
          <PricingHeader />

          {/* Promo banner */}
          <div className="relative mb-10 overflow-hidden rounded-2xl border border-brand-primary/25 bg-gradient-to-r from-brand-primary/10 via-brand-tertiary/10 to-brand-primary/10 px-6 py-5 shadow-lg backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/20 text-brand-primary">
                  <span className="text-xl">🔥</span>
                </span>
                <div>
                  <h3 className="font-headline font-bold text-brand-on-surface text-base sm:text-lg">
                    Khuyến mãi đặc biệt: Tiết kiệm đến 50%
                  </h3>
                  <p className="text-sm text-brand-on-surface-variant mt-0.5">
                    Giảm ngay <strong className="text-brand-primary">20%</strong> cho gói 3 tháng, <strong className="text-brand-primary">30%</strong> cho gói 6 tháng, và lên đến <strong className="text-brand-primary">50%</strong> cho gói 1 năm!
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-brand-primary/10 px-4 py-1.5 text-xs font-semibold text-brand-primary border border-brand-primary/20">
                Ưu đãi đăng ký dài hạn
              </div>
            </div>
          </div>

          {/* Duration Selector Tabs */}
          <div className="mb-10 flex justify-center">
            <div className="inline-flex rounded-xl bg-brand-surface-container-lowest/80 p-1 border border-brand-outline-variant/20 shadow-inner">
              {[
                { label: '1 Tháng', val: 1 },
                { label: '3 Tháng (-20%)', val: 3 },
                { label: '6 Tháng (-30%)', val: 6 },
                { label: '1 Năm (-50%)', val: 12 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSelectedDuration(opt.val)}
                  className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                    selectedDuration === opt.val
                      ? 'bg-brand-primary text-white shadow-md'
                      : 'text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Plans grid */}
          <div className="mb-12 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              let discountMultiplier = 1.0;
              if (selectedDuration === 3) {
                discountMultiplier = 0.8;
              } else if (selectedDuration === 6) {
                discountMultiplier = 0.7;
              } else if (selectedDuration === 12) {
                discountMultiplier = 0.5;
              }
              const computedVal = Math.round(plan.priceVal * selectedDuration * discountMultiplier);
              const customPlan: PricingPlan = {
                ...plan,
                price: plan.id === 'free' ? '0' : computedVal.toLocaleString('vi-VN'),
                period: plan.id === 'free' ? 'tháng' : (selectedDuration === 12 ? 'năm' : `${selectedDuration} tháng`),
              };
              return (
                <PlanCard
                  key={plan.id}
                  plan={customPlan}
                  loading={loadingCheckout}
                  isCurrent={
                    session?.user?.subscriptionPlan === plan.id ||
                    (plan.id === 'free' && (!session?.user?.subscriptionPlan || session?.user?.subscriptionPlan === 'free'))
                  }
                  onSelect={handleSelectPlan}
                />
              );
            })}
          </div>

          <TrustRow />

          {/* Coming Soon + FAQ Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Coming Soon Card */}
            <div className="lg:col-span-5">
              <LawyerCtaCard />
            </div>

            {/* Right: FAQ */}
            <div className="lg:col-span-7">
              <h2 className="mb-5 flex items-center gap-2.5 font-headline text-xl font-bold text-brand-on-surface">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tertiary/10 text-brand-tertiary">
                  <HelpCircle className="h-5 w-5" />
                </span>
                Câu hỏi thường gặp
              </h2>

              <div className="space-y-3">
                {FAQ_ITEMS.map((item, idx) => (
                  <FaqItem key={idx} item={item} />
                ))}
              </div>
            </div>
          </div>
        </Container>
      </main>

      {selectedPlan && (
        <CheckoutModal
          plan={selectedPlan}
          bankDetails={bankDetails}
          transferContent={transferContent ?? fallbackTransferContent}
          transactionCode={transactionCode}
          qrUrl={qrUrl}
          paymentSuccess={paymentSuccess}
          confirming={confirming}
          durationMonths={selectedDuration}
          onClose={handleCloseModal}
          onConfirm={handleConfirmPayment}
          onCopy={handleCopy}
        />
      )}

      <LandingFooter />
    </div>
  );
}
