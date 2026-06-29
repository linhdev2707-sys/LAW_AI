import { Metadata } from 'next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingFooter } from '@/components/landing/landing-footer';
import { Container } from '@/components/landing/container';
import { Button } from '@/components/ui/button';
import { ChatLink } from '@/components/landing/chat-link';

import { SOLUTIONS } from '@/data/solutions/solutions';
import { AUDIENCES } from '@/data/solutions/audiences';

export const metadata: Metadata = {
  title: 'Giải pháp | iLaw',
  description:
    'Các giải pháp AI pháp lý của iLaw dành cho cá nhân, doanh nghiệp và luật sư – trò chuyện, tra cứu, soạn thảo và phân tích hợp đồng.',
};

export default function SolutionsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <LandingNavbar />

      <main className="relative pt-32 pb-24">
        {/* Soft radial backdrop glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />

        <Container className="relative z-10 max-w-5xl">
          {/* Header */}
          <div className="mb-14 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-brand-tertiary">
              <Sparkles className="h-3.5 w-3.5" />
              Giải pháp
            </div>
            <h1 className="mt-4 font-headline text-3xl font-bold leading-tight tracking-tight sm:text-4xl text-brand-on-surface">
              Giải pháp AI pháp lý cho mọi đối tượng
            </h1>
            <div className="beam-gradient h-1 w-24 rounded-full mt-6 mx-auto opacity-70" />
            <p className="mt-6 mx-auto max-w-2xl text-base md:text-lg leading-relaxed text-brand-on-surface-variant">
              iLaw cung cấp một bộ công cụ AI giúp bạn tiếp cận pháp luật nhanh hơn, dễ hiểu hơn –
              dù bạn là người dân, doanh nghiệp hay chuyên gia pháp lý.
            </p>
          </div>

          {/* Solutions grid */}
          <div className="mb-16 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {SOLUTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group glass-card relative overflow-hidden rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-tertiary/40 hover:shadow-xl hover:shadow-brand-tertiary/10"
                >
                  <div className="mb-4">
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-lg`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                  </div>
                  <h2 className="font-headline text-lg font-bold text-brand-on-surface">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-brand-on-surface-variant">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Audience section */}
          <div className="mb-14">
            <h2 className="mb-6 text-center font-headline text-2xl font-bold text-brand-on-surface">
              Phù hợp với ai?
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {AUDIENCES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-brand-outline-variant/15 bg-white/[0.02] p-5 text-center transition-colors hover:border-brand-tertiary/40"
                  >
                    <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-tertiary/10 text-brand-tertiary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-headline text-base font-bold text-brand-on-surface">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-brand-on-surface-variant">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-primary/50"
            >
              <ChatLink className="inline-flex items-center gap-2">
                Trải nghiệm miễn phí
                <ArrowRight className="h-4 w-4" />
              </ChatLink>
            </Button>
          </div>
        </Container>
      </main>

      <LandingFooter />
    </div>
  );
}
