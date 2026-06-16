import { Container } from './container';

const CAPABILITIES = [
  'Trò chuyện pháp lý',
  'Tra cứu văn bản AI',
  'Soạn thảo biểu mẫu',
  'Phân tích hợp đồng',
  'Hỗ trợ thủ tục hành chính',
  'Kết nối luật sư đối tác',
];

export function SocialProof() {
  return (
    <section className="relative z-10 border-y border-brand-outline-variant/10 bg-brand-surface-container-lowest/60 py-stack-lg backdrop-blur-sm">
      <Container>
        <p className="mb-stack-md text-center font-label text-label-md uppercase tracking-[0.2em] text-brand-on-surface-variant/70">
          Hỗ trợ đắc lực cho các nhu cầu pháp lý thường ngày
        </p>
      </Container>

      {/* Marquee: gradient text on a single horizontal track, duplicated
          for a seamless loop, fades at both edges, pauses on hover. */}
      <div
        className="group relative w-full overflow-hidden"
        style={{
          // mask hides the seams where the duplicated track meets, on both
          // edges. Inline style because Tailwind mask syntax is verbose.
          maskImage:
            'linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%)',
        }}
      >
        <div className="flex w-max animate-marquee items-center gap-stack-lg whitespace-nowrap group-hover:[animation-play-state:paused]">
          {/* First copy of the capabilities */}
          <CapabilityList />
          {/* Second copy — same content, offset by -50% via keyframe */}
          <CapabilityList aria-hidden />
        </div>
      </div>
    </section>
  );
}

function CapabilityList({ 'aria-hidden': ariaHidden }: { 'aria-hidden'?: boolean } = {}) {
  return (
    <ul
      aria-hidden={ariaHidden}
      className="flex shrink-0 items-center gap-stack-lg"
    >
      {CAPABILITIES.map((cap) => (
        <li key={cap} className="flex items-center gap-stack-lg">
          <span
            className="font-headline text-headline-md font-medium tracking-wide"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #818cf8 0%, #22d3ee 50%, #c4b5fd 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {cap}
          </span>
          {/* Decorative dot separator between capabilities */}
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-indigo-400 via-cyan-400 to-violet-400"
          />
        </li>
      ))}
    </ul>
  );
}
