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

  async function handleSelectPlan(plan: PricingPlan) {
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
        body: { planId: plan.id },
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
        toast.info('Hệ thống chưa nhận được khoản chuyển. Vui lòng đợi trong giây lát hoặc nhấp kiểm tra lại sau.');
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

        <Container className="relative z-10">
          <PricingHeader />

          {/* Pricing Plans grid */}
          <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                loading={loadingCheckout}
                isCurrent={
                  session?.user?.subscriptionPlan === plan.id ||
                  (plan.id === 'free' && (!session?.user?.subscriptionPlan || session?.user?.subscriptionPlan === 'free'))
                }
                onSelect={handleSelectPlan}
              />
            ))}
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
          onClose={handleCloseModal}
          onConfirm={handleConfirmPayment}
          onCopy={handleCopy}
        />
      )}

      <LandingFooter />
    </div>
  );
}
