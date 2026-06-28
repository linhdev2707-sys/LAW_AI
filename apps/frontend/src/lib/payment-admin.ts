import { apiFetch } from './api';
import type { IPaginatedResult } from '@law-ai/shared';

export interface IAdminTransaction {
  id: string;
  userId: string;
  code: string;
  plan: string;
  amount: number;
  status: string;
  paymentGateway: string;
  transactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  userEmail?: string;
  userFullName?: string;
}

export interface IAdminPaymentStats {
  totalRevenue: number;
  countsByStatus: {
    pending: number;
    completed: number;
    failed: number;
  };
  countsByPlan: {
    basic: number;
    pro: number;
    premium: number;
  };
  monthlyTrend: {
    month: string;
    revenue: number;
    count: number;
  }[];
}

export const paymentAdminApi = {
  async list(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    plan?: string;
  }): Promise<IPaginatedResult<IAdminTransaction>> {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.plan) params.set('plan', query.plan);

    return apiFetch<IPaginatedResult<IAdminTransaction>>(
      `/api/v1/payments/admin/transactions?${params.toString()}`,
    );
  },

  async stats(): Promise<IAdminPaymentStats> {
    return apiFetch<IAdminPaymentStats>('/api/v1/payments/admin/stats');
  },

  async approve(code: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/v1/payments/admin/transactions/${code}/approve`,
      { method: 'POST' },
    );
  },

  async reject(code: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `/api/v1/payments/admin/transactions/${code}/reject`,
      { method: 'POST' },
    );
  },
};
