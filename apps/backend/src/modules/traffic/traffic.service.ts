import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);
  private client: BetaAnalyticsDataClient | null = null;
  private propertyId = '';

  constructor(private readonly configService: ConfigService) {
    const clientEmail = this.configService.get<string>('app.ga.clientEmail');
    const privateKey = this.configService.get<string>('app.ga.privateKey');
    this.propertyId = this.configService.get<string>('app.ga.propertyId') || '';

    if (clientEmail && privateKey && this.propertyId) {
      try {
        this.client = new BetaAnalyticsDataClient({
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
        });
        this.logger.log('Google Analytics Data API client initialized successfully.');
      } catch (error) {
        this.logger.error('Failed to initialize Google Analytics client', error);
      }
    } else {
      this.logger.warn(
        'Google Analytics configuration is incomplete (missing clientEmail, privateKey, or propertyId). Running in fallback/mock mode.',
      );
    }
  }

  /**
   * Fetch traffic stats from GA4. If config is missing or GA API fails, return mock data.
   */
  async getTrafficStats() {
    if (!this.client || !this.propertyId) {
      this.logger.debug('Returning mock traffic stats (Google Analytics client not initialized).');
      return this.getMockTrafficStats();
    }

    try {
      // Fetch both historical (Core) and Realtime reports in parallel
      const [
        [aggregateResponse],
        [dailyResponse],
        [realtimeResponse],
        [realtimePagesResponse]
      ] = await Promise.all([
        // 1. Core Aggregate (sessions, avg duration)
        this.client.runReport({
          property: `properties/${this.propertyId}`,
          dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'averageSessionDuration' },
          ],
        }),
        // 2. Core Daily visits (for chart)
        this.client.runReport({
          property: `properties/${this.propertyId}`,
          dateRanges: [{ startDate: '13daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [
            {
              dimension: {
                dimensionName: 'date',
              },
              desc: false,
            },
          ],
        }),
        // 3. Realtime aggregate metrics (active users & page views in last 30 min)
        this.client.runRealtimeReport({
          property: `properties/${this.propertyId}`,
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' }
          ],
        }),
        // 4. Realtime Top Pages
        this.client.runRealtimeReport({
          property: `properties/${this.propertyId}`,
          dimensions: [
            { name: 'unifiedScreenName' }
          ],
          metrics: [
            { name: 'screenPageViews' }
          ],
          limit: 10
        })
      ]);

      // Parse Core Aggregate Metrics (historical)
      const aggRow = aggregateResponse?.rows?.[0];
      const sessionsVal = parseInt(aggRow?.metricValues?.[0]?.value || '0', 10);
      const avgDurationVal = parseFloat(aggRow?.metricValues?.[1]?.value || '0');
      const avgDurationFormatted = this.formatDuration(avgDurationVal);

      // Parse Realtime Aggregate Metrics (live)
      const realtimeRow = realtimeResponse?.rows?.[0];
      const activeUsersVal = parseInt(realtimeRow?.metricValues?.[0]?.value || '0', 10);
      const pageViewsVal = parseInt(realtimeRow?.metricValues?.[1]?.value || '0', 10);

      // Format Daily traffic chart data (Default to last 14 days with 0 visits)
      const dailyChartMap = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${d.getFullYear()}${month}${day}`;
        dailyChartMap.set(key, 0);
      }

      // Overwrite with real data from Google Analytics (if any)
      (dailyResponse?.rows || []).forEach((row) => {
        const rawDate = row.dimensionValues?.[0]?.value || '';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
        if (rawDate.length === 8) {
          dailyChartMap.set(rawDate, sessions);
        }
      });

      // Convert map to sorted daily chart array
      const dailyChart = Array.from(dailyChartMap.entries()).map(([rawDate, sessions]) => {
        const formattedDate = `${rawDate.substring(6, 8)}/${rawDate.substring(4, 6)}`;
        return { date: formattedDate, visits: sessions };
      });

      // Format Realtime Top pages
      const totalPageViews = pageViewsVal || 1;
      const pages = (realtimePagesResponse?.rows || []).map((row) => {
        const name = row.dimensionValues?.[0]?.value || 'Trang không có tên';
        // Generate a friendly path slug from page title
        const titlePart = (name.split('|')[0] || '').trim();
        const slug = titlePart
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese diacritics
          .replace(/[^a-z0-9]+/g, '-') // replace spaces/specials with dash
          .replace(/(^-|-$)/g, ''); // trim dashes
        const path = slug === 'trang-chu' || slug === 'ilaw' ? '/' : `/${slug}`;
        const views = parseInt(row.metricValues?.[0]?.value || '0', 10);
        const percent = ((views / totalPageViews) * 100).toFixed(1) + '%';
        return { path, name, views, percent };
      });

      return {
        summary: {
          sessions: sessionsVal,
          sessionsTrend: '+0.0%',
          activeUsers: activeUsersVal,
          activeUsersTrend: '+0.0%',
          pageViews: pageViewsVal,
          pageViewsTrend: '+0.0%',
          avgDuration: avgDurationFormatted,
          avgDurationTrend: '+0.0%',
        },
        dailyChart: dailyChart,
        topPages: pages,
        isRealData: true,
      };
    } catch (error) {
      this.logger.error('Failed to fetch data from Google Analytics API, falling back to mock data', error);
      return this.getMockTrafficStats();
    }
  }

  private formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds <= 0) return '0m 0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  private getMockTrafficStats() {
    return {
      summary: {
        sessions: 12450,
        sessionsTrend: '+12.4%',
        activeUsers: 8920,
        activeUsersTrend: '+8.2%',
        pageViews: 42130,
        pageViewsTrend: '+15.1%',
        avgDuration: '2m 45s',
        avgDurationTrend: '-2.5%',
      },
      dailyChart: this.getMockDailyChart(),
      topPages: this.getMockTopPages(),
      isRealData: false,
    };
  }

  private getMockDailyChart() {
    return [
      { date: '16/06', visits: 450 },
      { date: '17/06', visits: 520 },
      { date: '18/06', visits: 610 },
      { date: '19/06', visits: 580 },
      { date: '20/06', visits: 490 },
      { date: '21/06', visits: 420 },
      { date: '22/06', visits: 590 },
      { date: '23/06', visits: 680 },
      { date: '24/06', visits: 720 },
      { date: '25/06', visits: 810 },
      { date: '26/06', visits: 780 },
      { date: '27/06', visits: 550 },
      { date: '28/06', visits: 620 },
      { date: '29/06', visits: 890 },
    ];
  }

  private getMockTopPages() {
    return [
      { path: '/chat', name: 'Phòng Chat tư vấn Pháp luật AI', views: 18420, percent: '43.7%' },
      { path: '/', name: 'Trang chủ iLaw Landing', views: 12110, percent: '28.7%' },
      { path: '/dashboard', name: 'Bảng điều khiển cá nhân', views: 5120, percent: '12.2%' },
      { path: '/pricing', name: 'Bảng giá & Đăng ký gói hội viên', views: 3480, percent: '8.3%' },
      { path: '/solutions', name: 'Giải pháp doanh nghiệp', views: 3000, percent: '7.1%' },
    ];
  }
}
