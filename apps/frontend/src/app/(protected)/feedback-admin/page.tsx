'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MessageSquare,
  Search,
  Loader2,
  Calendar,
  User as UserIcon,
  X,
  ChevronRight,
  ChevronDown,
  Filter,
  CheckCircle,
} from 'lucide-react';
import { UserRole } from '@law-ai/shared';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FeedbackUser {
  id: string;
  email: string;
  fullName: string;
}

interface Feedback {
  id: string;
  userId: string | null;
  responses: Record<string, any>;
  createdAt: string;
  user: FeedbackUser | null;
}

const QUESTION_MAP: Record<
  string,
  { label: string; type: 'text' | 'scale5' | 'scale10' | 'list' }
> = {
  q1: { label: '1. Bạn thuộc nhóm người dùng nào?', type: 'text' },
  q2: {
    label: '2. Trước khi sử dụng iLaw, mức độ hiểu biết của bạn về pháp luật là:',
    type: 'text',
  },
  q3: {
    label: '3. Khi sử dụng iLaw, bạn đã thử hỏi hoặc quan tâm đến lĩnh vực pháp luật nào?',
    type: 'list',
  },
  q4: {
    label: '4. Trước khi dùng iLaw, bạn thường tìm thông tin pháp luật bằng cách nào?',
    type: 'list',
  },
  q5: { label: '5. Bạn đã trải nghiệm những phần nào trên website iLaw?', type: 'list' },
  q6: { label: '6. Ấn tượng chung của bạn về website iLaw:', type: 'scale5' },
  q7: {
    label: '7. Giao diện website iLaw có dễ nhìn, rõ ràng và chuyên nghiệp không?',
    type: 'scale5',
  },
  q8: { label: '8. Bạn có dễ hiểu iLaw đang cung cấp những dịch vụ gì không?', type: 'scale5' },
  q9: { label: '9. Các thao tác chính trên website có dễ thực hiện không?', type: 'scale5' },
  q10: { label: '10. Điểm khiến bạn khó hiểu, bất tiện hoặc chưa hài lòng nhất:', type: 'text' },
  q11: { label: '11. Đánh giá độ hữu ích của iLaw trong việc tìm hiểu pháp luật:', type: 'scale5' },
  q12: { label: '12. Bạn hình dung iLaw hữu ích nhất trong tình huống nào?', type: 'list' },
  q13: {
    label: '13. Câu trả lời của iLaw có trình bày bằng ngôn ngữ dễ hiểu không?',
    type: 'scale5',
  },
  q14: {
    label: '14. Khi trải nghiệm nội dung tư vấn, bạn nhận thấy những yếu tố nào?',
    type: 'list',
  },
  q15: { label: '15. Phần nào tạo ấn tượng tốt nhất với bạn?', type: 'text' },
  q16: { label: '16. Mức độ tin tưởng câu trả lời/nội dung do iLaw cung cấp:', type: 'scale5' },
  q17: { label: '17. Yếu tố nào trên iLaw khiến bạn cảm thấy tin tưởng hơn?', type: 'list' },
  q18: { label: '18. Mức độ lo ngại iLaw có thể trả lời sai hoặc chưa cập nhật:', type: 'scale5' },
  q19: {
    label: '19. Đánh giá mức độ dễ tìm/dễ hiểu của trang điều khoản & chính sách:',
    type: 'text',
  },
  q20: { label: '20. Mức độ sẵn sàng tiếp tục sử dụng iLaw:', type: 'text' },
  q21: { label: '21. Mức giá hàng tháng thấy phù hợp cho iLaw:', type: 'text' },
  q22: { label: '22. Yếu tố khiến bạn cân nhắc trả phí cho iLaw:', type: 'list' },
  q23: { label: '23. Đánh giá trải nghiệm sử dụng iLaw:', type: 'scale10' },
  q24: { label: '24. Mức độ sẵn sàng giới thiệu iLaw cho người khác:', type: 'scale10' },
  q25: { label: '25. Đề xuất một thay đổi để iLaw tốt hơn:', type: 'text' },
};

const SECTIONS = [
  { title: 'Phần 1: Thông tin người dùng', fields: ['q1', 'q2', 'q3', 'q4', 'q5'] },
  { title: 'Phần 2: Cảm nhận về giao diện & thao tác', fields: ['q6', 'q7', 'q8', 'q9', 'q10'] },
  { title: 'Phần 3: Cảm nhận về tính hữu ích', fields: ['q11', 'q12', 'q13', 'q14', 'q15'] },
  { title: 'Phần 4: Độ tin cậy & Rủi ro khi dùng AI', fields: ['q16', 'q17', 'q18', 'q19'] },
  { title: 'Phần 5: Giá trị & Khả năng trả phí', fields: ['q20', 'q21', 'q22'] },
  { title: 'Phần 6: Đánh giá tổng thể', fields: ['q23', 'q24', 'q25'] },
];

export default function FeedbackAdminPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [satisfactionFilter, setSatisfactionFilter] = useState(''); // 'high' (8-10), 'medium' (5-7), 'low' (1-4), '' (all)
  const [typeFilter, setTypeFilter] = useState(''); // 'guest', 'user', '' (all)

  // Details panel
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

  // Authorization gate
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [sessionStatus, isAdmin, router]);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Feedback[]>('/api/v1/feedback/admin');
      setFeedbacks(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách ý kiến đóng góp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadFeedbacks();
    }
  }, [isAdmin]);

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="relative flex min-h-[60vh] items-center justify-center bg-brand-background text-brand-on-surface-variant">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  // Filter feedbacks
  const filteredFeedbacks = feedbacks.filter((fb) => {
    // 1. Search filter (email, fullName, or answers)
    const userString = fb.user
      ? `${fb.user.fullName} ${fb.user.email}`.toLowerCase()
      : 'ẩn danh khách';
    const textMatch = userString.includes(search.toLowerCase());

    // 2. Satisfaction score Q23 filter
    const score = fb.responses.q23 || 0;
    let scoreMatch = true;
    if (satisfactionFilter === 'high') scoreMatch = score >= 8;
    else if (satisfactionFilter === 'medium') scoreMatch = score >= 5 && score <= 7;
    else if (satisfactionFilter === 'low') scoreMatch = score >= 1 && score <= 4;

    // 3. User type filter
    const typeMatch = typeFilter === '' ? true : typeFilter === 'guest' ? !fb.userId : !!fb.userId;

    return textMatch && scoreMatch && typeMatch;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${time} - ${date}`;
  };

  // Render detailed answer inside panel
  const renderAnswerDetail = (key: string, value: any, type: string) => {
    if (value === undefined || value === null) {
      return <span className="italic text-brand-on-surface-variant/40">Không trả lời</span>;
    }

    if (type === 'scale5') {
      return (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((idx) => (
              <span
                key={idx}
                className={cn(
                  'h-2 w-7 rounded-sm',
                  idx <= value ? 'bg-brand-primary' : 'bg-white/10',
                )}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-brand-primary">{value} / 5</span>
        </div>
      );
    }

    if (type === 'scale10') {
      return (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((idx) => (
              <span
                key={idx}
                className={cn(
                  'h-2 w-3.5 rounded-sm',
                  idx <= value ? 'bg-brand-tertiary' : 'bg-white/10',
                )}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-brand-tertiary">{value} / 10</span>
        </div>
      );
    }

    if (type === 'list') {
      const items = Array.isArray(value) ? value : [value];
      if (items.length === 0)
        return <span className="italic text-brand-on-surface-variant/40">Không chọn mục nào</span>;
      return (
        <ul className="mt-1 space-y-1">
          {items.map((item: string, idx: number) => (
            <li
              key={idx}
              className="flex items-start gap-1.5 text-sm text-brand-on-surface-variant"
            >
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-tertiary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-brand-on-surface-variant">
        {value}
      </p>
    );
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,229,255,0.18),transparent_60%)]"
      />

      <div className="container relative max-w-6xl py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-brand-on-surface">
            <MessageSquare className="h-3.5 w-3.5 text-brand-primary" />
            Khảo sát & phản hồi
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-brand-on-surface">
              Ý kiến đóng góp người dùng
            </h1>
            <p className="mt-1 text-sm text-brand-on-surface-variant">
              Xem và phân tích phản hồi trải nghiệm phiên bản thử nghiệm (Beta) của iLaw.
            </p>
          </div>
        </header>

        {/* Toolbar & Filters */}
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border border-brand-outline-variant/15 bg-brand-surface-container/60 p-4 backdrop-blur-md md:flex-row md:items-center">
          {/* Search */}
          <div className="group relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-on-surface-variant/60 transition-colors group-focus-within:text-brand-primary" />
            <Input
              type="text"
              placeholder="Tìm theo email, tên, từ khoá..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 pl-9 text-brand-on-surface placeholder:text-brand-on-surface-variant/40 focus-visible:border-brand-primary focus-visible:ring-brand-primary/30"
            />
          </div>

          {/* Selector filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-brand-on-surface-variant" />
              <span className="text-xs font-medium text-brand-on-surface-variant">Lọc:</span>
            </div>

            <div className="relative w-52">
              <select
                value={satisfactionFilter}
                onChange={(e) => setSatisfactionFilter(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 py-2 pl-4 pr-10 text-sm text-brand-on-surface focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20"
              >
                <option value="">Mức độ hài lòng</option>
                <option value="high">Hài lòng cao (8-10)</option>
                <option value="medium">Trung bình (5-7)</option>
                <option value="low">Không hài lòng (1-4)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-on-surface-variant/60" />
            </div>

            <div className="relative w-52">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 py-2 pl-4 pr-10 text-sm text-brand-on-surface focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20"
              >
                <option value="">Đối tượng gửi</option>
                <option value="user">Đã đăng ký tài khoản</option>
                <option value="guest">Khách (Ẩn danh)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-on-surface-variant/60" />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadFeedbacks}
              disabled={loading}
              className="h-10 border border-brand-outline-variant/10 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-primary"
            >
              Làm mới
            </Button>
          </div>
        </div>

        {/* Table View */}
        <div className="relative overflow-hidden rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/30 shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-brand-outline-variant/15 bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-brand-on-surface-variant">
                  <th className="px-6 py-4">Ngày gửi</th>
                  <th className="px-6 py-4">Người đóng góp</th>
                  <th className="px-6 py-4 text-center">Giao diện (Q6)</th>
                  <th className="px-6 py-4 text-center">Hài lòng (Q23)</th>
                  <th className="px-6 py-4 text-center">Giới thiệu (Q24)</th>
                  <th className="px-6 py-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-outline-variant/10">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-brand-on-surface-variant"
                    >
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-brand-primary" />
                      Đang tải danh sách phản hồi...
                    </td>
                  </tr>
                ) : filteredFeedbacks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-brand-on-surface-variant"
                    >
                      Không tìm thấy ý kiến đóng góp nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredFeedbacks.map((fb) => {
                    const satisfaction = fb.responses.q23 || 0;
                    const interfaceScore = fb.responses.q6 || 0;
                    const recommendScore = fb.responses.q24 || 0;

                    return (
                      <tr
                        key={fb.id}
                        onClick={() => setSelectedFeedback(fb)}
                        className="group cursor-pointer transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-brand-on-surface-variant">
                          {formatDate(fb.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          {fb.user ? (
                            <div className="flex flex-col">
                              <span className="max-w-[200px] truncate text-sm font-semibold text-brand-on-surface">
                                {fb.user.fullName}
                              </span>
                              <span className="max-w-[200px] truncate text-xs text-brand-on-surface-variant/80">
                                {fb.user.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium italic text-brand-on-surface-variant/60">
                              Khách (Ẩn danh)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              'inline-flex h-7 w-12 items-center justify-center rounded-full text-xs font-bold',
                              interfaceScore >= 4
                                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : interfaceScore === 3
                                  ? 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                                  : 'border border-red-500/20 bg-red-500/10 text-red-400',
                            )}
                          >
                            {interfaceScore ? `${interfaceScore}/5` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              'inline-flex h-7 w-12 items-center justify-center rounded-full text-xs font-bold',
                              satisfaction >= 8
                                ? 'border border-brand-tertiary/20 bg-brand-tertiary/10 text-brand-tertiary'
                                : satisfaction >= 5
                                  ? 'border border-brand-primary/20 bg-brand-primary/10 text-brand-primary'
                                  : 'border border-red-500/20 bg-red-500/10 text-red-400',
                            )}
                          >
                            {satisfaction ? `${satisfaction}/10` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-semibold text-brand-on-surface">
                            {recommendScore !== undefined ? `${recommendScore}/10` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-on-surface-variant transition-all hover:bg-white/5 hover:text-brand-primary group-hover:translate-x-0.5"
                          >
                            <ChevronRight className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-out details panel (Drawer) */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop overlay */}
          <div
            onClick={() => setSelectedFeedback(null)}
            className="backdrop-blur-xs absolute inset-0 bg-black/75 duration-200 animate-in fade-in-0"
          />

          {/* Drawer content */}
          <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-brand-outline-variant/20 bg-brand-surface-container shadow-2xl duration-300 animate-in slide-in-from-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-brand-outline-variant/15 bg-white/[0.01] px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-brand-on-surface">
                  Chi tiết ý kiến đóng góp
                </h3>
                <p className="mt-0.5 text-xs text-brand-on-surface-variant">
                  Gửi lúc: {formatDate(selectedFeedback.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="rounded-full p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
                aria-label="Đóng panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              {/* User info details */}
              <div className="flex items-center gap-4 rounded-xl border border-brand-outline-variant/10 bg-white/[0.01] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-primary/20 bg-brand-primary/10 text-brand-primary">
                  <UserIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-brand-on-surface-variant">
                    Người đóng góp
                  </h4>
                  {selectedFeedback.user ? (
                    <div className="mt-0.5">
                      <p className="text-sm font-bold text-brand-on-surface">
                        {selectedFeedback.user.fullName}
                      </p>
                      <p className="text-xs text-brand-on-surface-variant/80">
                        {selectedFeedback.user.email}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-sm font-medium italic text-brand-on-surface-variant/70">
                      Khách (Ẩn danh)
                    </p>
                  )}
                </div>
              </div>

              {/* Loop sections & questions */}
              {SECTIONS.map((sec, idx) => (
                <div key={idx} className="space-y-4">
                  <h4 className="border-b border-brand-tertiary/10 pb-1.5 text-xs font-bold uppercase tracking-wider text-brand-tertiary">
                    {sec.title}
                  </h4>
                  <div className="space-y-5">
                    {sec.fields.map((field) => {
                      const qMeta = QUESTION_MAP[field];
                      const val = selectedFeedback.responses[field];
                      return (
                        <div key={field} className="space-y-1 text-left">
                          <p className="text-sm font-semibold leading-normal text-brand-on-surface">
                            {qMeta?.label || `${field.toUpperCase()}:`}
                          </p>
                          <div className="border-l-2 border-brand-outline-variant/15 py-1 pl-3">
                            {renderAnswerDetail(field, val, qMeta?.type || 'text')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-brand-outline-variant/15 bg-white/[0.01] px-6 py-4">
              <Button
                type="button"
                onClick={() => setSelectedFeedback(null)}
                className="bg-white/10 font-semibold text-brand-on-surface hover:bg-white/15"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
