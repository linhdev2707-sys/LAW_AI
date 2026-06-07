import { Container } from './container';
import { MaterialIcon } from './material-icon';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'manage_search',
    title: 'AI Research',
    description:
      'Automate complex case law searches across decades of precedents. Our neural engine identifies subtle legal correlations human researchers might overlook.',
  },
  {
    icon: 'contract_edit',
    title: 'Contract Analysis',
    description:
      'Instant risk detection in multi-thousand-page documents. LAW AI flags inconsistencies, liabilities, and opportunities in seconds, not days.',
  },
  {
    icon: 'query_stats',
    title: 'Case Strategy',
    description:
      'Predictive insights for high-stakes litigation. Leverage historical judge data and opposing counsel tactics to build an invincible legal offensive.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      {/* Subtle radial backdrop for depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.06),transparent_60%)]" />

      <Container className="relative">
        <div className="mb-20 flex flex-col items-center text-center">
          <h2 className="mb-6 font-headline text-headline-lg font-medium text-brand-on-surface">
            Elite Intelligence Modules
          </h2>
          <div className="beam-gradient h-1 w-24 rounded-full opacity-70" />
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="glass-card group rounded-xl p-10 transition-all duration-500 hover:-translate-y-2 hover:border-brand-tertiary/40 hover:shadow-2xl hover:shadow-brand-tertiary/10"
            >
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
              <a
                href="#"
                className="inline-flex items-center font-label text-label-md text-brand-tertiary transition-all duration-300 group-hover:gap-3 hover:text-brand-primary"
              >
                Learn more
                <MaterialIcon name="arrow_forward" className="ml-2 text-[18px]" />
              </a>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
