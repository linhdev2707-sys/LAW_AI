import { Button } from '@/components/ui/button';
import { Container } from './container';
import { MaterialIcon } from './material-icon';

interface Expert {
  name: string;
  role: string;
  rating: number;
  ratingLabel: string;
  quote: string;
  avatar: string;
  initials: string;
}

const EXPERTS: Expert[] = [
  {
    name: 'Trần Văn Chính',
    role: 'Luật sư cao cấp - Tranh tụng',
    rating: 4.9,
    ratingLabel: '4.9/5',
    quote: 'Chuyên môn xuất sắc trong lĩnh vực luật doanh nghiệp.',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop',
    initials: 'NK',
  },
  {
    name: 'Bùi Anh Đạt',
    role: 'Chuyên gia Sở hữu trí tuệ',
    rating: 5.0,
    ratingLabel: '5.0/5',
    quote: 'Tư duy chiến lược sắc bén và tỉ mỉ đến từng chi tiết.',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=256&h=256&fit=crop',
    initials: 'TL',
  },
  {
    name: 'Cao Nguyễn Vũ',
    role: 'Chuyên gia Luật Công nghệ',
    rating: 4.8,
    ratingLabel: '4.8/5',
    quote: 'Người tiên phong trong các khuôn khổ pháp lý về AI.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop',
    initials: 'LM',
  },
];

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="mb-4 flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const isHalf = i === full && half;
        return (
          <MaterialIcon
            key={i}
            name={isHalf ? 'star_half' : 'star'}
            filled={!isHalf}
            className="text-[20px] text-brand-secondary drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]"
          />
        );
      })}
      <span className="ml-2 text-sm font-semibold text-brand-on-surface">
        {rating.toFixed(1)}/5
      </span>
    </div>
  );
}

export function ExpertsSection() {
  return (
    <section className="relative z-10 border-t border-brand-outline-variant/10 bg-brand-surface-container-low/40 py-24 md:py-32">
      <Container>
        <div className="mb-20 flex flex-col items-center text-center">
          <h2 className="mb-6 font-headline text-headline-lg font-medium text-brand-on-surface">
            Chuyên gia pháp lý hàng đầu
          </h2>
          <div className="beam-gradient h-1 w-24 rounded-full opacity-70" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {EXPERTS.map((e) => (
            <article
              key={e.name}
              className="glass-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-gradient-to-b from-brand-surface-container-high/40 to-brand-surface-container-low/40 p-8 text-center shadow-lg shadow-black/20 transition-all duration-500 hover:-translate-y-2 hover:border-brand-tertiary/60 hover:shadow-2xl hover:shadow-brand-tertiary/20"
            >
              {/* Decorative top accent */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary/60 to-transparent" />

              <div className="mb-6 h-32 w-32 overflow-hidden rounded-full border-2 border-brand-tertiary/50 bg-brand-surface-container p-1 shadow-lg shadow-brand-tertiary/20">
                <div
                  className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary font-headline text-3xl font-semibold text-white"
                  aria-label={e.name}
                >
                  {e.initials}
                </div>
              </div>
              <h3 className="mb-1 font-headline text-2xl text-brand-on-surface">{e.name}</h3>
              <p className="mb-4 font-label text-label-sm font-semibold uppercase tracking-widest text-brand-on-surface">
                {e.role}
              </p>
              <Stars rating={e.rating} />
              <p className="mb-8 mt-2 font-body text-body-md italic leading-relaxed text-brand-on-surface-variant">
                &ldquo;{e.quote}&rdquo;
              </p>
              <Button
                className="w-full rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-6 py-3 font-label text-label-md font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-primary/50"
              >
                Xem hồ sơ
                <MaterialIcon name="arrow_forward" className="ml-2 text-[18px]" />
              </Button>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
