// Target audiences displayed on the solutions page ("Phù hợp với ai?").
// Edit copy here — the section renders this list directly.

import { User, Briefcase, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AudienceItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export const AUDIENCES: AudienceItem[] = [
  {
    icon: User,
    title: 'Cá nhân',
    desc: 'Người dân cần tìm hiểu quyền lợi, thủ tục pháp lý nhanh chóng.',
  },
  {
    icon: Briefcase,
    title: 'Doanh nghiệp',
    desc: 'Hỗ trợ soạn thảo, rà soát hợp đồng và tuân thủ pháp luật.',
  },
  {
    icon: Building2,
    title: 'Tổ chức · Văn phòng luật',
    desc: 'Tăng năng suất tra cứu, nghiên cứu hồ sơ cho đội ngũ chuyên môn.',
  },
];
