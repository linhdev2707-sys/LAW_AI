'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Menu, Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Mobile drawer state for the top-level AppSidebar. On md+ it's a
  // static column so this state is irrelevant; we just close the
  // drawer on every navigation so it doesn't linger after a link click.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-background text-brand-on-surface-variant">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isChatRoute = pathname === '/chat' || pathname?.startsWith('/chat/');

  return (
    <div className="flex h-screen overflow-hidden bg-brand-background text-brand-on-surface">
      {!isChatRoute && (
        <AppSidebar forceOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}

      {!isChatRoute && drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile-only top bar with hamburger to open the AppSidebar drawer. */}
        {!isChatRoute && (
          <header className="flex h-14 items-center gap-2 border-b border-brand-outline-variant/15 bg-brand-surface/80 px-4 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-1.5 text-brand-on-surface transition-colors hover:bg-white/5"
              aria-label="Mở thanh bên"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">iLaw</span>
          </header>
        )}

        <main className="relative flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
