import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from './container';
import { MaterialIcon } from './material-icon';

export function LandingHero() {
  return (
    <section className="hero-gradient relative flex min-h-screen items-center pt-20">
      <Container className="flex w-full flex-col items-center gap-stack-md py-section-padding text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-tertiary/40 bg-brand-tertiary/10 px-4 py-1.5 backdrop-blur-sm">
          <MaterialIcon name="verified" className="text-[16px] text-brand-tertiary" />
          <span className="font-label text-label-md uppercase tracking-widest text-brand-on-surface">
            Next-Gen Legal Tech
          </span>
        </div>

        <h1 className="font-display text-display-lg-mobile leading-tight text-brand-on-surface md:text-display-lg max-w-4xl">
          The Future of{' '}
          <span className="bg-gradient-to-r from-brand-tertiary via-brand-primary to-brand-secondary bg-clip-text font-semibold italic text-transparent">
            Legal Intelligence
          </span>
        </h1>

        <p className="mx-auto max-w-2xl font-body text-lg text-brand-on-surface-variant md:text-xl md:text-body-lg">
          Harness the power of AI to streamline your legal research, document analysis, and case
          management with surgical precision and unmatched speed.
        </p>

        <div className="mt-4 flex flex-col justify-center gap-gutter pt-unit sm:flex-row">
          <Button
            asChild
            className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-8 py-4 font-label text-label-md font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-primary/50"
          >
            <Link href="/register">Start Your Free Trial</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-full border border-brand-on-surface/30 bg-white/5 px-8 py-4 font-label text-label-md font-semibold text-brand-on-surface backdrop-blur-sm transition-all duration-300 hover:border-brand-tertiary/60 hover:bg-white/10 hover:text-brand-tertiary"
          >
            <Link href="#features">Watch Demo</Link>
          </Button>
        </div>
      </Container>

      {/* Atmospheric scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 opacity-60 transition-opacity hover:opacity-100">
        <span className="font-label text-label-sm uppercase tracking-widest text-brand-on-surface">
          Explore Systems
        </span>
        <div className="h-16 w-px bg-gradient-to-b from-brand-tertiary to-transparent" />
      </div>
    </section>
  );
}
