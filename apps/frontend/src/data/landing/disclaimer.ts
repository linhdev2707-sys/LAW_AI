// Disclaimer cards rendered in the landing page disclaimer section.
// Icon names match Material Icon glyphs used by the existing section.

export interface DisclaimerPoint {
  icon: string;
  title: string;
  description: string;
}

export const DISCLAIMER_POINTS: DisclaimerPoint[] = [
  {
    icon: 'info',
    title: 'Không thay thế tư vấn pháp lý chuyên nghiệp',
    description:
      'iLaw cung cấp thông tin tham khảo dựa trên dữ liệu pháp lý và tiền lệ. Nội dung do hệ thống tạo ra KHÔNG cấu thành tư vấn pháp lý, ý kiến luật sư, hoặc khuyến nghị hành động cho vụ việc cụ thể của bạn.',
  },
  {
    icon: 'gavel',
    title: 'Cần xác minh với nguồn chính thức',
    description:
      'Các văn bản pháp luật, án lệ và nghị định được hệ thống tổng hợp có thể đã được sửa đổi, bổ sung hoặc bãi bỏ. Người dùng có trách nhiệm kiểm tra lại với cơ quan có thẩm quyền và văn bản hiện hành trước khi áp dụng.',
  },
  {
    icon: 'verified_user',
    title: 'Giới hạn trách nhiệm pháp lý',
    description:
      'Chúng tôi không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hay hệ quả nào phát sinh từ việc sử dụng hoặc không thể sử dụng thông tin do iLaw cung cấp, kể cả trong bối cảnh tố tụng hoặc giao dịch pháp lý.',
  },
  {
    icon: 'policy',
    title: 'Bảo mật & quyền riêng tư',
    description:
      'Mọi dữ liệu bạn tải lên hệ thống được xử lý theo chính sách bảo mật của chúng tôi. Vui lòng KHÔNG đưa vào hệ thống các thông tin bí mật, dữ liệu cá nhân nhạy cảm, hoặc tài liệu thuộc diện bảo mật nghề nghiệp luật sư – khách hàng.',
  },
];
