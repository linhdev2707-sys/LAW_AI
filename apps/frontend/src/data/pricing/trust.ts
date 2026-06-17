// Trust indicators rendered between the pricing grid and the FAQ section.
// To add/remove a badge or change copy, edit this file only.

import { ShieldCheck, Zap, Award } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PricingTrustItem {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: 'emerald' | 'cyan' | 'amber';
}

export const TRUST_ITEMS: PricingTrustItem[] = [
  {
    icon: ShieldCheck,
    title: 'Bảo mật SSL',
    description: 'Mã hóa đầu cuối an toàn',
    tone: 'emerald',
  },
  {
    icon: Zap,
    title: 'Kích hoạt tức thì',
    description: 'Tự động ngay sau chuyển khoản',
    tone: 'cyan',
  },
  {
    icon: Award,
    title: 'Đổi trả 7 ngày',
    description: 'Hoàn tiền nếu không hài lòng',
    tone: 'amber',
  },
];
