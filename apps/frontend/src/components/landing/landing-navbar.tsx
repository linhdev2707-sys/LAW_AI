'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, User as UserIcon, LayoutDashboard, ChevronDown, MessageSquare, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Container } from './container';

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the user menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isLoggedIn = status === 'authenticated' && !!session?.user;
  const userInitial =
    (session?.user?.name || session?.user?.email || '?').charAt(0).toUpperCase();
  const userName = session?.user?.name || session?.user?.email || '';
  const userEmail = session?.user?.email || '';
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-brand-outline-variant/30 bg-brand-surface/90 shadow-md shadow-black/20 backdrop-blur-md'
          : 'glass-nav border-b border-transparent',
      )}
    >
      <nav className="flex h-20 items-center justify-between">
        <Container className="flex items-center justify-between !px-margin-mobile md:!px-margin-desktop">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.jpg"
              alt="LAW AI"
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-contain"
              priority
            />
            <span className="font-headline text-2xl font-semibold tracking-wide text-brand-on-surface">
              LAW AI
            </span>
          </Link>

          <div className="hidden items-center gap-stack-lg md:flex">
            <Link
              href="#"
              className="border-b-2 border-brand-tertiary pb-1 font-body text-body-md text-brand-on-surface"
            >
              Nền tảng
            </Link>
            <Link
              href="#"
              className="font-body text-body-md text-brand-on-surface-variant transition-colors hover:text-brand-tertiary"
            >
              Giải pháp
            </Link>
            <Link
              href="#"
              className="font-body text-body-md text-brand-on-surface-variant transition-colors hover:text-brand-tertiary"
            >
              Tài nguyên
            </Link>
            <Link
              href="#"
              className="font-body text-body-md text-brand-on-surface-variant transition-colors hover:text-brand-tertiary"
            >
              Về chúng tôi
            </Link>
          </div>

          <div className="flex items-center gap-gutter">
            {isLoggedIn ? (
              /* ── Logged-in: avatar dropdown ─────────────────────────────── */
              <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Mở menu người dùng"
                    className="flex items-center gap-2 rounded-full border border-brand-outline-variant/30 bg-brand-surface-container/60 py-1 pl-1 pr-2.5 text-sm transition-colors hover:border-brand-tertiary/50 hover:bg-brand-surface-container"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-sm font-semibold text-white shadow-md shadow-brand-primary/20">
                      {userInitial}
                    </span>
                    <span className="hidden max-w-[120px] truncate font-medium text-brand-on-surface md:inline">
                      {userName}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-brand-on-surface-variant transition-transform',
                        menuOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-brand-outline-variant/20 bg-brand-surface-container/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
                    >
                      {/* User info header */}
                      <div className="border-b border-brand-outline-variant/10 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-brand-on-surface">
                          {userName}
                        </p>
                        <p className="truncate text-xs text-brand-on-surface-variant">
                          {userEmail}
                        </p>
                      </div>

                      {/* Menu items */}
                      <div className="p-1.5">
                        <MenuItem
                          icon={<MessageSquare className="h-4 w-4" />}
                          label="Vào chat"
                          onClick={() => {
                            setMenuOpen(false);
                            router.push('/chat');
                          }}
                        />
                        <MenuItem
                          icon={<LayoutDashboard className="h-4 w-4" />}
                          label="Bảng điều khiển"
                          onClick={() => {
                            setMenuOpen(false);
                            router.push('/dashboard');
                          }}
                        />
                        <MenuItem
                          icon={<UserIcon className="h-4 w-4" />}
                          label="Hồ sơ"
                          onClick={() => {
                            setMenuOpen(false);
                            router.push('/dashboard');
                          }}
                        />
                        {isAdmin && (
                          <MenuItem
                            icon={<Database className="h-4 w-4" />}
                            label="Quản lý Knowledge"
                            onClick={() => {
                              setMenuOpen(false);
                              router.push('/knowledge');
                            }}
                          />
                        )}
                      </div>

                      <div className="border-t border-brand-outline-variant/10 p-1.5">
                        <MenuItem
                          icon={<LogOut className="h-4 w-4" />}
                          label="Đăng xuất"
                          destructive
                          onClick={() => {
                            setMenuOpen(false);
                            void signOut({ callbackUrl: '/' });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
            ) : (
              /* ── Logged-out: 2 CTA buttons ─────────────────────────────── */
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="hidden font-label text-label-md text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface md:inline-flex"
                >
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button
                  asChild
                  className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-stack-md py-3 font-label text-label-md font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/40"
                >
                  <Link href="/register">Bắt đầu ngay</Link>
                </Button>
              </>
            )}
          </div>
        </Container>
      </nav>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        destructive
          ? 'text-red-300 hover:bg-red-500/10 hover:text-red-200'
          : 'text-brand-on-surface hover:bg-white/5',
      )}
    >
      <span className={cn(destructive ? 'text-red-300' : 'text-brand-on-surface-variant')}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
