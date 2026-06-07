import { Container } from './container';

const FIRMS = ['STERLING & CROSS', 'VANGUARD LEGAL', 'ELITE PARTNERS', 'JUSTICE GLOBAL'];

export function SocialProof() {
  return (
    <section className="relative z-10 border-y border-brand-outline-variant/10 bg-brand-surface-container-lowest/60 py-stack-lg backdrop-blur-sm">
      <Container>
        <p className="mb-stack-md text-center font-label text-label-md uppercase tracking-[0.2em] text-brand-on-surface-variant/70">
          Trusted by Global Elite Law Firms
        </p>
        <div className="flex flex-wrap items-center justify-center gap-stack-lg opacity-50 grayscale transition-all duration-700 hover:opacity-100 hover:grayscale-0 md:justify-between">
          {FIRMS.map((firm) => (
            <span
              key={firm}
              className="font-headline text-headline-md font-medium tracking-wide text-brand-on-surface"
            >
              {firm}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
