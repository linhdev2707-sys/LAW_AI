import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from './container';

export function CtaSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      {/* Decorative cyan glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-tertiary/10 blur-[140px]" />

      <Container className="relative z-10">
        <div className="glass-card flex flex-col items-center gap-16 rounded-xl p-10 shadow-2xl shadow-brand-tertiary/10 md:p-16 lg:flex-row">
          <div className="lg:w-1/2">
            <h2 className="mb-6 font-headline text-headline-lg font-medium leading-tight text-brand-on-surface">
              Sẵn sàng nâng tầm đội ngũ pháp lý của bạn với sức mạnh của trí tuệ nhân tạo?
            </h2>
            <p className="mb-10 text-lg text-brand-on-surface-variant md:text-body-lg">
              Cùng các công ty luật hàng đầu thế giới định nghĩa lại những gì có thể trong hành nghề luật hiện đại.
            </p>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-8 py-4 font-label text-label-md font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-primary/50"
            >
              <Link href="/register">Yêu cầu quyền truy cập riêng</Link>
            </Button>
          </div>

          <div className="relative w-full lg:w-1/2">
            <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-xl bg-gradient-to-tr from-brand-tertiary/20 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-xl border border-brand-tertiary/20 bg-brand-surface-container shadow-lg">
              {/* Placeholder dashboard mock */}
              <div className="grid grid-cols-3 gap-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video rounded border border-brand-tertiary/15 bg-gradient-to-br from-brand-primary-container/60 to-brand-surface-container-low"
                  />
                ))}
              </div>
              <div className="border-t border-brand-tertiary/15 bg-brand-surface-container-low/60 p-4 font-mono text-xs text-brand-on-surface-variant">
                <p>
                  <span className="text-brand-tertiary">●</span> Vụ việc đã phân tích: 12.847 ·{' '}
                  <span className="text-brand-tertiary">●</span> Tiền lệ đã lập bản đồ: 1,2 triệu ·{' '}
                  <span className="text-brand-tertiary">●</span> Độ chính xác: 98,4%
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
