'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertTriangle, Loader2, Plus, Users, Search } from 'lucide-react';
import { UserRole } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Custom Hooks & Components
import { useUserAdmin } from '@/hooks/use-user-admin';
import { UserTable } from '@/components/user-admin/user-table';
import { CreateUserDialog } from '@/components/user-admin/create-user-dialog';

/**
 * Admin-only page for managing system users.
 */
export default function UserAdminPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const currentUserId = session?.user?.id || '';

  // Authorization gate
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [sessionStatus, isAdmin, router]);

  const {
    users,
    total,
    page,
    setPage,
    limit,
    search,
    setSearch,
    role,
    setRole,
    loading,
    loadError,
    pendingDelete,
    setPendingDelete,
    deleting,
    showCreateDialog,
    setShowCreateDialog,
    refreshUsers,
    onUpdateUserRole,
    onUpdateUserStatus,
    onConfirmDelete,
    onCreateUser,
  } = useUserAdmin(isAdmin);

  const totalPages = Math.ceil(total / limit);

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="relative min-h-[60vh] overflow-hidden bg-brand-background text-brand-on-surface-variant">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.22),transparent_60%)]"
        />
        <div className="relative flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      {/* Soft cyan glow at the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,229,255,0.22),transparent_60%)]"
      />
      <div className="container relative max-w-6xl py-12">
        <header className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-brand-on-surface">
            <Users className="h-3.5 w-3.5 text-brand-tertiary" />
            Quản trị
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-brand-on-surface">
                Quản lý Người dùng
              </h1>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Quản lý tài khoản, thay đổi quyền hạn và trạng thái kích hoạt của người dùng.
              </p>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/50"
            >
              <Plus className="h-4 w-4" />
              Thêm người dùng
            </button>
          </div>
        </header>

        {/* Filters and Table Container */}
        <div className="relative overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Top accent line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
          />

          {/* Table Toolbar */}
          <div className="flex flex-col justify-between gap-4 border-b border-brand-tertiary/15 px-6 py-5 md:flex-row md:items-center">
            {/* Search */}
            <div className="group relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-on-surface-variant/60 transition-colors group-focus-within:text-brand-tertiary" />
              <Input
                type="text"
                placeholder="Tìm kiếm theo tên người dùng…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 pl-9 focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30"
              />
            </div>

            {/* Filters and Refresh */}
            <div className="flex items-center gap-3">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="flex h-10 w-40 rounded-md border border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 px-3 py-2 text-sm text-brand-on-surface focus-visible:border-brand-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-tertiary/30"
              >
                <option value="">Tất cả vai trò</option>
                <option value={UserRole.USER}>Người dùng (User)</option>
                <option value={UserRole.LAWYER}>Luật sư (Lawyer)</option>
                <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
              </select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void refreshUsers();
                }}
                disabled={loading}
                className="h-10 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-tertiary"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Làm mới'}
              </Button>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-6">
            {loadError && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Không tải được danh sách người dùng</p>
                  <p className="text-red-200/80">{loadError}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12 text-brand-on-surface-variant">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-md border border-dashed border-brand-outline-variant/30 bg-white/5 p-8 text-center text-sm text-brand-on-surface-variant">
                Không tìm thấy người dùng nào phù hợp với điều kiện tìm kiếm.
              </div>
            ) : (
              <>
                <UserTable
                  users={users}
                  currentUserId={currentUserId}
                  onUpdateRole={onUpdateUserRole}
                  onUpdateStatus={onUpdateUserStatus}
                  onDeleteClick={setPendingDelete}
                />

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-brand-outline-variant/10 pt-4 text-sm text-brand-on-surface-variant">
                    <div>
                      Trang <span className="font-medium text-brand-on-surface">{page}</span> /{' '}
                      {totalPages} (Tổng cộng {total} người dùng)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="disabled:opacity-40"
                      >
                        Trước
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="disabled:opacity-40"
                      >
                        Sau
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Xoá người dùng?"
        description={
          pendingDelete
            ? `Tài khoản của "${pendingDelete.fullName}" (${pendingDelete.email}) sẽ bị xoá vĩnh viễn khỏi cơ sở dữ liệu. Toàn bộ lịch sử trò chuyện và dữ liệu liên quan sẽ bị loại bỏ. Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xoá"
        variant="danger"
        loading={deleting}
        onConfirm={onConfirmDelete}
      />

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={onCreateUser}
      />
    </main>
  );
}
