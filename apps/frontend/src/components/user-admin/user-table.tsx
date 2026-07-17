'use client';

import { Trash2, UserCog, User, Shield, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/rag-admin';
import { UserRole, type IUser } from '@law-ai/shared';

interface UserTableProps {
  users: IUser[];
  currentUserId: string;
  onUpdateRole: (id: string, role: UserRole) => void;
  onUpdateStatus: (id: string, active: boolean) => void;
  onDeleteClick: (user: IUser) => void;
}

export function UserTable({
  users,
  currentUserId,
  onUpdateRole,
  onUpdateStatus,
  onDeleteClick,
}: UserTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-outline-variant/20 text-left text-xs uppercase tracking-wider text-brand-on-surface-variant">
            <th className="py-2 pr-4 font-medium">Người dùng</th>
            <th className="py-2 pr-4 font-medium">Vai trò</th>
            <th className="py-2 pr-4 font-medium">Trạng thái</th>
            <th className="py-2 pr-4 font-medium">Ngày tham gia</th>
            <th className="py-2 text-right font-medium">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr
                key={u.id}
                className="border-b border-brand-outline-variant/10 transition-colors last:border-0 hover:bg-white/[0.03]"
              >
                {/* User avatar, name and email */}
                <td className="py-3 pr-4 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-tertiary/20 text-sm font-semibold text-brand-tertiary">
                      {(u.fullName || u.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-brand-on-surface">
                        {u.fullName}
                        {isSelf && (
                          <span className="rounded bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-primary">
                            Bạn
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-brand-on-surface-variant">{u.email}</p>
                    </div>
                  </div>
                </td>

                {/* Role select */}
                <td className="py-3 pr-4 align-middle">
                  <div className="flex items-center gap-1.5">
                    {u.role === UserRole.ADMIN ? (
                      <Shield className="h-4 w-4 text-brand-primary" />
                    ) : u.role === UserRole.LAWYER ? (
                      <UserCog className="h-4 w-4 text-brand-tertiary" />
                    ) : (
                      <User className="h-4 w-4 text-brand-on-surface-variant" />
                    )}
                    <select
                      value={u.role}
                      onChange={(e) => onUpdateRole(u.id, e.target.value as UserRole)}
                      disabled={isSelf}
                      className="rounded border border-brand-outline-variant/30 bg-transparent px-2 py-1 text-xs text-brand-on-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-tertiary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value={UserRole.USER} className="bg-brand-surface-container">
                        Người dùng
                      </option>
                      <option value={UserRole.LAWYER} className="bg-brand-surface-container">
                        Luật sư
                      </option>
                      <option value={UserRole.ADMIN} className="bg-brand-surface-container">
                        Quản trị viên
                      </option>
                    </select>
                  </div>
                </td>

                {/* Status toggle button */}
                <td className="py-3 pr-4 align-middle">
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(u.id, !u.isActive)}
                    disabled={isSelf}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-60 ${
                      u.isActive
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-red-400/40 bg-red-500/10 text-red-200'
                    }`}
                  >
                    {u.isActive ? (
                      <>
                        <Unlock className="h-3 w-3" />
                        Đang hoạt động
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        Đã khoá
                      </>
                    )}
                  </button>
                </td>

                {/* Created date */}
                <td className="py-3 pr-4 align-middle text-brand-on-surface-variant">
                  {formatDateTime(u.createdAt)}
                </td>

                {/* Actions (delete) */}
                <td className="py-3 text-right align-middle">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteClick(u)}
                    disabled={isSelf}
                    className="text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Xoá</span>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
