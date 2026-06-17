import { Check } from 'lucide-react';

const BULLETS = [
  'Mạng lưới Luật sư được xác minh',
  'Tư vấn 1-1 theo lĩnh vực chuyên môn',
  'Hỗ trợ soạn thảo & đại diện pháp lý',
];

/**
 * "Coming Soon" card on the pricing page that teases the future
 * "Kết nối Luật sư" feature. Pairs with the FAQ column to fill the
 * 12-column grid (left = 5, right = 7).
 */
export function LawyerCtaCard() {
  return (
    <div className="glass-card relative h-full overflow-hidden rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container-low/40 p-7">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-secondary/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 text-2xl">
            ⚖️
          </span>
          <div>
            <h2 className="font-headline text-lg font-bold text-brand-on-surface">
              Kết nối Luật sư
            </h2>
            <p className="text-xs text-brand-on-surface-variant">
              Tính năng mở rộng trong tương lai
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-brand-on-surface-variant">
          Kết nối trực tiếp với đội ngũ Luật sư đối tác uy tín để được tư vấn chuyên sâu
          và hỗ trợ giải quyết hồ sơ pháp lý thực tế.
        </p>

        <ul className="mb-6 space-y-2.5 text-sm text-brand-on-surface-variant">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-secondary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Đang phát triển
          </span>
        </div>
      </div>
    </div>
  );
}
