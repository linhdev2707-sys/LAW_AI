'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { userAdminApi } from '@/lib/user-admin';
import type { IUser, UserRole } from '@law-ai/shared';

export function useUserAdmin(isAdmin: boolean) {
  const [users, setUsers] = useState<IUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<IUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const refreshUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await userAdminApi.list({
        page,
        limit,
        search: search.trim() || undefined,
        role: role || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không tải được danh sách người dùng';
      setLoadError(msg);
      toast.error('Lỗi tải danh sách', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, limit, search, role]);

  // Refetch when dependencies change
  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  // Reset page when search or role changes
  useEffect(() => {
    setPage(1);
  }, [search, role]);

  async function onUpdateUserRole(id: string, newRole: UserRole) {
    try {
      await userAdminApi.update(id, { role: newRole });
      toast.success('Đã cập nhật vai trò người dùng');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Cập nhật thất bại';
      toast.error('Cập nhật vai trò thất bại', { description: msg });
    }
  }

  async function onUpdateUserStatus(id: string, newStatus: boolean) {
    try {
      await userAdminApi.update(id, { isActive: newStatus });
      toast.success(newStatus ? 'Đã kích hoạt tài khoản' : 'Đã khoá tài khoản');
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: newStatus } : u))
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Cập nhật thất bại';
      toast.error('Cập nhật trạng thái thất bại', { description: msg });
    }
  }

  async function onConfirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const id = pendingDelete.id;
    try {
      await userAdminApi.remove(id);
      toast.success('Đã xoá người dùng', { description: pendingDelete.email });
      setPendingDelete(null);
      await refreshUsers();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Xoá thất bại';
      toast.error('Xoá người dùng thất bại', { description: msg });
    } finally {
      setDeleting(false);
    }
  }

  async function onCreateUser(dto: { email: string; password?: string; fullName: string; role?: UserRole }) {
    try {
      await userAdminApi.create(dto);
      toast.success('Đã thêm người dùng mới');
      setShowCreateDialog(false);
      await refreshUsers();
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Thêm người dùng thất bại';
      toast.error('Thêm người dùng thất bại', { description: msg });
      return false;
    }
  }

  return {
    users,
    total,
    page,
    setPage,
    limit,
    setLimit,
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
  };
}
