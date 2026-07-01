// Static data for the pricing page — extracted from `app/pricing/page.tsx` so
// the page itself only deals with state + composition. To tweak plan pricing
// or copy, edit this file (no logic lives here).

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  priceVal: number;
  period: string;
  features: string[];
  isPopular?: boolean;
  originalPrice?: string;
  discountPercent?: number;
}

export const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Miễn phí',
    price: '0',
    priceVal: 0,
    period: 'tháng',
    features: [
      'Trò chuyện với AI để giải đáp thắc mắc',
      'Câu trả lời nhanh và dễ hiểu',
    ],
  },
  {
    id: 'basic',
    name: 'Cơ bản',
    price: '49.000',
    priceVal: 49000,
    period: 'tháng',
    features: [
      'Hạn mức cao hơn so với gói miễn phí',
      'Tìm kiếm thông tin và tài liệu',
      'Giải đáp chi tiết hơn cho các câu hỏi phức tạp',
      'Tốc độ phản hồi tiêu chuẩn',
    ],
  },
  {
    id: 'pro',
    name: 'Plus',
    price: '99.000',
    priceVal: 99000,
    period: 'tháng',
    features: [
      'Quyền lợi sử dụng được mở rộng đáng kể',
      'Bao gồm toàn bộ tính năng của gói Cơ Bản',
      'Tra cứu thông tin nhanh hơn với AI',
      'Ưu tiên xử lý câu hỏi',
    ],
    isPopular: true,
  },
  {
    id: 'premium',
    name: 'Pro',
    price: '249.000',
    priceVal: 249000,
    period: 'tháng',
    features: [
      'Tối đa hóa khả năng sử dụng mỗi tháng',
      'Bao gồm toàn bộ tính năng của gói Plus',
      'Truy cập các tính năng AI mới nhất',
      'Hỗ trợ ưu tiên',
    ],
  },
];
