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
    name: 'Jonathan Vance',
    role: 'Senior Litigation Partner',
    rating: 4.9,
    ratingLabel: '4.9/5',
    quote: 'Exceptional expertise in corporate law.',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&h=256&fit=crop',
    initials: 'JV',
  },
  {
    name: 'Elena Rodriguez',
    role: 'Intellectual Property Specialist',
    rating: 5.0,
    ratingLabel: '5.0/5',
    quote: 'Highly strategic and detail-oriented.',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=256&h=256&fit=crop',
    initials: 'ER',
  },
  {
    name: 'Marcus Chen',
    role: 'Technology Law Expert',
    rating: 4.8,
    ratingLabel: '4.8/5',
    quote: 'A true pioneer in AI legal frameworks.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop',
    initials: 'MC',
  },
];

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="mb-4 flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const isHalf = i === full && half;
        return (
          <MaterialIcon
            key={i}
            name={isHalf ? 'star_half' : 'star'}
            filled={!isHalf}
            className="text-[18px] text-brand-secondary"
          />
        );
      })}
      <span className="ml-1 text-sm font-medium text-brand-on-surface-variant">
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
            Top-Rated Legal Experts
          </h2>
          <div className="beam-gradient h-1 w-24 rounded-full opacity-70" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {EXPERTS.map((e) => (
            <article
              key={e.name}
              className="glass-card group flex flex-col items-center rounded-xl border border-brand-tertiary/15 p-8 text-center transition-all duration-500 hover:-translate-y-2 hover:border-brand-tertiary/40 hover:shadow-xl hover:shadow-brand-tertiary/10"
            >
              <div className="mb-6 h-32 w-32 overflow-hidden rounded-full border-2 border-brand-tertiary/30 bg-brand-surface-container p-1">
                <div
                  className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary font-headline text-3xl font-semibold text-white"
                  aria-label={e.name}
                >
                  {e.initials}
                </div>
              </div>
              <h3 className="mb-1 font-headline text-2xl text-brand-on-surface">{e.name}</h3>
              <p className="mb-4 font-label text-label-sm font-semibold uppercase tracking-widest text-brand-on-surface-variant">
                {e.role}
              </p>
              <Stars rating={e.rating} />
              <p className="mb-8 font-body text-body-md italic text-brand-on-surface-variant">
                &ldquo;{e.quote}&rdquo;
              </p>
              <Button
                variant="outline"
                className="w-full rounded-full border border-brand-tertiary/40 font-label text-label-md font-semibold text-brand-on-surface transition-all duration-300 hover:border-brand-tertiary hover:bg-brand-tertiary/10 hover:text-brand-tertiary"
              >
                View Profile
              </Button>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
