// Link groups rendered in the landing page footer.
// To add or relabel a link, edit the array below.

export interface FooterLink {
  href: string;
  label: string;
}

export const LEGAL_LINKS: FooterLink[] = [
  { href: '#', label: 'Chính sách bảo mật' },
  { href: '/terms', label: 'Điều khoản dịch vụ' },
  { href: '#', label: 'Bảo mật' },
];

export const SUPPORT_LINKS: FooterLink[] = [
  { href: '#', label: 'Liên hệ hỗ trợ' },
  { href: '/pricing', label: 'Bảng giá & Gói dịch vụ' },
  { href: '#', label: 'Tài liệu hướng dẫn' },
  { href: '/feedback', label: 'Đánh giá & Góp ý' },
];
