import Link from 'next/link';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // `h-screen` + `overflow-hidden` locks the page to one viewport — no
    // vertical scrollbar. The card itself can scroll internally on tiny
    // screens via `overflow-y-auto` on the form root.
    <div className="relative h-screen w-full overflow-hidden bg-brand-background text-brand-on-surface">
      {/* Layer 1 — radial gradient base, deep navy → near-black corners */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at top, rgba(14,165,233,0.12) 0%, transparent 55%), radial-gradient(ellipse at bottom right, rgba(34,211,238,0.10) 0%, transparent 50%), radial-gradient(ellipse at bottom left, rgba(125,211,252,0.08) 0%, transparent 45%)',
        }}
      />

      {/* Layer 2 — grid pattern overlay, faint */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(125,211,252,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Layer 3 — large soft glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-tertiary/15 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-primary/20 blur-[160px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-secondary/8 blur-[120px]"
      />

      {/* Layer 4 — subtle noise to break up the gradient banding */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Foreground flex column — fixed header, centred main, fixed footer */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Top bar — brand only, fixed height */}
        <header className="flex h-16 shrink-0 items-center px-margin-mobile md:px-margin-desktop">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <Image
              src="/logo.jpg"
              alt="ILaw"
              width={64}
              height={64}
              className="h-16 w-16 rounded-md object-contain"
              priority
            />
            <span className="font-headline text-xl font-bold tracking-wide text-brand-on-surface">
              ILaw
            </span>
          </Link>
        </header>

        {/* Main — fills remaining height, lets child card scroll if needed */}
        <main className="flex flex-1 items-center justify-center overflow-hidden px-4 py-4">
          {children}
        </main>

        {/* Bottom strip — trust marks / legal, fixed height */}
        <footer className="shrink-0 pb-4 pt-2 text-center text-xs text-brand-on-surface-variant/60">
          © {new Date().getFullYear()} ILaw · Mã hoá chuẩn ngân hàng · Tuân thủ GDPR
        </footer>
      </div>
    </div>
  );
}
