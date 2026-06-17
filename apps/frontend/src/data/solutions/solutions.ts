// Solutions offered on the public marketing page. To add or modify a
// solution card, edit this file — the page renders the array unchanged.

import {
  MessageSquare,
  FileSearch,
  PenTool,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface SolutionItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  audience: string;
}

export const SOLUTIONS: SolutionItem[] = [
  {
    icon: MessageSquare,
    title: 'Hỏi đáp pháp luật',
    desc: 'Trò chuyện với AI để giải đáp mọi thắc mắc pháp lý, từ thủ tục hành chính đến tranh chấp dân sự, hình sự.',
    color: 'from-brand-primary to-brand-tertiary',
    audience: 'Cá nhân',
  },
  {
    icon: FileSearch,
    title: 'Tra cứu văn bản pháp luật',
    desc: 'Tìm kiếm nhanh điều luật, nghị định, thông tư còn hiệu lực – kèm trích dẫn nguồn chính xác.',
    color: 'from-brand-tertiary to-brand-primary',
    audience: 'Cá nhân · Sinh viên',
  },
  {
    icon: PenTool,
    title: 'Soạn thảo đơn từ & biểu mẫu',
    desc: 'Tạo đơn kiện, hợp đồng, đơn khiếu nại theo mẫu chuẩn, chỉ cần điền thông tin cơ bản.',
    color: 'from-emerald-500 to-brand-tertiary',
    audience: 'Cá nhân · Doanh nghiệp',
  },
  {
    icon: FileText,
    title: 'Phân tích hợp đồng',
    desc: 'AI quét hợp đồng, phát hiện điều khoản rủi ro, giải thích bằng ngôn ngữ dễ hiểu.',
    color: 'from-amber-500 to-brand-primary',
    audience: 'Doanh nghiệp · Startup',
  },
];
