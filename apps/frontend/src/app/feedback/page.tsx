'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle2, Sparkles, MessageSquareHeart } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingFooter } from '@/components/landing/landing-footer';

// Define the survey options
const Q1_OPTIONS = [
  'Học sinh / Sinh viên',
  'Người đi làm',
  'Chủ hộ kinh doanh / Doanh nghiệp nhỏ',
  'Người học luật / Làm trong lĩnh vực pháp lý',
  'Người dùng phổ thông có nhu cầu tìm hiểu pháp luật',
];

const Q2_OPTIONS = [
  'Rất ít, gần như không có kiến thức pháp luật',
  'Có biết một số kiến thức cơ bản',
  'Hiểu tương đối về một vài lĩnh vực pháp luật',
  'Có chuyên môn hoặc đang học/làm trong ngành luật',
];

const Q3_OPTIONS = [
  'Dân sự',
  'Hình sự',
  'Lao động',
  'Hôn nhân và gia đình',
  'Đất đai / Nhà ở',
  'Hợp đồng',
  'Doanh nghiệp / Kinh doanh',
  'Thủ tục hành chính',
  'Thuế',
  'Sở hữu trí tuệ',
  'Tôi chỉ xem giao diện/chưa hỏi nội dung cụ thể',
];

const Q4_OPTIONS = [
  'Tìm kiếm trên Google',
  'Hỏi người quen',
  'Hỏi luật sư hoặc người có chuyên môn',
  'Đọc trực tiếp văn bản pháp luật',
  'Xem bài viết/video trên mạng xã hội',
  'Dùng chatbot AI như ChatGPT/Gemini/Copilot',
  'Tôi ít khi tìm thông tin pháp luật trước đây',
];

const Q5_OPTIONS = [
  'Xem trang chủ',
  'Đọc phần giới thiệu tính năng',
  'Thử trò chuyện với AI pháp luật',
  'Thử tra cứu văn bản pháp luật',
  'Xem phần bảng giá/gói dịch vụ',
  'Xem điều khoản sử dụng/chính sách liên quan',
  'Xem tính năng kết nối luật sư',
  'Tôi chỉ truy cập nhanh, chưa dùng sâu',
];

const Q12_OPTIONS = [
  'Hỏi nhanh một vấn đề pháp luật thường gặp',
  'Hiểu lại một vấn đề pháp luật bằng ngôn ngữ dễ hiểu hơn',
  'Tìm căn cứ pháp luật liên quan',
  'Tham khảo hướng xử lý ban đầu cho một tình huống',
  'Soạn hoặc tham khảo mẫu đơn/biểu mẫu',
  'Kiểm tra hoặc hiểu nội dung hợp đồng',
  'Chuẩn bị trước khi hỏi luật sư',
  'Tôi chưa thấy rõ tình huống sử dụng phù hợp',
];

// New options from Q14 to Q25
const Q14_OPTIONS = [
  'Câu trả lời ngắn gọn, dễ nắm ý chính',
  'Có giải thích theo từng bước',
  'Có căn cứ pháp luật hoặc điều luật liên quan',
  'Có cảnh báo rủi ro khi áp dụng',
  'Có gợi ý hướng xử lý tiếp theo',
  'Có nhắc người dùng liên hệ luật sư khi cần',
  'Câu trả lời còn chung chung',
  'Câu trả lời còn khó hiểu hoặc thiếu căn cứ',
];

const Q15_OPTIONS = [
  'Trò chuyện cùng AI pháp luật',
  'Tra cứu văn bản pháp luật',
  'Soạn thảo biểu mẫu',
  'Phần giới thiệu tính năng',
  'Phần bảng giá/gói dịch vụ',
  'Phần điều khoản/chính sách/cảnh báo',
  'Tính năng kết nối luật sư',
  'Chưa có phần nào tạo ấn tượng rõ ràng',
];

const Q17_OPTIONS = [
  'Giao diện rõ ràng, chuyên nghiệp',
  'Có mô tả rõ về chức năng của AI',
  'Có căn cứ pháp luật hoặc văn bản liên quan',
  'Có cảnh báo rằng nội dung AI chỉ mang tính tham khảo',
  'Có nhắc người dùng kiểm tra lại hoặc hỏi luật sư khi cần',
  'Có thông tin về điều khoản sử dụng/chính sách',
  'Có tính năng kết nối luật sư',
  'Hiện tại chưa có yếu tố nào khiến tôi thật sự tin tưởng',
];

const Q19_OPTIONS = [
  'Rất dễ tìm và dễ hiểu',
  'Khá dễ tìm và dễ hiểu',
  'Có thấy nhưng nội dung chưa thật sự rõ',
  'Khó tìm hoặc khó hiểu',
  'Tôi không thấy hoặc không đọc phần này',
];

const Q20_OPTIONS = [
  'Có, tôi muốn tiếp tục sử dụng',
  'Có thể, nếu chất lượng câu trả lời tốt hơn',
  'Có thể, nếu giao diện và trải nghiệm được cải thiện',
  'Chỉ sử dụng khi miễn phí',
  'Không có nhu cầu tiếp tục sử dụng',
];

const Q21_OPTIONS = [
  '0đ, tôi chỉ muốn dùng miễn phí',
  'Dưới 30.000đ/tháng',
  '30.000–50.000đ/tháng',
  '50.000–100.000đ/tháng',
  '100.000–200.000đ/tháng',
  'Trên 200.000đ/tháng nếu chất lượng thật sự tốt',
];

const Q22_OPTIONS = [
  'Câu trả lời chính xác và có căn cứ hơn',
  'Có trích dẫn văn bản pháp luật rõ ràng',
  'Tốc độ phản hồi nhanh và ổn định',
  'Giao diện dễ dùng hơn',
  'Có phân tích hợp đồng/tài liệu',
  'Có soạn mẫu đơn, biểu mẫu',
  'Có lưu lịch sử tư vấn',
  'Có kết nối luật sư khi cần',
  'Có cam kết bảo mật rõ ràng',
  'Hiện tại tôi chưa muốn trả phí',
];

export default function FeedbackPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form State Q1 - Q13
  const [q1, setQ1] = useState('');
  const [q1Other, setQ1Other] = useState('');
  const [q1IsOther, setQ1IsOther] = useState(false);

  const [q2, setQ2] = useState('');

  const [q3, setQ3] = useState<string[]>([]);
  const [q3Other, setQ3Other] = useState('');
  const [q3IsOther, setQ3IsOther] = useState(false);

  const [q4, setQ4] = useState<string[]>([]);
  const [q4Other, setQ4Other] = useState('');
  const [q4IsOther, setQ4IsOther] = useState(false);

  const [q5, setQ5] = useState<string[]>([]);
  const [q5Other, setQ5Other] = useState('');
  const [q5IsOther, setQ5IsOther] = useState(false);

  const [q6, setQ6] = useState<number | null>(null);
  const [q7, setQ7] = useState<number | null>(null);
  const [q8, setQ8] = useState<number | null>(null);
  const [q9, setQ9] = useState<number | null>(null);
  const [q10, setQ10] = useState('');

  const [q11, setQ11] = useState<number | null>(null);

  const [q12, setQ12] = useState<string[]>([]);
  const [q12Other, setQ12Other] = useState('');
  const [q12IsOther, setQ12IsOther] = useState(false);

  const [q13, setQ13] = useState<number | null>(null);

  // Form State Q14 - Q25
  const [q14, setQ14] = useState<string[]>([]);
  const [q14Other, setQ14Other] = useState('');
  const [q14IsOther, setQ14IsOther] = useState(false);

  const [q15, setQ15] = useState('');
  const [q15Other, setQ15Other] = useState('');
  const [q15IsOther, setQ15IsOther] = useState(false);

  const [q16, setQ16] = useState<number | null>(null);

  const [q17, setQ17] = useState<string[]>([]);
  const [q17Other, setQ17Other] = useState('');
  const [q17IsOther, setQ17IsOther] = useState(false);

  const [q18, setQ18] = useState<number | null>(null);

  const [q19, setQ19] = useState('');

  const [q20, setQ20] = useState('');

  const [q21, setQ21] = useState('');

  const [q22, setQ22] = useState<string[]>([]);
  const [q22Other, setQ22Other] = useState('');
  const [q22IsOther, setQ22IsOther] = useState(false);

  const [q23, setQ23] = useState<number | null>(null);
  const [q24, setQ24] = useState<number | null>(null);
  const [q25, setQ25] = useState('');

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Helpers to handle checkboxes
  const handleCheckboxChange = (
    val: string,
    state: string[],
    setState: (newVal: string[]) => void,
  ) => {
    if (state.includes(val)) {
      setState(state.filter((item) => item !== val));
    } else {
      setState([...state, val]);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];

    // Part 1
    if (!q1 && !q1IsOther) errors.push('Câu 1: Vui lòng chọn nhóm người dùng.');
    if (q1IsOther && !q1Other.trim()) errors.push('Câu 1: Vui lòng điền thông tin cho mục khác.');

    if (!q2) errors.push('Câu 2: Vui lòng chọn mức độ hiểu biết pháp luật.');

    if (q3.length === 0 && !q3IsOther) errors.push('Câu 3: Vui lòng chọn lĩnh vực pháp luật bạn quan tâm.');
    if (q3IsOther && !q3Other.trim()) errors.push('Câu 3: Vui lòng điền thông tin cho mục khác.');

    if (q4.length === 0 && !q4IsOther) errors.push('Câu 4: Vui lòng chọn cách tìm kiếm thông tin pháp luật trước đây.');
    if (q4IsOther && !q4Other.trim()) errors.push('Câu 4: Vui lòng điền thông tin cho mục khác.');

    if (q5.length === 0 && !q5IsOther) errors.push('Câu 5: Vui lòng chọn những phần đã trải nghiệm trên iLaw.');
    if (q5IsOther && !q5Other.trim()) errors.push('Câu 5: Vui lòng điền thông tin cho mục khác.');

    // Part 2
    if (q6 === null) errors.push('Câu 6: Vui lòng đánh giá ấn tượng chung về website.');
    if (q7 === null) errors.push('Câu 7: Vui lòng đánh giá mức độ chuyên nghiệp/dễ nhìn của giao diện.');
    if (q8 === null) errors.push('Câu 8: Vui lòng đánh giá mức độ dễ hiểu về dịch vụ iLaw cung cấp.');
    if (q9 === null) errors.push('Câu 9: Vui lòng đánh giá mức độ dễ thực hiện của các thao tác.');

    // Part 3
    if (q11 === null) errors.push('Câu 11: Vui lòng đánh giá tính hữu ích của iLaw.');

    if (q12.length === 0 && !q12IsOther) errors.push('Câu 12: Vui lòng chọn tình huống iLaw hữu ích nhất.');
    if (q12IsOther && !q12Other.trim()) errors.push('Câu 12: Vui lòng điền thông tin cho mục khác.');

    if (q13 === null) errors.push('Câu 13: Vui lòng đánh giá ngôn ngữ trình bày của iLaw.');

    // New validations Q14 - Q25
    if (q14.length === 0 && !q14IsOther) errors.push('Câu 14: Vui lòng chọn yếu tố nhận thấy khi trải nghiệm nội dung tư vấn.');
    if (q14IsOther && !q14Other.trim()) errors.push('Câu 14: Vui lòng điền thông tin cho mục khác.');

    if (!q15 && !q15IsOther) errors.push('Câu 15: Vui lòng chọn phần tạo ấn tượng tốt nhất.');
    if (q15IsOther && !q15Other.trim()) errors.push('Câu 15: Vui lòng điền thông tin cho mục khác.');

    // Part 4
    if (q16 === null) errors.push('Câu 16: Vui lòng đánh giá độ tin tưởng câu trả lời.');

    if (q17.length === 0 && !q17IsOther) errors.push('Câu 17: Vui lòng chọn yếu tố khiến bạn cảm thấy tin tưởng hơn.');
    if (q17IsOther && !q17Other.trim()) errors.push('Câu 17: Vui lòng điền thông tin cho mục khác.');

    if (q18 === null) errors.push('Câu 18: Vui lòng đánh giá độ lo ngại về sai sót/chưa cập nhật.');

    if (!q19) errors.push('Câu 19: Vui lòng đánh giá mức độ dễ tìm/dễ hiểu phần điều khoản và chính sách.');

    // Part 5
    if (!q20) errors.push('Câu 20: Vui lòng cho biết mức độ sẵn sàng tiếp tục sử dụng.');

    if (!q21) errors.push('Câu 21: Vui lòng chọn mức giá hàng tháng phù hợp.');
    
    // Q22 is optional

    // Part 6
    if (q23 === null) errors.push('Câu 23: Vui lòng đánh giá tổng thể trải nghiệm sử dụng iLaw.');
    if (q24 === null) errors.push('Câu 24: Vui lòng đánh giá mức độ sẵn sàng giới thiệu iLaw.');
    if (!q25.trim()) errors.push('Câu 25: Vui lòng đề xuất một thay đổi quan trọng nhất để iLaw tốt hơn.');

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Gửi khảo sát không thành công', {
        description: 'Vui lòng hoàn thành đầy đủ các câu hỏi bắt buộc (*).',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    // Format responses
    const finalResponses = {
      q1: q1IsOther ? `Mục khác: ${q1Other}` : q1,
      q2,
      q3: q3IsOther ? [...q3, `Mục khác: ${q3Other}`] : q3,
      q4: q4IsOther ? [...q4, `Mục khác: ${q4Other}`] : q4,
      q5: q5IsOther ? [...q5, `Mục khác: ${q5Other}`] : q5,
      q6,
      q7,
      q8,
      q9,
      q10,
      q11,
      q12: q12IsOther ? [...q12, `Mục khác: ${q12Other}`] : q12,
      q13,
      // Q14 - Q25
      q14: q14IsOther ? [...q14, `Mục khác: ${q14Other}`] : q14,
      q15: q15IsOther ? `Mục khác: ${q15Other}` : q15,
      q16,
      q17: q17IsOther ? [...q17, `Mục khác: ${q17Other}`] : q17,
      q18,
      q19,
      q20,
      q21,
      q22: q22IsOther ? [...q22, `Mục khác: ${q22Other}`] : q22,
      q23,
      q24,
      q25,
    };

    try {
      await apiFetch('/api/v1/feedback', {
        method: 'POST',
        body: { responses: finalResponses },
      });

      localStorage.setItem('lawai.beta_dismissed', 'true');
      setSubmitted(true);
      toast.success('Cảm ơn ý kiến của bạn!', {
        description: 'Phản hồi của bạn đã được ghi nhận thành công.',
      });
    } catch (err: any) {
      toast.error('Có lỗi xảy ra', {
        description: err.message || 'Không thể gửi phản hồi, vui lòng thử lại sau.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen bg-brand-background text-brand-on-surface flex-col justify-between">
        <LandingNavbar />
        <div className="flex-1 flex items-center justify-center pt-32 pb-16 px-4">
          <div className="relative w-full max-w-xl text-center">
            <div aria-hidden className="absolute -inset-10 z-0 bg-gradient-to-r from-brand-primary/20 via-brand-tertiary/20 to-transparent opacity-50 blur-3xl" />
            
            <div className="relative z-10 flex flex-col items-center rounded-2xl border border-brand-outline-variant/30 bg-brand-surface-container/60 p-8 md:p-12 shadow-2xl backdrop-blur-md">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tertiary/10 text-brand-tertiary">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              
              <h1 className="mt-6 text-3xl font-bold tracking-tight text-brand-on-surface">
                Gửi phản hồi thành công!
              </h1>
              
              <p className="mt-4 text-base leading-relaxed text-brand-on-surface-variant">
                iLaw chân thành cảm ơn những ý kiến đóng góp quý báu của bạn. 
                Sự hỗ trợ của bạn sẽ giúp hệ thống ngày càng hoàn thiện, chính xác và hữu ích hơn cho cộng đồng.
              </p>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  type="button"
                  onClick={() => router.push('/chat')}
                  className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-6 py-3 text-sm font-semibold text-brand-surface-container-lowest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-primary/20"
                >
                  <Sparkles className="h-4 w-4" />
                  Vào Trò chuyện ngay
                </button>
                
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center gap-2 rounded-lg border border-brand-outline-variant/30 bg-white/[0.03] hover:bg-white/[0.07] px-6 py-3 text-sm font-semibold text-brand-on-surface transition-all"
                >
                  Về Trang chủ
                </button>
              </div>
            </div>
          </div>
        </div>
        <LandingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-background text-brand-on-surface flex flex-col justify-between">
      <LandingNavbar />
      <div className="flex-1 pt-32 pb-16 px-4 md:px-8">
      {/* Decorative glows */}
      <div className="fixed -top-40 right-0 -z-10 h-96 w-96 rounded-full bg-brand-primary/10 blur-[100px] pointer-events-none" />
      <div className="fixed -bottom-40 left-0 -z-10 h-96 w-96 rounded-full bg-brand-tertiary/10 blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="group mb-8 flex items-center gap-2 text-sm font-semibold text-brand-on-surface-variant hover:text-brand-primary transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Quay lại
        </button>

        {/* Title Card */}
        <div className="relative mb-8 rounded-2xl border border-brand-primary/20 bg-brand-surface-container/60 p-6 md:p-8 shadow-2xl backdrop-blur-md overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-primary via-brand-tertiary to-brand-secondary" />
          <div className="flex gap-4 items-start">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              <MessageSquareHeart className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl text-brand-on-surface">iLaw - Đóng góp ý kiến trải nghiệm</h1>
              <p className="mt-2 text-sm leading-relaxed text-brand-on-surface-variant">
                Hệ thống iLaw hiện đang trong giai đoạn thử nghiệm Beta. Để nâng cao chất lượng dịch vụ, 
                chúng tôi mong muốn nhận được những cảm nhận thực tế của bạn sau khi trải nghiệm ứng dụng. 
                Vui lòng dành vài phút để hoàn thành bảng khảo sát toàn diện này. Chân thành cảm ơn bạn!
              </p>
              <p className="mt-3 text-xs text-brand-secondary/80 flex items-center gap-1.5 font-medium">
                <span>* Bắt buộc</span>
              </p>
            </div>
          </div>
        </div>

        {/* Validation Errors Header Alert */}
        {validationErrors.length > 0 && (
          <div className="mb-6 rounded-xl border border-brand-error/30 bg-brand-error-container/30 p-4 text-sm text-brand-error animate-in fade-in-50 duration-200">
            <p className="font-semibold mb-2">Vui lòng hoàn thành các trường sau:</p>
            <ul className="list-disc pl-5 space-y-1 max-h-48 overflow-y-auto">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* ========================================================
              PHẦN 1: THÔNG TIN NGƯỜI DÙNG
             ======================================================== */}
          <div className="rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/35 p-6 md:p-8 space-y-8 shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Phần 1</span>
              <h2 className="text-lg font-bold text-brand-on-surface mt-1">Thông tin người dùng & cách tiếp cận pháp luật</h2>
            </div>

            {/* Câu 1 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                1. Bạn thuộc nhóm người dùng nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q1_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="q1"
                      value={opt}
                      checked={q1 === opt && !q1IsOther}
                      onChange={() => {
                        setQ1(opt);
                        setQ1IsOther(false);
                      }}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="radio"
                    name="q1"
                    checked={q1IsOther}
                    onChange={() => {
                      setQ1('');
                      setQ1IsOther(true);
                    }}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q1Other}
                      disabled={!q1IsOther}
                      onChange={(e) => setQ1Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q1IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Câu 2 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                2. Trước khi sử dụng iLaw, mức độ hiểu biết của bạn về pháp luật là: <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q2_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="q2"
                      value={opt}
                      checked={q2 === opt}
                      onChange={() => setQ2(opt)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Câu 3 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                3. Khi sử dụng iLaw, bạn đã thử hỏi hoặc quan tâm đến lĩnh vực pháp luật nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q3_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q3.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q3, setQ3)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q3IsOther}
                    onChange={(e) => setQ3IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q3Other}
                      disabled={!q3IsOther}
                      onChange={(e) => setQ3Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q3IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Câu 4 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                4. Trước khi dùng iLaw, bạn thường tìm thông tin pháp luật bằng cách nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q4_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q4.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q4, setQ4)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q4IsOther}
                    onChange={(e) => setQ4IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q4Other}
                      disabled={!q4IsOther}
                      onChange={(e) => setQ4Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q4IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Câu 5 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                5. Bạn đã trải nghiệm những phần nào trên website iLaw? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q5_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q5.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q5, setQ5)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q5IsOther}
                    onChange={(e) => setQ5IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q5Other}
                      disabled={!q5IsOther}
                      onChange={(e) => setQ5Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q5IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ========================================================
              PHẦN 2: CẢM NHẬN VỀ GIAO DIỆN VÀ KHẢ NĂNG SỬ DỤNG
             ======================================================== */}
          <div className="rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/35 p-6 md:p-8 space-y-8 shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Phần 2</span>
              <h2 className="text-lg font-bold text-brand-on-surface mt-1">Cảm nhận về giao diện và khả năng sử dụng</h2>
            </div>

            {/* Câu 6 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                6. Sau khi trải nghiệm, ấn tượng chung của bạn về website iLaw là: <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất không tốt</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q6"
                          value={val}
                          checked={q6 === val}
                          onChange={() => setQ6(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất tốt</span>
                </div>
              </div>
            </div>

            {/* Câu 7 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                7. Giao diện website iLaw có dễ nhìn, rõ ràng và tạo cảm giác chuyên nghiệp không? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất không đồng ý</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q7"
                          value={val}
                          checked={q7 === val}
                          onChange={() => setQ7(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất đồng ý</span>
                </div>
              </div>
            </div>

            {/* Câu 8 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                8. Bạn có dễ hiểu iLaw đang cung cấp những dịch vụ gì không? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất khó hiểu</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q8"
                          value={val}
                          checked={q8 === val}
                          onChange={() => setQ8(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất dễ hiểu</span>
                </div>
              </div>
            </div>

            {/* Câu 9 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                9. Các thao tác chính trên website như bắt đầu trò chuyện, xem tính năng hoặc tìm thông tin có dễ thực hiện không? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất khó thao tác</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q9"
                          value={val}
                          checked={q9 === val}
                          onChange={() => setQ9(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất dễ thao tác</span>
                </div>
              </div>
            </div>

            {/* Câu 10 - Textarea */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                10. Trong quá trình sử dụng website, điểm nào khiến bạn khó hiểu, bất tiện hoặc chưa hài lòng nhất?
              </label>
              <textarea
                rows={4}
                placeholder="Câu trả lời của bạn..."
                value={q10}
                onChange={(e) => setQ10(e.target.value)}
                className="w-full rounded-xl border border-brand-outline-variant/30 bg-brand-surface-container-lowest px-4 py-3 text-sm text-brand-on-surface placeholder:text-brand-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>
          </div>

          {/* ========================================================
              PHẦN 3: CẢM NHẬN VỀ TÍNH HỮU ÍCH CỦA iLAW
             ======================================================== */}
          <div className="rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/35 p-6 md:p-8 space-y-8 shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Phần 3</span>
              <h2 className="text-lg font-bold text-brand-on-surface mt-1">Cảm nhận về tính hữu ích của iLaw</h2>
            </div>

            {/* Câu 11 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                11. Sau khi trải nghiệm, bạn đánh giá iLaw hữu ích đến mức nào trong việc hỗ trợ tìm hiểu pháp luật? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Hoàn toàn không hữu ích</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q11"
                          value={val}
                          checked={q11 === val}
                          onChange={() => setQ11(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất hữu ích</span>
                </div>
              </div>
            </div>

            {/* Câu 12 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                12. Bạn đã sử dụng hoặc hình dung iLaw hữu ích nhất trong tình huống nào sau khi trải nghiệm? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q12_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q12.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q12, setQ12)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q12IsOther}
                    onChange={(e) => setQ12IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q12Other}
                      disabled={!q12IsOther}
                      onChange={(e) => setQ12Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q12IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Câu 13 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                13. Câu trả lời hoặc nội dung trên iLaw có được trình bày bằng ngôn ngữ dễ hiểu không? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất khó hiểu</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q13"
                          value={val}
                          checked={q13 === val}
                          onChange={() => setQ13(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất dễ hiểu</span>
                </div>
              </div>
            </div>

            {/* Câu 14 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                14. Khi trải nghiệm câu trả lời/nội dung tư vấn trên iLaw, bạn nhận thấy những yếu tố nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q14_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q14.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q14, setQ14)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q14IsOther}
                    onChange={(e) => setQ14IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q14Other}
                      disabled={!q14IsOther}
                      onChange={(e) => setQ14Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q14IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Câu 15 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                15. Trong các phần bạn đã xem hoặc dùng, phần nào tạo ấn tượng tốt nhất với bạn? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q15_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="q15"
                      value={opt}
                      checked={q15 === opt && !q15IsOther}
                      onChange={() => {
                        setQ15(opt);
                        setQ15IsOther(false);
                      }}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="radio"
                    name="q15"
                    checked={q15IsOther}
                    onChange={() => {
                      setQ15('');
                      setQ15IsOther(true);
                    }}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q15Other}
                      disabled={!q15IsOther}
                      onChange={(e) => setQ15Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q15IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ========================================================
              PHẦN 4: CẢM NHẬN VỀ ĐỘ TIN CẬY VÀ RỦI RO KHI DÙNG AI
             ======================================================== */}
          <div className="rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/35 p-6 md:p-8 space-y-8 shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Phần 4</span>
              <h2 className="text-lg font-bold text-brand-on-surface mt-1">Cảm nhận về độ tin cậy và rủi ro khi dùng AI pháp luật</h2>
            </div>

            {/* Câu 16 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                16. Sau khi trải nghiệm, bạn tin tưởng câu trả lời/nội dung do iLaw cung cấp ở mức nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Hoàn toàn không tin tưởng</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q16"
                          value={val}
                          checked={q16 === val}
                          onChange={() => setQ16(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất tin tưởng</span>
                </div>
              </div>
            </div>

            {/* Câu 17 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                17. Yếu tố nào trên iLaw khiến bạn cảm thấy tin tưởng hơn? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q17_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q17.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q17, setQ17)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q17IsOther}
                    onChange={(e) => setQ17IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q17Other}
                      disabled={!q17IsOther}
                      onChange={(e) => setQ17Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q17IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* Câu 18 - 1-5 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                18. Sau khi sử dụng, bạn lo ngại iLaw có thể đưa ra câu trả lời sai, thiếu căn cứ hoặc chưa cập nhật ở mức nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4">
                <div className="flex items-center justify-between gap-4 px-2 sm:px-6">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Không lo ngại</span>
                  <div className="flex justify-between flex-1 max-w-[320px]">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q18"
                          value={val}
                          checked={q18 === val}
                          onChange={() => setQ18(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất lo ngại</span>
                </div>
              </div>
            </div>

            {/* Câu 19 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                19. Bạn đánh giá thế nào về mức độ dễ tìm và dễ hiểu của phần điều khoản sử dụng/chính sách/cảnh báo trên iLaw? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q19_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="q19"
                      value={opt}
                      checked={q19 === opt}
                      onChange={() => setQ19(opt)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================
              PHẦN 5: CẢM NHẬN VỀ GIÁ TRỊ VÀ KHẢ NĂNG TRẢ PHÍ
             ======================================================== */}
          <div className="rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/35 p-6 md:p-8 space-y-8 shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Phần 5</span>
              <h2 className="text-lg font-bold text-brand-on-surface mt-1">Cảm nhận về giá trị và khả năng trả phí</h2>
            </div>

            {/* Câu 20 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                20. Sau khi trải nghiệm, bạn có sẵn sàng tiếp tục sử dụng iLaw không? <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q20_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="q20"
                      value={opt}
                      checked={q20 === opt}
                      onChange={() => setQ20(opt)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Câu 21 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                21. Sau khi trải nghiệm, mức giá hàng tháng bạn thấy phù hợp cho iLaw là: <span className="text-brand-secondary">*</span>
              </label>
              <div className="space-y-2.5">
                {Q21_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="radio"
                      name="q21"
                      value={opt}
                      checked={q21 === opt}
                      onChange={() => setQ21(opt)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Câu 22 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                22. Sau khi trải nghiệm, yếu tố nào khiến bạn cân nhắc trả phí cho iLaw?
              </label>
              <div className="space-y-2.5">
                {Q22_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={q22.includes(opt)}
                      onChange={() => handleCheckboxChange(opt, q22, setQ22)}
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                    />
                    <span className="text-sm text-brand-on-surface-variant">{opt}</span>
                  </label>
                ))}

                {/* Option Other */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-brand-outline-variant/10 bg-white/[0.01] p-3 transition-colors hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={q22IsOther}
                    onChange={(e) => setQ22IsOther(e.target.checked)}
                    className="mt-1 h-4.5 w-4.5 shrink-0 cursor-pointer rounded border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                  />
                  <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm text-brand-on-surface-variant shrink-0">Mục khác:</span>
                    <input
                      type="text"
                      placeholder="Ý kiến khác của bạn..."
                      value={q22Other}
                      disabled={!q22IsOther}
                      onChange={(e) => setQ22Other(e.target.value)}
                      className={cn(
                        "w-full rounded-md border bg-brand-surface-container-lowest px-3 py-1.5 text-sm text-brand-on-surface focus:outline-none focus:ring-2",
                        q22IsOther 
                          ? "border-brand-primary/40 focus:border-brand-primary focus:ring-brand-primary/20" 
                          : "border-brand-outline-variant/20 opacity-50 cursor-not-allowed"
                      )}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ========================================================
              PHẦN 6: ĐÁNH GIÁ TỔNG THỂ
             ======================================================== */}
          <div className="rounded-2xl border border-brand-outline-variant/20 bg-brand-surface-container/35 p-6 md:p-8 space-y-8 shadow-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-tertiary">Phần 6</span>
              <h2 className="text-lg font-bold text-brand-on-surface mt-1">Đánh giá tổng thể</h2>
            </div>

            {/* Câu 23 - 1-10 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                23. Nhìn chung, bạn đánh giá trải nghiệm sử dụng iLaw ở mức nào? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4 overflow-x-auto">
                <div className="flex items-center justify-between gap-4 px-2 min-w-[500px]">
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất không hài lòng</span>
                  <div className="flex justify-between flex-1 max-w-[480px] mx-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q23"
                          value={val}
                          checked={q23 === val}
                          onChange={() => setQ23(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-medium text-brand-on-surface-variant/80 select-none">Rất hài lòng</span>
                </div>
              </div>
            </div>

            {/* Câu 24 - 0-10 scale */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                24. Sau khi trải nghiệm, bạn có sẵn sàng giới thiệu iLaw cho người khác không? <span className="text-brand-secondary">*</span>
              </label>
              <div className="flex flex-col space-y-2 rounded-xl bg-white/[0.02] border border-brand-outline-variant/5 p-4 overflow-x-auto">
                <div className="flex items-center justify-between gap-4 px-2 min-w-[500px]">
                  <div className="flex flex-col text-xs text-brand-on-surface-variant/80 select-none max-w-[80px]">
                    <span>Chắc chắn không</span>
                    <span>giới thiệu</span>
                  </div>
                  <div className="flex justify-between flex-1 max-w-[520px] mx-4">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                      <div key={val} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs text-brand-on-surface-variant font-semibold">{val}</span>
                        <input
                          type="radio"
                          name="q24"
                          value={val}
                          checked={q24 === val}
                          onChange={() => setQ24(val)}
                          className="h-5 w-5 cursor-pointer border-brand-outline-variant/40 bg-brand-surface text-brand-primary accent-brand-primary focus:ring-brand-primary/40"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col text-xs text-brand-on-surface-variant/80 select-none max-w-[85px] text-right">
                    <span>Chắc chắn sẽ</span>
                    <span>giới thiệu</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Câu 25 - Textarea */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-brand-on-surface leading-snug">
                25. Nếu chỉ được đề xuất một thay đổi để iLaw tốt hơn, bạn muốn thay đổi điều gì nhất? <span className="text-brand-secondary">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="Câu trả lời của bạn..."
                value={q25}
                onChange={(e) => setQ25(e.target.value)}
                className="w-full rounded-xl border border-brand-outline-variant/30 bg-brand-surface-container-lowest px-4 py-3 text-sm text-brand-on-surface placeholder:text-brand-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-8 py-4 text-base font-bold text-brand-surface-container-lowest transition-all hover:scale-[1.01] hover:shadow-xl hover:shadow-brand-primary/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang gửi khảo sát...
                </>
              ) : (
                'Gửi ý kiến đóng góp'
              )}
            </button>
          </div>
        </form>
      </div>
      </div>
      <LandingFooter />
    </div>
  );
}
