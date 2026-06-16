'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingFooter } from '@/components/landing/landing-footer';
import { Container } from '@/components/landing/container';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Check,
  QrCode,
  TrendingUp,
  X,
  ShieldCheck,
  Copy,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Zap,
  Award,
  Plus,
  Minus,
} from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceVal: number;
  period: string;
  description: string;
  features: string[];
  isPopular?: boolean;
}

const PLANS: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Cơ bản',
    price: '69.000',
    priceVal: 69000,
    period: 'tháng',
    description: 'Giải pháp trò chuyện pháp luật cơ bản cho cá nhân.',
    features: [
      'Trò chuyện hỏi đáp pháp lý cùng AI',
      'Hỗ trợ chuyên sâu Dân sự & Hình sự',
      'Giới hạn 100 câu hỏi mỗi tháng',
      'Tốc độ trả lời tiêu chuẩn',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '109.000',
    priceVal: 109000,
    period: 'tháng',
    description: 'Hỗ trợ đắc lực cho soạn thảo, nghiên cứu và phân tích văn bản.',
    features: [
      'Không giới hạn số lượt hỏi đáp',
      'Bộ lọc AI tra cứu văn bản pháp luật',
      'Trợ lý soạn thảo đơn từ & biểu mẫu mẫu',
      'Phân tích hợp đồng và phát hiện rủi ro',
      'Ưu tiên xử lý nhanh từ hệ thống AI',
    ],
    isPopular: true,
  },
  {
    id: 'premium',
    name: 'Cao cấp',
    price: '149.000',
    priceVal: 149000,
    period: 'tháng',
    description: 'Trải nghiệm tối đa, phù hợp cho người có nhu cầu làm việc cường độ cao.',
    features: [
      'Toàn bộ tính năng của gói Pro',
      'Hỗ trợ đính kèm và phân tích tài liệu dung lượng lớn',
      'Truy cập sớm các tính năng AI mới phát triển',
      'Hỗ trợ kỹ thuật VIP 24/7 riêng biệt',
      'Tùy chỉnh cấu hình Prompt cá nhân hóa',
    ],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function handleSelectPlan(plan: PricingPlan) {
    setSelectedPlan(plan);
    setPaymentSuccess(false);
    setConfirming(false);
  }

  function handleCopy(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    toast.success('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopiedText(null), 2000);
  }

  function handleConfirmPayment() {
    setConfirming(true);
    // Simulate payment verification process
    setTimeout(() => {
      setConfirming(false);
      setPaymentSuccess(true);
      toast.success('Thanh toán thành công!', {
        description: `Chúc mừng bạn đã nâng cấp thành công gói ${selectedPlan?.name}!`,
      });
    }, 2000);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <LandingNavbar />

      <main className="relative pt-32 pb-24">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />

        <Container className="relative z-10">
          {/* Header Section */}
          <div className="mb-16 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-4 py-1.5 font-label text-label-md font-medium uppercase tracking-widest text-brand-tertiary">
              <TrendingUp className="h-4 w-4" />
              Bảng giá & Cơ cấu Chi phí
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-brand-on-surface sm:text-4xl md:text-5xl max-w-3xl leading-tight">
              Mô hình giá minh bạch & vận hành tinh gọn
            </h1>
            <div className="beam-gradient mt-6 h-1 w-24 rounded-full opacity-70" />
            <p className="mx-auto mt-6 max-w-2xl font-body text-base text-brand-on-surface-variant md:text-lg">
              Chúng tôi tối ưu hóa chi phí cố định để mang lại dịch vụ trợ lý pháp lý AI chất lượng cao với chi phí dễ tiếp cận nhất cho mọi người dân.
            </p>
          </div>

          {/* Pricing Plans - Full Width */}
          <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`glass-card relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
                  plan.isPopular
                    ? 'border-2 border-brand-primary bg-gradient-to-b from-brand-primary/10 to-brand-surface-container-high/80 shadow-2xl shadow-brand-primary/20 md:-translate-y-4 md:scale-[1.02]'
                    : 'border border-brand-outline-variant/20 bg-brand-surface-container-low/40 hover:-translate-y-1 hover:border-brand-tertiary/40'
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
                    <Sparkles className="h-3 w-3" />
                    Phổ biến nhất
                  </span>
                )}

                {/* Plan icon + name */}
                <div className="mb-5 flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                      plan.isPopular
                        ? 'bg-gradient-to-br from-brand-primary to-brand-tertiary text-white'
                        : 'border border-brand-tertiary/30 bg-brand-tertiary/10 text-brand-tertiary'
                    }`}
                  >
                    {plan.id === 'basic' && '🌱'}
                    {plan.id === 'pro' && '⚡'}
                    {plan.id === 'premium' && '👑'}
                  </span>
                  <h3 className="font-headline text-xl font-bold text-brand-on-surface">{plan.name}</h3>
                </div>

                <p className="mb-6 min-h-[44px] text-sm text-brand-on-surface-variant leading-relaxed">
                  {plan.description}
                </p>

                {/* Price block */}
                <div
                  className={`mb-7 rounded-xl p-4 ${
                    plan.isPopular
                      ? 'bg-white/5 ring-1 ring-brand-primary/30'
                      : 'bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0">
                    <span className="font-headline text-4xl font-extrabold text-brand-tertiary">
                      {plan.price}
                    </span>
                    <span className="text-sm font-semibold text-brand-on-surface-variant">VND</span>
                  </div>
                  <div className="mt-1 text-xs text-brand-on-surface-variant">
                    mỗi {plan.period}
                  </div>
                </div>

                <ul className="mb-8 flex-1 space-y-3 font-body text-sm text-brand-on-surface-variant">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          plan.isPopular
                            ? 'bg-brand-primary/20 text-brand-primary'
                            : 'bg-brand-tertiary/15 text-brand-tertiary'
                        }`}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-brand-primary to-brand-tertiary text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/50'
                      : 'border border-brand-outline-variant/30 bg-white/5 text-brand-on-surface hover:bg-brand-tertiary/10 hover:border-brand-tertiary/50 hover:text-brand-tertiary'
                  }`}
                >
                  Chọn gói {plan.name}
                </Button>
              </div>
            ))}
          </div>

          {/* Trust & Service row */}
          <div className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="glass-card flex items-center gap-3 rounded-xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-on-surface">Bảo mật SSL</p>
                <p className="text-xs text-brand-on-surface-variant">Mã hóa đầu cuối an toàn</p>
              </div>
            </div>
            <div className="glass-card flex items-center gap-3 rounded-xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tertiary/10 text-brand-tertiary">
                <Zap className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-on-surface">Kích hoạt tức thì</p>
                <p className="text-xs text-brand-on-surface-variant">Tự động ngay sau chuyển khoản</p>
              </div>
            </div>
            <div className="glass-card flex items-center gap-3 rounded-xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Award className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-on-surface">Đổi trả 7 ngày</p>
                <p className="text-xs text-brand-on-surface-variant">Hoàn tiền nếu không hài lòng</p>
              </div>
            </div>
          </div>

          {/* Coming Soon + FAQ Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Coming Soon Card */}
            <div className="lg:col-span-5">
              <div className="glass-card relative h-full overflow-hidden rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-7">
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-secondary/10 blur-3xl" />

                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 text-2xl">
                      ⚖️
                    </span>
                    <div>
                      <h2 className="font-headline text-lg font-bold text-brand-on-surface">
                        Kết nối Luật sư
                      </h2>
                      <p className="text-xs text-brand-on-surface-variant">
                        Tính năng mở rộng trong tương lai
                      </p>
                    </div>
                  </div>

                  <p className="mb-5 text-sm leading-relaxed text-brand-on-surface-variant">
                    Kết nối trực tiếp với đội ngũ Luật sư đối tác uy tín để được tư vấn chuyên sâu
                    và hỗ trợ giải quyết hồ sơ pháp lý thực tế.
                  </p>

                  <ul className="mb-6 space-y-2.5 text-sm text-brand-on-surface-variant">
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-secondary" />
                      <span>Mạng lưới Luật sư được xác minh</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-secondary" />
                      <span>Tư vấn 1-1 theo lĩnh vực chuyên môn</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-secondary" />
                      <span>Hỗ trợ soạn thảo & đại diện pháp lý</span>
                    </li>
                  </ul>

                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Đang phát triển
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: FAQ */}
            <div className="lg:col-span-7">
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tertiary/10 text-brand-tertiary">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <h2 className="font-headline text-xl font-bold text-brand-on-surface">
                  Câu hỏi thường gặp
                </h2>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: 'Tôi có thể hủy gói bất kỳ lúc nào không?',
                    a: 'Có, bạn có thể hủy gói bất kỳ lúc nào trong phần Cài đặt tài khoản. Gói sẽ còn hiệu lực đến hết chu kỳ đã thanh toán.',
                  },
                  {
                    q: 'Có được hoàn tiền nếu không hài lòng?',
                    a: 'Chúng tôi hỗ trợ hoàn tiền 100% trong vòng 7 ngày đầu tiên nếu bạn chưa sử dụng quá 20% quota của gói.',
                  },
                  {
                    q: 'Tôi có thể nâng cấp hoặc hạ gói giữa chừng không?',
                    a: 'Được, bạn có thể nâng cấp bất kỳ lúc nào và phần chênh lệch sẽ được tính theo tỷ lệ thời gian sử dụng còn lại.',
                  },
                  {
                    q: 'Phương thức thanh toán nào được hỗ trợ?',
                    a: 'Hiện tại hỗ trợ chuyển khoản ngân hàng nội địa qua mã VietQR, sẽ sớm tích hợp thêm thẻ Visa, Momo và ZaloPay.',
                  },
                ].map((item, idx) => (
                  <FaqItem key={idx} question={item.q} answer={item.a} />
                ))}
              </div>
            </div>
          </div>
        </Container>
      </main>

      {/* Checkout Modal Overlay */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedPlan(null)}
          />

          {/* Modal Panel */}
          <div className="glass-card relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            {paymentSuccess ? (
              // Success View
              <div className="py-6 text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-brand-on-surface">Kích hoạt thành công!</h3>
                  <p className="mt-2 text-sm text-brand-on-surface-variant">
                    Tài khoản của bạn đã được nâng cấp thành công lên gói <strong>{selectedPlan.name}</strong>. Vui lòng vào chat để trải nghiệm ngay.
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
                    onClick={() => setSelectedPlan(null)}
                    variant="ghost"
                    className="flex-1 rounded-xl border border-brand-outline-variant/30 py-3 text-xs font-bold"
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            ) : (
              // Payment QR/Transfer View
              <div className="space-y-5">
                <div>
                  <h3 className="font-headline text-lg font-bold text-brand-on-surface">Thanh toán chuyển khoản</h3>
                  <p className="text-xs text-brand-on-surface-variant">Quét mã QR qua ứng dụng ngân hàng của bạn để thanh toán tự động.</p>
                </div>

                {/* Plan detail summary */}
                <div className="rounded-xl border border-brand-outline-variant/20 bg-white/[0.02] p-4 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-brand-on-surface font-semibold">Gói {selectedPlan.name}</span>
                    <span className="block text-xs text-brand-on-surface-variant">Thời hạn sử dụng: 1 tháng</span>
                  </div>
                  <div className="text-right">
                    <span className="font-headline font-bold text-brand-secondary text-lg">{selectedPlan.price}</span>
                    <span className="ml-1 text-sm font-semibold text-brand-on-surface-variant">VND</span>
                  </div>
                </div>

                {/* QR Code Placeholder Box */}
                <div className="flex flex-col items-center justify-center border border-brand-outline-variant/20 rounded-xl bg-white p-4">
                  <div className="relative h-44 w-44">
                    {/* Generates a dynamic clean QR code mockup using an online service or styled representation */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        `2|99|00020101021238580010A00000072701240006970422011005273766020208QRIB11010303VND53037045406${selectedPlan.priceVal}5802VN62150811ILAW${selectedPlan.id.toUpperCase()}6304`
                      )}`}
                      alt="VietQR code thanh toan"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-semibold tracking-wider uppercase text-slate-500 flex items-center gap-1">
                    <QrCode className="h-3 w-3" />
                    VietQR · Chuyển khoản nhanh 247
                  </p>
                </div>

                {/* Transfer Info */}
                <div className="space-y-2 text-xs font-body text-brand-on-surface-variant">
                  <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
                    <span>Ngân hàng</span>
                    <span className="font-semibold text-brand-on-surface flex items-center gap-1">
                      Techcombank (TCB)
                      <button onClick={() => handleCopy('Techcombank', 'bank')} className="p-0.5 text-brand-tertiary hover:bg-white/5 rounded">
                        <Copy className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
                    <span>Số tài khoản</span>
                    <span className="font-semibold text-brand-on-surface flex items-center gap-1 font-mono">
                      19039988776601
                      <button onClick={() => handleCopy('19039988776601', 'acc')} className="p-0.5 text-brand-tertiary hover:bg-white/5 rounded">
                        <Copy className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
                    <span>Chủ tài khoản</span>
                    <span className="font-semibold text-brand-on-surface">CONG TY CONG NGHE ILAW</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-outline-variant/10 pb-2">
                    <span>Số tiền</span>
                    <span className="font-semibold text-brand-secondary font-mono">
                      {selectedPlan.price}
                      <span className="ml-1 text-xs text-brand-on-surface-variant">VND</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Nội dung chuyển khoản</span>
                    <span className="font-semibold text-brand-on-surface flex items-center gap-1 font-mono uppercase bg-brand-surface-container-highest px-2 py-0.5 rounded border border-brand-outline-variant/30 text-[11px]">
                      {`ILAW ${selectedPlan.name.toUpperCase()} ${session?.user?.email ? session.user.email.split('@')[0] : 'GUEST'}`}
                      <button
                        onClick={() =>
                          handleCopy(
                            `ILAW ${selectedPlan.name.toUpperCase()} ${session?.user?.email ? session.user.email.split('@')[0] : 'GUEST'}`,
                            'desc'
                          )
                        }
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
                    onClick={handleConfirmPayment}
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
                    onClick={() => setSelectedPlan(null)}
                    variant="ghost"
                    className="flex-1 rounded-xl border border-brand-outline-variant/30 py-3 text-xs font-bold"
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`glass-card overflow-hidden rounded-xl border transition-all ${
        open
          ? 'border-brand-tertiary/40 bg-brand-surface-container-low/70'
          : 'border-brand-outline-variant/20 bg-brand-surface-container-low/40 hover:border-brand-outline-variant/40'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-brand-on-surface">{question}</span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all ${
            open
              ? 'border-brand-tertiary bg-brand-tertiary/15 text-brand-tertiary'
              : 'border-brand-outline-variant/30 text-brand-on-surface-variant'
          }`}
        >
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm leading-relaxed text-brand-on-surface-variant">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
