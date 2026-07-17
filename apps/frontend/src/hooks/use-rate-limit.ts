'use client';

import { useCallback, useEffect, useState } from 'react';

interface RateLimitState {
  /** Epoch ms when the current ban expires. `null` means not throttled. */
  blockedUntil: number | null;
  /** Seconds remaining in the current ban, refreshed on each tick. */
  secondsRemaining: number;
  /** True iff a 429 response was observed in the last `blockedUntil` window. */
  isBlocked: boolean;
}

/**
 * Tiny shared state hook for rate-limit countdowns.
 *
 * Returns helpers to `trigger(seconds)` (called when the BE returns 429)
 * and a derived `secondsRemaining` that ticks every second. The ban
 * clears itself when the timer reaches 0; no manual `clear()` needed.
 */
export function useRateLimit() {
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (blockedUntil == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [blockedUntil]);

  // Auto-clear once the ban expires.
  useEffect(() => {
    if (blockedUntil == null) return;
    if (now >= blockedUntil) setBlockedUntil(null);
  }, [now, blockedUntil]);

  const trigger = useCallback((seconds: number) => {
    const safe = Math.max(1, Math.ceil(seconds));
    setBlockedUntil(Date.now() + safe * 1000);
  }, []);

  const clear = useCallback(() => setBlockedUntil(null), []);

  const secondsRemaining =
    blockedUntil == null ? 0 : Math.max(0, Math.ceil((blockedUntil - now) / 1000));

  return {
    blockedUntil,
    secondsRemaining,
    isBlocked: blockedUntil != null && secondsRemaining > 0,
    trigger,
    clear,
  } satisfies RateLimitState & {
    trigger: (seconds: number) => void;
    clear: () => void;
  };
}
