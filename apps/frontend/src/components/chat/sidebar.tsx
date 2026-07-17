'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  LogOut,
  X,
  Search,
  Settings,
  Sparkles,
  LayoutDashboard,
  Database,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { chatApi, type IConversationListItem } from '@/lib/chat';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}

export function Sidebar({ open, onClose, refreshKey }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const [items, setItems] = useState<IConversationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  // Delete dialog state — the id of the conversation pending confirmation.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    } catch (err) {
      toast.error('Không thể tạo cuộc trò chuyện', {
        description: err instanceof Error ? err.message : 'Vui lòng thử lại',
      });
    } finally {
      setCreating(false);
    }
  }

  function requestDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await chatApi.remove(pendingDeleteId);
      setItems((prev) => prev.filter((c) => c.id !== pendingDeleteId));
      if (pathname === `/chat/${pendingDeleteId}`) router.push('/chat');
      toast.success('Đã xoá cuộc trò chuyện');
      setPendingDeleteId(null);
    } catch (err) {
      toast.error('Không thể xoá cuộc trò chuyện', {
        description: err instanceof Error ? err.message : 'Vui lòng thử lại',
      });
    } finally {
      setDeleting(false);
    }
  }

  // Filter & group by recency (today / earlier)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.title.toLowerCase().includes(q));
  }, [items, query]);

  const groups = useMemo(() => groupByRecency(filtered), [filtered]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
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
        <div className="flex items-center justify-between border-b border-brand-outline-variant/15 p-3">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors hover:bg-white/5"
            title="Về trang chủ"
          >
            <Image
              src="/logo.jpg"
              alt="iLaw"
              width={48}
              height={48}
              className="h-12 w-12 rounded-md object-contain"
            />
            <span className="text-lg font-bold">iLaw</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard"
              onClick={onClose}
              className="rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
              aria-label="Bảng điều khiển"
              title="Bảng điều khiển"
            >
              <LayoutDashboard className="h-4 w-4" />
            </Link>
            {isAdmin && (
              <Link
                href="/knowledge"
                onClick={onClose}
                className="rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
                aria-label="Quản lý Knowledge"
                title="Quản lý Knowledge"
              >
                <Database className="h-4 w-4" />
              </Link>
            )}
            <button
              type="button"
              className="rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
              aria-label="Cài đặt"
              title="Cài đặt (sắp ra mắt)"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface md:hidden"
              aria-label="Đóng thanh bên"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* New chat button — prominent gradient */}
        <div className="p-3">
          <button
            type="button"
            onClick={handleNew}
            disabled={creating}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-3 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/30 disabled:translate-y-0 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            <span>Cuộc trò chuyện mới</span>
          </button>
        </div>

        {/* Search — only show when there are items */}
        {items.length > 0 && (
          <div className="px-3 pb-2">
            <div className="group relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-on-surface-variant/60 transition-colors group-focus-within:text-brand-tertiary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm trong các cuộc trò chuyện…"
                className="h-8 w-full rounded-md border border-brand-outline-variant/20 bg-brand-surface-container-lowest/50 pl-8 pr-3 text-xs text-brand-on-surface placeholder:text-brand-on-surface-variant/50 focus:border-brand-tertiary/50 focus:outline-none focus:ring-1 focus:ring-brand-tertiary/30"
              />
            </div>
          </div>
        )}

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {loading && items.length === 0 ? (
            <SidebarState icon={<Sparkles className="h-4 w-4 animate-pulse" />} text="Đang tải…" />
          ) : items.length === 0 ? (
            <EmptyHistory onNew={handleNew} />
          ) : filtered.length === 0 ? (
            <SidebarState text={`Không tìm thấy kết quả cho "${query}"`} />
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-on-surface-variant/60">
                    {g.label}
                  </div>
                  <ul className="space-y-0.5">
                    {g.items.map((c) => {
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
                              onClick={(e) => requestDelete(c.id, e)}
                              className="rounded p-1 text-brand-on-surface-variant opacity-0 transition-all hover:bg-white/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                              aria-label="Xoá cuộc trò chuyện"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-brand-outline-variant/15 p-2">
          {session?.user && (
            <div className="group flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-tertiary text-sm font-semibold text-white shadow-md shadow-brand-primary/20">
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
                className="rounded p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-red-300"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null);
        }}
        title="Xoá cuộc trò chuyện này?"
        description="Hành động này không thể hoàn tác. Toàn bộ tin nhắn trong cuộc trò chuyện sẽ bị xoá vĩnh viễn."
        confirmLabel="Xoá"
        cancelLabel="Huỷ"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function SidebarState({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-3 text-xs text-brand-on-surface-variant">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function EmptyHistory({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-tertiary/20 text-brand-tertiary">
        <MessageSquare className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-brand-on-surface">Chưa có cuộc trò chuyện</p>
        <p className="mt-1 text-xs text-brand-on-surface-variant/70">
          Bắt đầu cuộc trò chuyện đầu tiên của bạn
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="text-xs font-semibold text-brand-tertiary transition-colors hover:text-brand-primary"
      >
        Tạo ngay →
      </button>
    </div>
  );
}

function groupByRecency(
  items: IConversationListItem[],
): { label: string; items: IConversationListItem[] }[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const today: IConversationListItem[] = [];
  const earlier: IConversationListItem[] = [];
  for (const c of items) {
    const t = new Date(c.updatedAt ?? c.createdAt ?? 0).getTime();
    if (now - t <= dayMs) today.push(c);
    else earlier.push(c);
  }
  const out: { label: string; items: IConversationListItem[] }[] = [];
  if (today.length) out.push({ label: 'Hôm nay', items: today });
  if (earlier.length) out.push({ label: 'Trước đó', items: earlier });
  return out;
}
