'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Loader2,
  Search,
  CreditCard,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Award,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePaymentAdmin } from '@/hooks/use-payment-admin';
import { UserRole } from '@law-ai/shared';

export default function AdminPaymentPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  // Authorization gate
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [sessionStatus, isAdmin, router]);

  const {
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
    onApprove,
    onReject,
    approvingCode,
    rejectingCode,
  } = usePaymentAdmin(isAdmin);

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

  // Format amount to VND
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const getPlanBadgeClass = (planId: string) => {
    switch (planId?.toLowerCase()) {
      case 'premium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'pro':
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
      case 'basic':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getPlanDisplayName = (planId: string) => {
    switch (planId?.toLowerCase()) {
      case 'premium':
        return 'Pro';
      case 'pro':
        return 'Plus';
      case 'basic':
        return 'Cơ bản';
      case 'free':
        return 'Miễn phí';
      default:
        return planId;
    }
  };

  const getStatusBadgeClass = (statusStr: string) => {
    switch (statusStr) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'failed':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'approval_pending':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse';
      default:
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      {/* Light glow at the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,229,255,0.22),transparent_60%)]"
      />
      <div className="container relative max-w-6xl py-12">
        <header className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-brand-on-surface">
            <CreditCard className="h-3.5 w-3.5 text-brand-tertiary" />
            Quản lý tài chính
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-brand-on-surface">
              Thống kê & Quản lý Thanh toán
            </h1>
            <p className="mt-1 text-sm text-brand-on-surface-variant">
              Theo dõi doanh thu, lịch sử nâng cấp gói cước và trạng thái thanh toán qua
              VietQR/Casso.
            </p>
          </div>
        </header>

        {/* Stats Section */}
        {loadingStats ? (
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="glass-card h-28 animate-pulse rounded-2xl border border-brand-tertiary/15 p-6"
              />
            ))}
          </div>
        ) : errorStats ? (
          <div className="mb-8 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Không tải được thông tin báo cáo tài chính</p>
              <p className="text-red-200/80">{errorStats}</p>
            </div>
          </div>
        ) : (
          stats && (
            <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Revenue */}
              <div className="glass-card relative overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container/60 p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant/80">
                    Tổng doanh thu
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="h-4.5 w-4.5" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-2xl font-bold leading-none text-brand-on-surface">
                    {formatVND(stats.totalRevenue)}
                  </h3>
                  <p className="mt-1.5 text-xs text-brand-on-surface-variant/70">
                    Từ các đơn hàng thành công
                  </p>
                </div>
              </div>

              {/* Card 2: Successful Orders */}
              <div className="glass-card relative overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container/60 p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant/80">
                    Đơn thành công
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckCircle className="h-4.5 w-4.5" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-2xl font-bold leading-none text-brand-on-surface">
                    {stats.countsByStatus.completed}
                  </h3>
                  <p className="mt-1.5 text-xs text-brand-on-surface-variant/70">
                    {stats.countsByStatus.pending} đơn đang chờ xử lý
                  </p>
                </div>
              </div>

              {/* Card 3: Active Premium Users */}
              <div className="glass-card relative overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container/60 p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant/80">
                    Phân bố Gói (Thành công)
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <Award className="h-4.5 w-4.5" />
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-brand-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Pro (Premium):</span>
                    <span className="font-bold text-amber-400">{stats.countsByPlan.premium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plus (Pro):</span>
                    <span className="font-bold text-sky-400">{stats.countsByPlan.pro}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cơ bản (Basic):</span>
                    <span className="font-bold text-emerald-400">{stats.countsByPlan.basic}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Monthly Performance */}
              <div className="glass-card relative overflow-hidden rounded-2xl border border-brand-tertiary/20 bg-brand-surface-container/60 p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant/80">
                    Doanh thu tháng này
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <TrendingUp className="h-4.5 w-4.5" />
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-2xl font-bold leading-none text-brand-on-surface">
                    {stats.monthlyTrend.length > 0
                      ? formatVND(stats.monthlyTrend[stats.monthlyTrend.length - 1]?.revenue || 0)
                      : formatVND(0)}
                  </h3>
                  <p className="mt-1.5 text-xs text-brand-on-surface-variant/70">
                    Tháng:{' '}
                    {stats.monthlyTrend.length > 0
                      ? stats.monthlyTrend[stats.monthlyTrend.length - 1]?.month
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {/* Data Table Section */}
        <div className="relative overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Accent light on top border */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
          />

          {/* Table Toolbar */}
          <div className="flex flex-col justify-between gap-4 border-b border-brand-tertiary/15 px-6 py-5 md:flex-row md:items-center">
            {/* Search input */}
            <div className="group relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-on-surface-variant/60 transition-colors group-focus-within:text-brand-tertiary" />
              <Input
                type="text"
                placeholder="Mã chuyển khoản hoặc email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 pl-9 focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30"
              />
            </div>

            {/* Dropdown Filters and refresh */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter by Plan */}
              <CustomSelect
                value={plan}
                onChange={setPlan}
                placeholder="Mọi gói cước"
                options={[
                  { label: 'Mọi gói cước', value: '' },
                  { label: 'Gói Cơ bản', value: 'basic' },
                  { label: 'Gói Plus', value: 'pro' },
                  { label: 'Gói Pro', value: 'premium' },
                ]}
              />

              {/* Filter by Status */}
              <CustomSelect
                value={status}
                onChange={setStatus}
                placeholder="Mọi trạng thái"
                options={[
                  { label: 'Mọi trạng thái', value: '' },
                  { label: 'Chờ thanh toán', value: 'pending' },
                  { label: 'Chờ duyệt', value: 'approval_pending' },
                  { label: 'Thành công', value: 'completed' },
                  { label: 'Thất bại', value: 'failed' },
                ]}
              />

              {/* Refresh button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshAll}
                disabled={loadingList}
                className="h-10 px-3 text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-tertiary"
              >
                {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Làm mới'}
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <div className="p-6">
            {errorList && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Không tải được lịch sử thanh toán</p>
                  <p className="text-red-200/80">{errorList}</p>
                </div>
              </div>
            )}

            {loadingList ? (
              <div className="flex items-center justify-center py-16 text-brand-on-surface-variant">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-brand-outline-variant/30 bg-white/5 p-12 text-center text-sm text-brand-on-surface-variant">
                Không tìm thấy giao dịch thanh toán nào phù hợp với bộ lọc.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-brand-outline-variant/20 font-body text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant/80">
                        <th className="pb-3 pr-4">Mã đơn</th>
                        <th className="px-4 pb-3">Khách hàng</th>
                        <th className="px-4 pb-3">Gói cước</th>
                        <th className="px-4 pb-3">Số tiền</th>
                        <th className="px-4 pb-3 text-center">Trạng thái</th>
                        <th className="px-4 pb-3">Ngày tạo</th>
                        <th className="px-4 pb-3">Ngày thanh toán</th>
                        <th className="pb-3 pl-4 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-outline-variant/10 font-body text-sm">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]">
                          <td className="py-3.5 pr-4 font-mono text-[11px] font-bold text-brand-tertiary">
                            {tx.code}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-brand-on-surface">
                              {tx.userFullName || 'N/A'}
                            </div>
                            <div className="text-xs text-brand-on-surface-variant/70">
                              {tx.userEmail || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getPlanBadgeClass(tx.plan)}`}
                            >
                              {getPlanDisplayName(tx.plan)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-brand-secondary">
                            {formatVND(tx.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(tx.status)}`}
                            >
                              {tx.status === 'completed' && (
                                <CheckCircle className="h-3 w-3 shrink-0" />
                              )}
                              {tx.status === 'pending' && <Clock className="h-3 w-3 shrink-0" />}
                              {tx.status === 'approval_pending' && (
                                <Clock className="h-3 w-3 shrink-0 animate-pulse" />
                              )}
                              {tx.status === 'failed' && <XCircle className="h-3 w-3 shrink-0" />}
                              {tx.status === 'completed'
                                ? 'Thành công'
                                : tx.status === 'failed'
                                  ? 'Thất bại'
                                  : tx.status === 'approval_pending'
                                    ? 'Chờ duyệt'
                                    : 'Chờ xử lý'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-brand-on-surface-variant/80">
                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-brand-on-surface-variant/80">
                            {tx.paidAt ? (
                              <div>
                                <div>{new Date(tx.paidAt).toLocaleString('vi-VN')}</div>
                                <div className="font-mono text-[10px] text-slate-500">
                                  ID: {tx.transactionId || '-'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            {tx.status === 'completed' || tx.status === 'failed' ? (
                              <span className="text-xs text-brand-on-surface-variant/40">-</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onApprove(tx.code)}
                                  disabled={!!approvingCode || !!rejectingCode}
                                  className="h-7 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                                >
                                  {approvingCode === tx.code ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    'Duyệt'
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onReject(tx.code)}
                                  disabled={!!approvingCode || !!rejectingCode}
                                  className="h-7 rounded-md border border-rose-500/25 bg-rose-500/10 px-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                                >
                                  {rejectingCode === tx.code ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    'Từ chối'
                                  )}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-brand-outline-variant/10 pt-4 text-sm text-brand-on-surface-variant">
                    <div>
                      Trang <span className="font-semibold text-brand-on-surface">{page}</span> /{' '}
                      {totalPages} (Tổng cộng {total} giao dịch)
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
    </main>
  );
}

// Custom select dropdown component for unified premium theme
function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="relative w-44">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 px-3 py-2 text-sm text-brand-on-surface transition-all hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-brand-tertiary/30"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-on-surface-variant/70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-brand-outline-variant/20 bg-brand-surface-container-low p-1 shadow-xl backdrop-blur-xl duration-150 animate-in fade-in slide-in-from-top-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${
                opt.value === value
                  ? 'bg-brand-primary font-semibold text-white'
                  : 'text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
