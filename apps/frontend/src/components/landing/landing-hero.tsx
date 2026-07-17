'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Container } from './container';
import { MaterialIcon } from './material-icon';

export function LandingHero() {
  const { status } = useSession();
  const chatHref = status === 'authenticated' ? '/chat' : '/login?callbackUrl=/chat';

  return (
    <section className="hero-gradient relative flex min-h-screen items-center pt-20">
      <Container className="flex w-full flex-col items-center gap-stack-md py-section-padding text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-tertiary/40 bg-brand-tertiary/10 px-4 py-1.5 backdrop-blur-sm">
          <MaterialIcon name="verified" className="text-[16px] text-brand-tertiary" />
          <span className="font-label text-label-md uppercase tracking-widest text-brand-on-surface">
            Trợ lý pháp luật thông minh của bạn
          </span>
        </div>

        <h1 className="max-w-4xl font-headline text-4xl font-bold leading-tight text-brand-on-surface sm:text-5xl md:text-6xl">
          Giải đáp vướng mắc{' '}
          <span className="inline-block bg-gradient-to-r from-brand-tertiary via-brand-primary to-brand-secondary bg-clip-text px-1 py-2 pr-5 font-semibold italic text-transparent">
            pháp luật dễ dàng{' '}
          </span>
        </h1>

        <p className="mx-auto max-w-2xl font-body text-lg text-brand-on-surface-variant md:text-body-lg md:text-xl">
          Trò chuyện trực tiếp để tìm hiểu thủ tục, giải thích văn bản, hợp đồng và nhận hỗ trợ giải
          quyết các vấn đề pháp lý thường ngày chỉ trong vài giây.
        </p>

        <div className="mt-4 flex flex-col justify-center gap-gutter pt-unit sm:flex-row">
          <Button
            asChild
            className="font-label rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-8 py-4 text-label-md font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-primary/50"
          >
            <Link href={chatHref}>Trò chuyện ngay</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="font-label rounded-full border border-brand-on-surface/30 bg-white/5 px-8 py-4 text-label-md font-semibold text-brand-on-surface backdrop-blur-sm transition-all duration-300 hover:border-brand-tertiary/60 hover:bg-white/10 hover:text-brand-tertiary"
          >
            <Link href="#features">Tìm hiểu thêm</Link>
          </Button>
        </div>
      </Container>

      {/* Atmospheric scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 opacity-60 transition-opacity hover:opacity-100">
        <span className="font-label text-label-sm uppercase tracking-widest text-brand-on-surface">
          Khám phá hệ thống
        </span>
        <div className="h-16 w-px bg-gradient-to-b from-brand-tertiary to-transparent" />
      </div>
    </section>
  );
}
