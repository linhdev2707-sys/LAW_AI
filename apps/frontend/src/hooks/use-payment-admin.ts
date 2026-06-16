'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { paymentAdminApi, type IAdminTransaction, type IAdminPaymentStats } from '@/lib/payment-admin';

export function usePaymentAdmin(isAdmin: boolean) {
  const [transactions, setTransactions] = useState<IAdminTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');

  const [stats, setStats] = useState<IAdminPaymentStats | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [errorStats, setErrorStats] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingList(true);
    setErrorList(null);
    try {
      const res = await paymentAdminApi.list({
        page,
        limit,
        search: search.trim() || undefined,
        status: status || undefined,
        plan: plan || undefined,
      });
      setTransactions(res.items);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không tải được lịch sử giao dịch';
      setErrorList(msg);
      toast.error('Lỗi tải danh sách giao dịch', { description: msg });
    } finally {
      setLoadingList(false);
    }
  }, [isAdmin, page, limit, search, status, plan]);

  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingStats(true);
    setErrorStats(null);
    try {
      const res = await paymentAdminApi.stats();
      setStats(res);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không tải được báo cáo thống kê';
      setErrorStats(msg);
      toast.error('Lỗi tải thống kê thanh toán', { description: msg });
    } finally {
      setLoadingStats(false);
    }
  }, [isAdmin]);

  // Initial load
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, plan]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStats(), loadTransactions()]);
  }, [loadStats, loadTransactions]);

  return {
    transactions,
    total,
    page,
    setPage,
    limit,
    search,
    setSearch,
    status,
    setStatus,
    plan,
    setPlan,
    stats,
    loadingList,
    loadingStats,
    errorList,
    errorStats,
    refreshAll,
  };
}
