'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Image from 'next/image';
import { Sidebar } from './sidebar';
import { Button } from '@/components/ui/button';
import { DisclaimerGate } from './disclaimer-gate';
import { useDisclaimerGate } from '@/hooks/use-disclaimer-gate';

interface ChatShellProps {
  children: React.ReactNode;
  refreshKey?: number;
}

export function ChatShell({ children, refreshKey }: ChatShellProps) {
  const [open, setOpen] = useState(false);
  const { isOpen: isDisclaimerOpen } = useDisclaimerGate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't allow Escape to close the sidebar while the disclaimer gate
      // is up — the user must explicitly accept.
      if (isDisclaimerOpen) return;
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDisclaimerOpen]);

  return (
    <div className="flex h-full overflow-hidden bg-brand-background text-brand-on-surface">
      <Sidebar open={open} onClose={() => setOpen(false)} refreshKey={refreshKey} />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center gap-2 border-b border-brand-outline-variant/15 bg-brand-surface/80 px-4 py-2 backdrop-blur md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="text-brand-on-surface hover:bg-white/5"
            aria-label="Mở thanh bên"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Image
            src="/logo.jpg"
            alt="LAW AI"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-contain"
          />
          <span className="text-sm font-semibold text-brand-on-surface">LAW AI</span>
        </header>

        <main className="relative flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>

      {/* Legal disclaimer gate — shown the first time (per browser, per
          version) the user enters the chat section. Modal blocks all
          interaction with the page beneath it until accepted. */}
      <DisclaimerGate />
    </div>
  );
}
