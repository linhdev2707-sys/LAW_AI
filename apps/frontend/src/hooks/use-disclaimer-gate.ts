'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'lawai.disclaimer.accepted.v1';

interface AcceptanceRecord {
  /** Whether the user accepted. */
  accepted: boolean;
  /** Full name they typed into the confirmation form. */
  fullName: string;
  /** ISO timestamp of the acceptance. */
  acceptedAt: string;
  /** Schema version so we can re-prompt when the disclaimer text changes. */
  version: number;
}

const CURRENT_VERSION = 1;

/**
 * Reads the stored acceptance record. Returns null on the server, on first
 * render (before useEffect runs), or when nothing is stored.
 */
function readStored(): AcceptanceRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AcceptanceRecord;
    if (!parsed || parsed.version !== CURRENT_VERSION) return null;
    if (!parsed.accepted) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(record: AcceptanceRecord) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota / disabled storage */
  }
}

function clearStored() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface UseDisclaimerGateResult {
  /** True once we know the stored value (used to avoid SSR flash). */
  hydrated: boolean;
  /** True when the dialog should be visible. */
  isOpen: boolean;
  /** The stored acceptance record, if any. */
  record: AcceptanceRecord | null;
  /** Persist the acceptance and close the dialog. */
  accept: (fullName: string) => void;
  /** Forget the stored acceptance (e.g. "Show disclaimer again" admin tool). */
  reset: () => void;
  /** Force-open the dialog (e.g. when user clicks a "View disclaimer" link). */
  show: () => void;
}

/**
 * Manages the "you must accept the legal disclaimer before chatting" gate.
 *
 * Storage key is namespaced + versioned, so the next time the disclaimer
 * wording changes meaningfully we can bump CURRENT_VERSION and every user
 * gets re-prompted automatically.
 */
export function useDisclaimerGate(): UseDisclaimerGateResult {
  // Start in a "not hydrated" state on both server and client to avoid
  // mismatch; populate from localStorage in an effect.
  const [hydrated, setHydrated] = useState(false);
  const [record, setRecord] = useState<AcceptanceRecord | null>(null);
  // The "force open" override lets external code re-open the dialog even
  // when there's a stored acceptance.
  const [forcedOpen, setForcedOpen] = useState(false);

  useEffect(() => {
    setRecord(readStored());
    setHydrated(true);
  }, []);

  const accept = useCallback((fullName: string) => {
    const next: AcceptanceRecord = {
      accepted: true,
      fullName: fullName.trim(),
      acceptedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    writeStored(next);
    setRecord(next);
    setForcedOpen(false);
  }, []);

  const reset = useCallback(() => {
    clearStored();
    setRecord(null);
    setForcedOpen(true);
  }, []);

  const show = useCallback(() => {
    setForcedOpen(true);
  }, []);

  // Open when there's no stored acceptance; respect forced-open override.
  const isOpen = hydrated && (forcedOpen || !record);

  return { hydrated, isOpen, record, accept, reset, show };
}
