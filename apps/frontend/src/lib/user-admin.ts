import { apiFetch } from './api';
import type { IUser, IPaginatedResult, UserRole } from '@law-ai/shared';

export const userAdminApi = {
  async list(query: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
  }): Promise<IPaginatedResult<IUser>> {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.role) params.set('role', query.role);

    return apiFetch<IPaginatedResult<IUser>>(`/api/v1/users?${params.toString()}`);
  },

  async update(
    id: string,
    dto: { fullName?: string; role?: UserRole; isActive?: boolean },
  ): Promise<IUser> {
    return apiFetch<IUser>(`/api/v1/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: dto,
    });
  },

  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/api/v1/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async create(dto: {
    email: string;
    password?: string;
    fullName: string;
    role?: UserRole;
  }): Promise<IUser> {
    // Admin creates user: first register standard user, then update role if role !== USER
    // Wait, the API auth/register does not support registering password-less accounts, so we'll pass a password.
    // If not provided, we generate a random password.
    const password = dto.password || Math.random().toString(36).slice(-10) + 'A1b!';
    const regRes = await apiFetch<{ user: IUser }>('/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: dto.email,
        password,
        fullName: dto.fullName,
      },
    });

    const user = regRes.user;
    if (dto.role && dto.role !== 'user') {
      return this.update(user.id, { role: dto.role });
    }
    return user;
  },
};
