'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Container } from './container';

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-brand-outline-variant/30 bg-brand-surface/90 shadow-md shadow-black/20 backdrop-blur-md'
          : 'glass-nav border-b border-transparent',
      )}
    >
      <nav className="flex h-20 items-center justify-between">
        <Container className="flex items-center justify-between !px-margin-mobile md:!px-margin-desktop">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.jpg"
              alt="LAW AI"
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-contain"
              priority
            />
            <span className="font-headline text-2xl font-semibold tracking-wide text-brand-on-surface">
              LAW AI
            </span>
          </Link>

          <div className="hidden items-center gap-stack-lg md:flex">
            <Link
              href="#"
              className="border-b-2 border-brand-tertiary pb-1 font-body text-body-md text-brand-on-surface"
            >
              Platform
            </Link>
            <Link
              href="#"
              className="font-body text-body-md text-brand-on-surface-variant transition-colors hover:text-brand-tertiary"
            >
              Solutions
            </Link>
            <Link
              href="#"
              className="font-body text-body-md text-brand-on-surface-variant transition-colors hover:text-brand-tertiary"
            >
              Resources
            </Link>
            <Link
              href="#"
              className="font-body text-body-md text-brand-on-surface-variant transition-colors hover:text-brand-tertiary"
            >
              About
            </Link>
          </div>

          <div className="flex items-center gap-gutter">
            <Button
              asChild
              variant="ghost"
              className="hidden font-label text-label-md text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface md:inline-flex"
            >
              <Link href="/login">Login</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-stack-md py-3 font-label text-label-md font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/40"
            >
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </Container>
      </nav>
    </header>
  );
}
