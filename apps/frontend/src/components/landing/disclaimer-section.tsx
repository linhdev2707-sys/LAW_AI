import { Container } from './container';
import { MaterialIcon } from './material-icon';
import { DISCLAIMER_POINTS } from '@/data/landing/disclaimer';

export function DisclaimerSection() {
  return (
    <section
      id="disclaimer"
      aria-labelledby="disclaimer-heading"
      className="relative py-24 md:py-32"
    >
      {/* Soft warning backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_60%)]" />

      <Container className="relative">
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="font-label mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-label-md font-medium uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <MaterialIcon name="warning" className="text-[18px]" />
            Miễn trừ trách nhiệm
          </div>
          <h2
            id="disclaimer-heading"
            className="mb-6 font-headline text-headline-lg font-medium text-brand-on-surface"
          >
            Điều khoản sử dụng & giới hạn
          </h2>
          <div className="beam-gradient h-1 w-24 rounded-full opacity-70" />
          <p className="mt-8 max-w-3xl font-body text-body-md leading-relaxed text-brand-on-surface-variant">
            Trước khi sử dụng iLaw, vui lòng đọc kỹ các điều khoản miễn trừ trách nhiệm dưới đây.
            Bằng việc tiếp tục truy cập và sử dụng dịch vụ, bạn xác nhận đã hiểu và đồng ý với những
            giới hạn được nêu ra.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {DISCLAIMER_POINTS.map((point) => (
            <article
              key={point.title}
              className="glass-card flex h-full flex-col rounded-xl border-l-4 border-l-amber-500/60 p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                <MaterialIcon
                  name={point.icon}
                  className="text-[24px] text-amber-600 dark:text-amber-400"
                />
              </div>
              <h3 className="mb-3 font-headline text-headline-md font-medium text-brand-on-surface">
                {point.title}
              </h3>
              <p className="font-body text-body-md leading-relaxed text-brand-on-surface-variant">
                {point.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center font-body text-sm text-brand-on-surface-variant/80">
          Nếu bạn cần tư vấn cho vụ việc cụ thể, hãy liên hệ luật sư được cấp phép hành nghề tại
          Việt Nam. iLaw là công cụ hỗ trợ nghiên cứu, không phải dịch vụ hành nghề luật.
        </p>
      </Container>
    </section>
  );
}
