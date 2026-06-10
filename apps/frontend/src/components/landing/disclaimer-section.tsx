import { Container } from './container';
import { MaterialIcon } from './material-icon';

const DISCLAIMER_POINTS = [
  {
    icon: 'info',
    title: 'Không thay thế tư vấn pháp lý chuyên nghiệp',
    description:
      'LAW AI cung cấp thông tin tham khảo dựa trên dữ liệu pháp lý và tiền lệ. Nội dung do hệ thống tạo ra KHÔNG cấu thành tư vấn pháp lý, ý kiến luật sư, hoặc khuyến nghị hành động cho vụ việc cụ thể của bạn.',
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
      'Chúng tôi không chịu trách nhiệm đối với bất kỳ thiệt hại trực tiếp, gián tiếp, ngẫu nhiên hay hệ quả nào phát sinh từ việc sử dụng hoặc không thể sử dụng thông tin do LAW AI cung cấp, kể cả trong bối cảnh tố tụng hoặc giao dịch pháp lý.',
  },
  {
    icon: 'policy',
    title: 'Bảo mật & quyền riêng tư',
    description:
      'Mọi dữ liệu bạn tải lên hệ thống được xử lý theo chính sách bảo mật của chúng tôi. Vui lòng KHÔNG đưa vào hệ thống các thông tin bí mật, dữ liệu cá nhân nhạy cảm, hoặc tài liệu thuộc diện bảo mật nghề nghiệp luật sư – khách hàng.',
  },
];

export function DisclaimerSection() {
  return (
    <section
      id="disclaimer"
      aria-labelledby="disclaimer-heading"
      className="relative py-24 md:py-32"
    >
      {/* Soft warning backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_60%)]" />

      <Container className="relative">
        <div className="mb-16 flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 font-label text-label-md font-medium uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <MaterialIcon name="warning" className="text-[18px]" />
            Miễn trừ trách nhiệm
          </div>
          <h2
            id="disclaimer-heading"
            className="mb-6 font-headline text-headline-lg font-medium text-brand-on-surface"
          >
            Điều khoản sử dụng & giới hạn
          </h2>
          <div className="beam-gradient h-1 w-24 rounded-full opacity-70" />
          <p className="mt-8 max-w-3xl font-body text-body-md leading-relaxed text-brand-on-surface-variant">
            Trước khi sử dụng LAW AI, vui lòng đọc kỹ các điều khoản miễn trừ trách nhiệm dưới
            đây. Bằng việc tiếp tục truy cập và sử dụng dịch vụ, bạn xác nhận đã hiểu và đồng ý
            với những giới hạn được nêu ra.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {DISCLAIMER_POINTS.map((point) => (
            <article
              key={point.title}
              className="glass-card flex h-full flex-col rounded-xl border-l-4 border-l-amber-500/60 p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                <MaterialIcon
                  name={point.icon}
                  className="text-[24px] text-amber-600 dark:text-amber-400"
                />
              </div>
              <h3 className="mb-3 font-headline text-headline-md font-medium text-brand-on-surface">
                {point.title}
              </h3>
              <p className="font-body text-body-md leading-relaxed text-brand-on-surface-variant">
                {point.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center font-body text-sm text-brand-on-surface-variant/80">
          Nếu bạn cần tư vấn cho vụ việc cụ thể, hãy liên hệ luật sư được cấp phép hành nghề tại
          Việt Nam. LAW AI là công cụ hỗ trợ nghiên cứu, không phải dịch vụ hành nghề luật.
        </p>
      </Container>
    </section>
  );
}
