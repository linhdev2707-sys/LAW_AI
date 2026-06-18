'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Container } from './container';
import { Sparkles, MessageCircle, Send, ShieldCheck, Clock, Zap } from 'lucide-react';

export function CtaSection() {
  const { status } = useSession();
  const chatHref = status === 'authenticated' ? '/chat' : '/login?callbackUrl=/chat';

  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      {/* Decorative cyan glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-tertiary/10 blur-[140px]" />

      <Container className="relative z-10">
        <div className="glass-card flex flex-col items-center gap-12 rounded-2xl p-8 shadow-2xl shadow-brand-tertiary/10 md:p-12 lg:flex-row lg:items-center lg:gap-16">
          {/* Left column: copy + CTA */}
          <div className="w-full text-center lg:w-1/2 lg:text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand-tertiary">
              <Sparkles className="h-3.5 w-3.5" />
              Trợ lý AI pháp luật
            </div>
            <h2 className="mb-5 font-headline text-3xl font-bold leading-tight text-brand-on-surface sm:text-4xl">
              Giải đáp thắc mắc pháp lý mỗi ngày một cách đơn giản
            </h2>
            <p className="mb-8 text-base text-brand-on-surface-variant md:text-lg">
              Từ thủ tục hành chính, giải thích hợp đồng đến vướng mắc thủ tục , pháp lý thường gặp.
              Trò chuyện ngay với iLaw để nhận câu trả lời nhanh chóng, chính xác.
            </p>

            {/* Quick benefits */}
            <ul className="mb-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-brand-on-surface-variant lg:justify-start">
              <li className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-tertiary" />
                Hỗ trợ 24/7
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-brand-tertiary" />
                Trả lời tức thì
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-tertiary" />
                Bảo mật tuyệt đối
              </li>
            </ul>

            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-8 py-6 text-sm font-bold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-primary/50"
            >
              <Link href={chatHref} className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Trò chuyện ngay
              </Link>
            </Button>
          </div>

          {/* Right column: chat preview */}
          <div className="relative w-full lg:w-1/2">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-gradient-to-tr from-brand-tertiary/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container shadow-xl">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-brand-outline-variant/15 bg-brand-surface-container-low/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-white">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-on-surface">iLaw AI</p>
                    <p className="flex items-center gap-1 text-[11px] text-brand-tertiary">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Đang hoạt động
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-tertiary">
                  BETA
                </span>
              </div>

              {/* Chat messages */}
              <div className="space-y-3 p-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2.5 text-sm text-white shadow-md">
                    Hợp đồng thuê nhà hết hạn nhưng chủ nhà không trả lại tiền đặt cọc thì xử lý thế
                    nào?
                  </div>
                </div>

                {/* AI reply */}
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-brand-outline-variant/15 bg-brand-surface-container-low/80 px-4 py-2.5 text-sm text-brand-on-surface">
                    <p className="mb-2">
                      Theo Điều 327, 335 Bộ luật Dân sự 2015, bên thuê có quyền yêu cầu hoàn trả
                      tiền đặt cọc khi hợp đồng kết thúc đúng hạn.
                    </p>
                    <p>
                      Bạn nên gửi văn bản yêu cầu hoàn cọc trong 30 ngày, nếu chủ nhà vẫn không trả
                      có thể khởi kiện tại Tòa án nhân dân cấp huyện.
                    </p>
                  </div>
                </div>

                {/* Source chip */}
                <div className="flex items-start gap-2 pl-9">
                  <span className="inline-flex items-center gap-1 rounded-md border border-brand-tertiary/30 bg-brand-tertiary/5 px-2 py-0.5 text-[10px] font-semibold text-brand-tertiary">
                    📄 BLDS 2015 · Điều 327
                  </span>
                </div>

                {/* User follow-up */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2.5 text-sm text-white shadow-md">
                    Mình có thể tự soạn đơn khởi kiện được không?
                  </div>
                </div>

                {/* Typing indicator */}
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="rounded-2xl rounded-tl-sm border border-brand-outline-variant/15 bg-brand-surface-container-low/80 px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-tertiary [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-tertiary [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-tertiary" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat input mock */}
              <div className="border-t border-brand-outline-variant/15 bg-brand-surface-container-low/40 p-3">
                <div className="flex items-center gap-2 rounded-full border border-brand-outline-variant/20 bg-brand-surface-container/80 px-4 py-2.5">
                  <span className="flex-1 truncate text-sm text-brand-on-surface-variant/70">
                    Đặt câu hỏi pháp lý của bạn...
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary text-white">
                    <Send className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
