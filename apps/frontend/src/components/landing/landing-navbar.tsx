'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  ChevronDown,
  MessageSquare,
  Database,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Container } from './container';

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
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
  const userInitial = (session?.user?.name || session?.user?.email || '?').charAt(0).toUpperCase();
  const userName = session?.user?.name || session?.user?.email || '';
  const userEmail = session?.user?.email || '';
  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const chatHref = status === 'authenticated' ? '/chat' : '/login?callbackUrl=/chat';

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
              alt="iLaw"
              width={64}
              height={64}
              className="h-16 w-16 rounded-md object-contain"
              priority
            />
            <span className="font-headline text-3xl font-bold tracking-wide text-brand-on-surface">
              iLaw
            </span>
          </Link>

          <div className="hidden items-center gap-stack-lg md:flex">
            {[
              { href: '/', label: 'Nền tảng' },
              { href: '/solutions', label: 'Giải pháp' },
              { href: '/about', label: 'Về chúng tôi' },
            ].map((item) => {
              const isActive = item.href !== '#' && pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group relative pb-1 font-body text-body-md transition-colors ${
                    isActive
                      ? 'text-brand-on-surface'
                      : 'text-brand-on-surface-variant hover:text-brand-tertiary'
                  }`}
                >
                  {item.label}
                  <span
                    className={`pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-brand-tertiary transition-transform duration-300 ${
                      isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </Link>
              );
            })}

            {/* Nút Chat — luôn hiện trên header (cùng style với menu text) */}
            <Link
              href={chatHref}
              className={`group relative pb-1 font-body text-body-md transition-colors ${
                pathname === '/chat'
                  ? 'text-brand-on-surface'
                  : 'text-brand-on-surface-variant hover:text-brand-tertiary'
              }`}
            >
              Chat
              <span
                className={`pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-brand-tertiary transition-transform duration-300 ${
                  pathname === '/chat' ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
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
                      <p className="truncate text-xs text-brand-on-surface-variant">{userEmail}</p>
                    </div>

                    {/* Menu items */}
                    <div className="p-1.5">
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
              /* ── Logged-out: single CTA → /chat nếu đã đăng nhập, /login nếu chưa ─ */
              <Button
                asChild
                className="font-label rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-stack-md py-3 text-label-md font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/40"
              >
                <Link href={chatHref}>Bắt đầu ngay</Link>
              </Button>
            )}

            {/* Hamburger button (Mobile only) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center justify-center rounded-md p-2 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface md:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </Container>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer content */}
          <div className="fixed inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-brand-outline-variant/20 bg-brand-surface-container-high/95 p-6 shadow-2xl backdrop-blur-2xl transition-transform duration-300">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-3"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Image
                  src="/logo.jpg"
                  alt="iLaw"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-md object-contain"
                />
                <span className="font-headline text-2xl font-bold tracking-wide text-brand-on-surface">
                  iLaw
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-2 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface"
                aria-label="Đóng menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-4 text-lg font-medium">
              {[
                { href: '/', label: 'Nền tảng' },
                { href: '/solutions', label: 'Giải pháp' },
                { href: '/about', label: 'Về chúng tôi' },
              ].map((item) => {
                const isActive = item.href !== '#' && pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`relative pl-3 transition-colors ${
                      isActive
                        ? 'text-brand-tertiary'
                        : 'text-brand-on-surface hover:text-brand-tertiary'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-tertiary" />
                    )}
                    {item.label}
                  </Link>
                );
              })}

              {/* Nút Chat — luôn hiện trong menu mobile (cùng style với menu text) */}
              <Link
                href={chatHref}
                onClick={() => setMobileMenuOpen(false)}
                className="relative self-start pl-3 text-base text-brand-on-surface transition-colors hover:text-brand-tertiary"
              >
                Chat
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-brand-outline-variant/10" />

            {/* User / CTA Action Section */}
            <div className="mt-auto flex flex-col gap-4">
              {isLoggedIn ? (
                <>
                  {/* User profile details */}
                  <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-2 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-sm font-semibold text-white shadow-md">
                      {userInitial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-on-surface">
                        {userName}
                      </p>
                      <p className="truncate text-xs text-brand-on-surface-variant">{userEmail}</p>
                    </div>
                  </div>

                  {/* Profile Actions */}
                  <Button
                    asChild
                    variant="ghost"
                    className="h-12 w-full justify-start gap-3 rounded-xl text-brand-on-surface hover:bg-white/5"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href="/dashboard">
                      <LayoutDashboard className="h-5 w-5 text-brand-on-surface-variant" />
                      Bảng điều khiển
                    </Link>
                  </Button>
                  {isAdmin && (
                    <Button
                      asChild
                      variant="ghost"
                      className="h-12 w-full justify-start gap-3 rounded-xl text-brand-on-surface hover:bg-white/5"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href="/knowledge">
                        <Database className="h-5 w-5 text-brand-on-surface-variant" />
                        Quản lý Knowledge
                      </Link>
                    </Button>
                  )}

                  <div className="my-2 border-t border-brand-outline-variant/10 pt-2" />

                  <Button
                    variant="ghost"
                    className="h-12 w-full justify-start gap-3 rounded-xl text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void signOut({ callbackUrl: '/' });
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    Đăng xuất
                  </Button>
                </>
              ) : (
                <Button
                  asChild
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-tertiary text-white shadow-lg shadow-brand-primary/30"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href={chatHref}>Bắt đầu ngay</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Beta Banner */}
      <div className="w-full overflow-hidden border-t border-amber-500/20 bg-amber-500/10 py-2.5">
        <div className="flex w-max animate-marquee text-xs font-bold uppercase tracking-wider text-amber-400">
          <div className="flex shrink-0 gap-20 px-10">
            <span>
              ⚠️ Hệ thống iLaw đang hoạt động trong giai đoạn thử nghiệm (Beta) • Vui lòng kiểm
              chứng kỹ các thông tin quan trọng và tham khảo ý kiến luật sư khi cần thiết
            </span>
          </div>
          <div className="flex shrink-0 gap-20 px-10">
            <span>
              ⚠️ Hệ thống iLaw đang hoạt động trong giai đoạn thử nghiệm (Beta) • Vui lòng kiểm
              chứng kỹ các thông tin quan trọng và tham khảo ý kiến luật sư khi cần thiết
            </span>
          </div>
        </div>
      </div>
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
