'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Trash2, LogOut, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { chatApi, type IConversationListItem } from '@/lib/chat';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}

export function Sidebar({ open, onClose, refreshKey }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [items, setItems] = useState<IConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await chatApi.list();
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  async function handleNew() {
    if (creating) return;
    setCreating(true);
    try {
      const conv = await chatApi.create();
      router.push(`/chat/${conv.id}`);
      onClose();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
      await chatApi.remove(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (pathname === `/chat/${id}`) router.push('/chat');
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/70 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-brand-outline-variant/10 bg-brand-surface-container text-brand-on-surface transition-transform md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-outline-variant/15 p-2">
          <Link
            href="/chat"
            onClick={onClose}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold hover:bg-white/5"
          >
            <Image
              src="/logo.jpg"
              alt="LAW AI"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-contain"
            />
            <span>LAW AI</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 hover:bg-white/5 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New chat button */}
        <div className="p-2">
          <button
            type="button"
            onClick={handleNew}
            disabled={creating}
            className="flex w-full items-center gap-2 rounded-md border border-brand-tertiary/30 px-3 py-3 text-sm transition hover:border-brand-tertiary/60 hover:bg-brand-tertiary/10 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 text-brand-tertiary" />
            <span>New chat</span>
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {loading && items.length === 0 ? (
            <p className="px-2 py-3 text-xs text-brand-on-surface-variant">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-3 text-xs text-brand-on-surface-variant/70">No conversations yet</p>
          ) : (
            <ul className="space-y-1">
              {items.map((c) => {
                const active = pathname === `/chat/${c.id}`;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/chat/${c.id}`}
                      onClick={onClose}
                      className={cn(
                        'group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition',
                        active
                          ? 'bg-brand-tertiary/15 text-brand-on-surface'
                          : 'text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface',
                      )}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{c.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(c.id, e)}
                        className="invisible rounded p-1 text-brand-on-surface-variant hover:bg-white/10 hover:text-brand-tertiary group-hover:visible"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-brand-outline-variant/15 p-2">
          {session?.user && (
            <div className="flex items-center gap-2 rounded-md p-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-sm font-semibold text-white">
                {(session.user.name || session.user.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-on-surface">
                  {session.user.name || session.user.email}
                </p>
                <p className="truncate text-xs text-brand-on-surface-variant">
                  {session.user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded p-2 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-tertiary"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
