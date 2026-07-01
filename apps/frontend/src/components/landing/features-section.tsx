import { Container } from './container';
import { MaterialIcon } from './material-icon';

interface Feature {
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'forum',
    title: 'Trò chuyện cùng AI',
    description:
      'Trò chuyện cùng AI về các vấn đề pháp luật (hiện tại hệ thống hỗ trợ chuyên sâu hai lĩnh vực chính là Dân sự và Hình sự).',
  },
  {
    icon: 'find_in_page',
    title: 'Tra cứu văn bản pháp luật',
    description:
      'Bộ lọc thông minh vận hành bởi AI, tự động tìm kiếm, phân tích và chọn lọc các văn bản pháp lý phù hợp thay vì phải tự tra cứu thủ công.',
  },
  {
    icon: 'gavel',
    title: 'Liên kết với Luật sư',
    description:
      'Dễ dàng kết nối với Luật sư cho các sự vụ quan trọng hoặc các vụ việc phức tạp. Hệ thống chatbot sẽ tự động nhận diện và đưa ra khuyến nghị liên hệ luật sư.',
    badge: 'Đang phát triển',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      {/* Subtle radial backdrop for depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.18),transparent_60%)]" />

      <Container className="relative">
        <div className="mb-20 flex flex-col items-center text-center">
          <h2 className="mb-6 font-headline text-headline-lg font-medium text-brand-on-surface">
            iLaw giúp gì cho bạn?
          </h2>
          <div className="beam-gradient h-1 w-24 rounded-full opacity-70" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="glass-card group relative flex h-full flex-col rounded-xl p-10 transition-all duration-500 hover:-translate-y-2 hover:border-brand-tertiary/40 hover:shadow-2xl hover:shadow-brand-tertiary/10"
            >
              {f.badge && (
                <div className="absolute right-10 top-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-secondary animate-pulse" />
                    {f.badge}
                  </span>
                </div>
              )}

              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl border border-brand-tertiary/20 bg-gradient-to-br from-brand-primary-container to-brand-surface-container-low shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:border-brand-tertiary/60 group-hover:shadow-lg group-hover:shadow-brand-tertiary/20">
                <MaterialIcon
                  name={f.icon}
                  className="text-[32px] text-brand-tertiary"
                />
              </div>

              <h3 className="mb-4 font-headline text-headline-md font-medium text-brand-on-surface">
                {f.title}
              </h3>

              <p className="mb-8 font-body text-body-md leading-relaxed text-brand-on-surface-variant">
                {f.description}
              </p>

              {/* mt-auto pushes the link to the bottom of the card so all
                  three cards' CTAs sit on the same baseline even when the
                  heading/description lengths differ. */}
              {f.badge ? (
                <div className="mt-auto inline-flex items-center self-start font-label text-label-md text-brand-on-surface-variant/40 cursor-not-allowed select-none">
                  Tìm hiểu thêm
                  <MaterialIcon name="lock" className="ml-2 text-[18px] opacity-60" />
                </div>
              ) : (
                <a
                  href="#"
                  className="mt-auto inline-flex items-center self-start font-label text-label-md text-brand-tertiary transition-all duration-300 group-hover:gap-3 hover:text-brand-primary"
                >
                  Tìm hiểu thêm
                  <MaterialIcon name="arrow_forward" className="ml-2 text-[18px]" />
                </a>
              )}
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
