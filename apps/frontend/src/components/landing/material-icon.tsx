import { cn } from '@/lib/utils';

interface MaterialIconProps {
  name: string;
  className?: string;
  /** Filled vs outlined. Default: outlined. */
  filled?: boolean;
  ariaLabel?: string;
}

/**
 * Material Symbols Outlined icon (or filled if `filled`).
 * Fonts are loaded once in the root layout.
 */
export function MaterialIcon({ name, className, filled, ariaLabel }: MaterialIconProps) {
  return (
    <span
      role={ariaLabel ? 'img' : 'presentation'}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn('material-symbols-outlined leading-none', className)}
      style={
        filled
          ? ({ fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24' } as React.CSSProperties)
          : ({ fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24' } as React.CSSProperties)
      }
    >
      {name}
    </span>
  );
}
