'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BarChart3,
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Clock,
  ExternalLink,
  Info,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { UserRole } from '@law-ai/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface TrafficSummary {
  sessions: number;
  sessionsTrend: string;
  activeUsers: number;
  activeUsersTrend: string;
  pageViews: number;
  pageViewsTrend: string;
  avgDuration: string;
  avgDurationTrend: string;
}

interface DailyChartItem {
  date: string;
  visits: number;
}

interface TopPageItem {
  path: string;
  name: string;
  views: number;
  percent: string;
}

interface TrafficStatsResponse {
  summary: TrafficSummary;
  dailyChart: DailyChartItem[];
  topPages: TopPageItem[];
  isRealData: boolean;
}

export default function TrafficDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  // Stats state
  const [data, setData] = useState<TrafficStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Authorization and Fetching
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await apiFetch<TrafficStatsResponse>('/api/v1/traffic/admin/traffic');
        setData(stats);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Không thể tải dữ liệu báo cáo lưu lượng truy cập');
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [sessionStatus, isAdmin, router]);

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="relative min-h-[60vh] overflow-hidden bg-brand-background text-brand-on-surface-variant">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.22),transparent_60%)]"
        />
        <div className="relative flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </div>
      </main>
    );
  }

  // Calculate chart max value
  const dailyChart = data?.dailyChart || [];
  const maxVisits = dailyChart.length > 0 ? Math.max(...dailyChart.map((d) => d.visits)) : 100;

  return (
    <main className="relative min-h-screen overflow-y-auto bg-brand-background text-brand-on-surface pb-12">
      {/* Cyan/Blue gradient glow background overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,229,255,0.22),transparent_60%)]"
      />

      <div className="container relative max-w-6xl px-6 py-12">
        {/* Header Section */}
        <header className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-primary">
            <BarChart3 className="h-3.5 w-3.5" />
            Quản trị hệ thống
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">
                Lưu lượng truy cập
              </h1>
              <p className="mt-1 text-sm text-brand-on-surface-variant/80">
                Thống kê lượt truy cập, người dùng hoạt động và hành vi dựa trên kết nối trực tiếp với Google Analytics 4 (GA4).
              </p>
            </div>

            {/* Status Badges */}
            {data && (
              <div className="flex items-center gap-2 self-start md:self-center">
                {data.isRealData ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    GA4 Real-Time Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Chế độ Xem mẫu (Demo)
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        {/* API Error Alert */}
        {error && (
          <div className="mb-8 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive flex gap-3.5 shadow-md">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-300 mb-1">Lỗi tải dữ liệu từ API</h4>
              <p className="text-red-200/80 leading-relaxed text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Connection Setup Guide (Toggleable) */}

        {loading ? (
          /* Loading Skeleton */
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          </div>
        ) : (
          data && (
            <div className="space-y-8">
              {/* Quick Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Sessions Card */}
                <div className="glass-card rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/30 p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">Số lượt truy cập</span>
                    <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {data.summary.sessions.toLocaleString('vi-VN')}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/15">
                      {data.summary.sessionsTrend}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-brand-on-surface-variant/60">Lượt tương tác trong 14 ngày</p>
                </div>

                {/* Active Users Card */}
                <div className="glass-card rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/30 p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">Người dùng hoạt động</span>
                    <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {data.summary.activeUsers.toLocaleString('vi-VN')}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/15">
                      {data.summary.activeUsersTrend}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-brand-on-surface-variant/60">Số lượng Visitors thực tế</p>
                </div>

                {/* Page Views Card */}
                <div className="glass-card rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/30 p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">Số lượt xem trang</span>
                    <div className="rounded-xl bg-pink-500/10 p-2.5 text-pink-400">
                      <Eye className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {data.summary.pageViews.toLocaleString('vi-VN')}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/15">
                      {data.summary.pageViewsTrend}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-brand-on-surface-variant/60">Tổng số lượt chuyển trang</p>
                </div>

                {/* Avg Session Duration Card */}
                <div className="glass-card rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/30 p-6 shadow-lg hover:shadow-xl transition-shadow duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">Thời gian trung bình</span>
                    <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold tracking-tight">
                      {data.summary.avgDuration}
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/15">
                      {data.summary.avgDurationTrend}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-brand-on-surface-variant/60">Thời lượng một phiên truy cập</p>
                </div>
              </div>

              {/* Custom Daily Traffic Chart */}
              {dailyChart.length > 0 && (
                <div className="glass-card rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/30 p-6 md:p-8 shadow-xl">
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-brand-on-surface flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-brand-primary" />
                        Biểu đồ lượt truy cập hàng ngày (Sessions)
                      </h3>
                      <p className="text-xs text-brand-on-surface-variant/80 mt-0.5">
                        Thống kê lượng truy cập chi tiết của người dùng trong 14 ngày qua.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-brand-on-surface-variant/70 bg-white/5 rounded-lg px-3 py-1.5 border border-brand-outline-variant/10">
                      <Calendar className="h-3.5 w-3.5 text-brand-tertiary" />
                      {dailyChart[0]?.date} - {dailyChart[dailyChart.length - 1]?.date}
                    </div>
                  </div>

                  {/* Chart Grid */}
                  <div className="relative pt-8 pb-4">
                    {/* Y-Axis Guidelines */}
                    <div className="absolute inset-x-0 bottom-10 top-8 flex flex-col justify-between pointer-events-none border-b border-brand-outline-variant/10">
                      <div className="w-full border-t border-brand-outline-variant/5 text-[9px] text-brand-on-surface-variant/40 pt-1">
                        {maxVisits.toLocaleString('vi-VN')} lượt
                      </div>
                      <div className="w-full border-t border-brand-outline-variant/5 text-[9px] text-brand-on-surface-variant/40 pt-1">
                        {Math.round(maxVisits * 0.75).toLocaleString('vi-VN')} lượt
                      </div>
                      <div className="w-full border-t border-brand-outline-variant/5 text-[9px] text-brand-on-surface-variant/40 pt-1">
                        {Math.round(maxVisits * 0.5).toLocaleString('vi-VN')} lượt
                      </div>
                      <div className="w-full border-t border-brand-outline-variant/5 text-[9px] text-brand-on-surface-variant/40 pt-1">
                        {Math.round(maxVisits * 0.25).toLocaleString('vi-VN')} lượt
                      </div>
                    </div>

                    {/* Bars Container */}
                    <div className="relative z-10 flex h-64 items-end justify-between gap-1.5 md:gap-3 px-2">
                      {dailyChart.map((dItem, idx) => {
                        const heightPercent = maxVisits > 0 ? (dItem.visits / maxVisits) * 100 : 0;
                        const isHovered = hoveredBar === idx;

                        return (
                          <div
                            key={idx}
                            className="group flex flex-1 flex-col items-center cursor-pointer h-full justify-end"
                            onMouseEnter={() => setHoveredBar(idx)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {/* Tooltip */}
                            <div
                              className={`absolute bottom-full mb-2 z-20 rounded-lg bg-brand-surface-container-highest border border-brand-outline-variant/30 px-2.5 py-1.5 text-center text-xs shadow-2xl transition-all duration-200 pointer-events-none ${
                                isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 translate-y-1'
                              }`}
                              style={{
                                left: `${(idx / dailyChart.length) * 100}%`,
                                transform: `translateX(-50%) translate3d(${isHovered ? '25px' : '0px'}, 0, 0)`,
                              }}
                            >
                              <div className="font-bold text-brand-on-surface">{dItem.visits.toLocaleString('vi-VN')} lượt</div>
                              <div className="text-[10px] text-brand-on-surface-variant/70">Ngày {dItem.date}</div>
                            </div>

                            {/* Bar */}
                            <div className="relative w-full rounded-t-md overflow-hidden bg-white/5 transition-all duration-300 h-[80%] flex items-end">
                              <div
                                className={`w-full rounded-t-md transition-all duration-500 bg-gradient-to-t ${
                                  idx === dailyChart.length - 1
                                    ? 'from-brand-tertiary to-brand-primary' // Today highlighted
                                    : isHovered
                                    ? 'from-brand-primary/80 to-brand-primary'
                                    : 'from-brand-primary/30 to-brand-primary/70'
                                }`}
                                style={{ height: `${heightPercent || 2}%` }} // Min height 2% so it is clickable
                              />
                            </div>

                            {/* X-Axis Label */}
                            <span className="mt-2.5 text-[9px] md:text-[10px] font-medium text-brand-on-surface-variant/70">
                              {dItem.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom: Top Visited Pages */}
              {data.topPages.length > 0 && (
                <div className="glass-card rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/30 p-6 md:p-8 shadow-xl">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-brand-on-surface flex items-center gap-2">
                      <Eye className="h-5 w-5 text-brand-secondary" />
                      Trang truy cập nhiều nhất (Top Pages)
                    </h3>
                    <p className="text-xs text-brand-on-surface-variant/80 mt-0.5">
                      Danh sách các trang có lượng xem nhiều nhất trên hệ thống iLaw được đo bằng GA4.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-brand-outline-variant/15 text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/70">
                          <th className="pb-3 pr-4">Đường dẫn (URL)</th>
                          <th className="pb-3 px-4">Tên tiêu đề trang</th>
                          <th className="pb-3 px-4 text-right">Số lượt xem</th>
                          <th className="pb-3 pl-4 text-right">% Tổng xem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-outline-variant/10">
                        {data.topPages.map((page, idx) => (
                          <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 pr-4 font-mono text-xs text-brand-primary font-semibold truncate max-w-[150px]" title={page.path}>
                              {page.path}
                            </td>
                            <td className="py-4 px-4 text-brand-on-surface/90 text-xs md:text-sm font-medium truncate max-w-[200px]" title={page.name}>
                              {page.name}
                            </td>
                            <td className="py-4 px-4 text-right font-semibold text-brand-on-surface">
                              {page.views.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-4 pl-4 text-right font-medium text-brand-on-surface-variant/80 text-xs">
                              {page.percent}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </main>
  );
}
