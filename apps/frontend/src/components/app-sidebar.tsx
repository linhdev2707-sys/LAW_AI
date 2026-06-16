'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  X,
  Users,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@law-ai/shared';

const STORAGE_KEY = 'law-ai:sidebar-collapsed';
const MOBILE_BREAKPOINT = 768;

interface AppSidebarProps {
  /** Force open (used by the mobile drawer overlay). */
  forceOpen?: boolean;
  /** Called when the mobile drawer should close. */
  onClose?: () => void;
}

export function AppSidebar({ forceOpen = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  // Start as "not hydrated" so SSR matches the first client render. We read
  // localStorage in an effect; before it runs, default to expanded on
  // desktop and collapsed on small viewports.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') {
        setCollapsed(true);
      } else {
        setCollapsed(window.innerWidth < MOBILE_BREAKPOINT);
      }
    } catch {
      /* localStorage may be disabled; keep the default */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Effective width: on mobile (or when forceOpen is used as a drawer) we
  // always show the expanded width so the drawer looks right.
  const expanded = forceOpen || !collapsed;
  const widthCls = expanded ? 'w-60' : 'w-16';

  // Top-level nav items. `matches` is a prefix test so /chat/abc-123
  // highlights the "Chat" item.
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const topItems: {
    href: string;
    label: string;
    icon: ReactNode;
    matches: (p: string) => boolean;
  }[] = [
    {
      href: '/chat',
      label: 'Chat',
      icon: <MessageSquare className="h-4 w-4" />,
      matches: (p) => p === '/chat' || p.startsWith('/chat/'),
    },
    {
      href: '/dashboard',
      label: 'Bảng điều khiển',
      icon: <LayoutDashboard className="h-4 w-4" />,
      matches: (p) => p === '/dashboard',
    },
    ...(isAdmin
      ? [
          {
            href: '/knowledge',
            label: 'Knowledge',
            icon: <Database className="h-4 w-4" />,
            matches: (p: string) => p.startsWith('/knowledge'),
          },
          {
            href: '/users',
            label: 'Người dùng',
            icon: <Users className="h-4 w-4" />,
            matches: (p: string) => p.startsWith('/users'),
          },
          {
            href: '/payments',
            label: 'Thanh toán',
            icon: <CreditCard className="h-4 w-4" />,
            matches: (p: string) => p.startsWith('/payments'),
          },
        ]
      : []),
  ];

  // Sub-items that show under the matching top-level entry when the route
  // matches and the sidebar is expanded.
  const isOnKnowledge = pathname.startsWith('/knowledge');
  const subItems: { href: string; label: string; icon: ReactNode; disabled?: boolean }[] = [
    {
      href: '/knowledge',
      label: 'Tài liệu',
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    {
      href: '#',
      label: 'Buckets',
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      disabled: true,
    },
  ];

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-brand-outline-variant/15 bg-brand-surface-container text-brand-on-surface transition-[width] duration-200 ease-out',
        // On mobile the rail is a slide-over drawer. On md+ it's a static
        // column that participates in the parent flex layout.
        forceOpen
          ? 'fixed inset-y-0 left-0 z-50 w-60 shadow-2xl shadow-black/60 md:static md:z-auto md:shadow-none'
          : 'hidden md:flex',
        widthCls,
      )}
    >

    {/* Brand */}
    <div className="flex h-14 items-center gap-2 border-b border-brand-outline-variant/15 px-3">
      <Link
        href="/"
        onClick={onClose}
        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/5"
        title="Về trang chủ"
      >
        <Image
          src="/logo.jpg"
          alt="ILaw"
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-md object-contain"
        />
        {expanded && (
          <span className="truncate text-lg font-bold">ILaw</span>
        )}
      </Link>
      <div className="ml-auto flex items-center gap-1">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface md:hidden"
            aria-label="Đóng thanh bên"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>

    {/* Top-level nav */}
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      <ul className="space-y-0.5">
        {topItems.map((item) => {
          const active = item.matches(pathname);
          return (
            <li key={item.href}>
            <Link
              href={item.href}
              onClick={onClose}
              title={expanded ? undefined : item.label}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                active
                  ? 'bg-gradient-to-r from-brand-primary/20 to-brand-tertiary/15 text-brand-on-surface shadow-sm shadow-brand-primary/10'
                  : 'text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface',
                expanded ? 'justify-start' : 'justify-center',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                  active
                    ? 'bg-gradient-to-br from-brand-primary to-brand-tertiary text-white shadow-md shadow-brand-primary/30'
                    : 'bg-white/5 text-brand-on-surface-variant group-hover:text-brand-on-surface',
                )}
              >
                {item.icon}
              </span>
              {expanded && <span className="truncate">{item.label}</span>}
              {active && expanded && (
                <span
                  aria-hidden
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary"
                />
              )}
            </Link>
            </li>
          );
        })}
      </ul>

      {/* Sub-items for Knowledge (only when expanded and on a /knowledge route) */}
      {expanded && isOnKnowledge && (
        <div className="mt-3 border-t border-brand-outline-variant/10 pt-3">
          <ul className="space-y-0.5 pl-3">
            {subItems.map((sub) => {
              const active = !sub.disabled && pathname === sub.href;
              return (
                <li key={sub.href + sub.label}>
                {sub.disabled ? (
                  <span
                    title="Sắp ra mắt"
                    className="flex cursor-not-allowed items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-brand-on-surface-variant/50"
                  >
                    <span className="text-brand-on-surface-variant/40">{sub.icon}</span>
                    <span className="truncate">{sub.label}</span>
                    <span className="ml-auto rounded-full border border-brand-outline-variant/20 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-brand-on-surface-variant/60">
                      Sắp có
                    </span>
                  </span>
                ) : (
                  <Link
                    href={sub.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                      active
                        ? 'bg-brand-tertiary/15 text-brand-on-surface'
                        : 'text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface',
                      )}
                  >
                    <span className={cn(active ? 'text-brand-tertiary' : '')}>{sub.icon}</span>
                    <span className="truncate">{sub.label}</span>
                  </Link>
                )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>

    {/* Footer: collapse toggle + user */}
    <div className="border-t border-brand-outline-variant/15 p-2">
      {session?.user && expanded && (
        <div className="mb-2 flex items-center gap-2 rounded-md p-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-sm font-semibold text-white shadow-md shadow-brand-primary/20">
          {(session.user.name || session.user.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-on-surface">
            {session.user.name || session.user.email}
          </p>
          <p className="truncate text-xs text-brand-on-surface-variant/70">
            {session.user.role}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-red-300"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={!!forceOpen}
        title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface disabled:cursor-not-allowed disabled:opacity-40',
          expanded ? 'justify-start' : 'justify-center',
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            {hydrated && <span>Thu gọn</span>}
          </>
        )}
      </button>
    </div>
    </aside>
  );
}

export default AppSidebar;
