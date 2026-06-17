// Static data for the pricing page — extracted from `app/pricing/page.tsx` so
// the page itself only deals with state + composition. To tweak plan pricing
// or copy, edit this file (no logic lives here).

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceVal: number;
  period: string;
  description: string;
  features: string[];
  /**
   * Optional helper text shown right under the quota feature (the first
   * entry in `features`). Use it to tell users how much MORE they get
   * versus the previous tier — empty/undefined means hide the helper.
   */
  quotaNote?: string;
  isPopular?: boolean;
}

export const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Miễn phí',
    price: '0',
    priceVal: 0,
    period: 'tháng',
    description: 'Phù hợp để trải nghiệm dịch vụ.',
    features: [
      '12 lượt hỏi mỗi tháng',
      'Trò chuyện với AI để giải đáp thắc mắc',
      'Câu trả lời nhanh và dễ hiểu',
      'Phù hợp để trải nghiệm dịch vụ',
    ],
  },
  {
    id: 'basic',
    name: 'Cơ bản',
    price: '69.000',
    priceVal: 69000,
    period: 'tháng',
    description: 'Phù hợp cho nhu cầu sử dụng thường xuyên.',
    features: [
      '72 lượt hỏi mỗi tháng',
      'Tìm kiếm thông tin và tài liệu',
      'Giải đáp chi tiết hơn cho các câu hỏi phức tạp',
      'Tốc độ phản hồi tiêu chuẩn',
      'Phù hợp cho nhu cầu sử dụng thường xuyên',
    ],
    quotaNote: 'Nhiều hơn 60 lượt so với gói Miễn Phí (tương đương ×6)',
  },
  {
    id: 'pro',
    name: 'Plus',
    price: '109.000',
    priceVal: 109000,
    period: 'tháng',
    description: 'Phù hợp cho cá nhân và doanh nghiệp nhỏ.',
    features: [
      '192 lượt hỏi mỗi tháng',
      'Bao gồm toàn bộ tính năng của gói Cơ Bản',
      'Tra cứu thông tin nhanh hơn với AI',
      'Ưu tiên xử lý câu hỏi',
    ],
    isPopular: true,
    quotaNote: 'Nhiều hơn 120 lượt so với gói Cơ Bản (tương đương ×2,7)',
  },
  {
    id: 'premium',
    name: 'Pro',
    price: '249.000',
    priceVal: 249000,
    period: 'tháng',
    description: 'Cá nhân hóa trải nghiệm sử dụng với quyền lực tối đa.',
    features: [
      '600 lượt hỏi mỗi tháng',
      'Bao gồm toàn bộ tính năng của gói Plus',
      'Truy cập các tính năng AI mới nhất',
      'Hỗ trợ ưu tiên',
    ],
    quotaNote: 'Nhiều hơn 408 lượt so với gói Plus (tương đương ×3,1)',
  },
];
