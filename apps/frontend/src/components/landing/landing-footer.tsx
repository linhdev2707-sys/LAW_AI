import Link from 'next/link';
import Image from 'next/image';
import { Container } from './container';
import { NewsletterForm } from './newsletter-form';
import { LEGAL_LINKS, SUPPORT_LINKS } from '@/data/landing/footer-links';

export function LandingFooter() {
  return (
    <footer className="relative z-10 mt-12 w-full border-t border-brand-outline-variant/10 bg-brand-surface-container-low/60 pb-12 pt-20 backdrop-blur-sm">
      <Container>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <Image
                src="/logo.jpg"
                alt="iLaw"
                width={64}
                height={64}
                className="h-16 w-16 rounded-md object-contain"
              />
              <span className="font-headline text-2xl font-semibold tracking-wide text-brand-on-surface">
                iLaw
              </span>
            </div>
            <p className="font-body text-sm leading-relaxed text-brand-on-surface-variant">
              © {new Date().getFullYear()} iLaw. Bạn đồng hành pháp luật.
            </p>
          </div>

          <FooterColumn title="Pháp lý" links={LEGAL_LINKS} />
          <FooterColumn title="Hỗ trợ" links={SUPPORT_LINKS} />

          <div>
            <h4 className="font-label mb-4 text-label-md font-semibold uppercase tracking-widest text-brand-on-surface">
              Cập nhật tin tức
            </h4>
            <NewsletterForm />
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="font-label mb-2 text-label-md font-semibold uppercase tracking-widest text-brand-on-surface">
        {title}
      </h4>
      {links.map((l) => (
        <Link
          key={l.label}
          href={l.href}
          className="font-body text-sm text-brand-on-surface-variant transition-all duration-300 hover:translate-x-1 hover:text-brand-tertiary"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
