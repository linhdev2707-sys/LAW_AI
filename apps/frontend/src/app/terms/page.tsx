import { Metadata } from 'next';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingFooter } from '@/components/landing/landing-footer';
import { Container } from '@/components/landing/container';
import { FileText, ShieldAlert, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | iLaw',
  description: 'Điều khoản sử dụng và quy định dịch vụ của iLaw – Bạn đồng hành pháp luật.',
};

export default function TermsPage() {
  const lastUpdated = '16/06/2026';

  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <LandingNavbar />

      <main className="relative pt-32 pb-24">
        {/* Soft radial backdrop glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,255,0.22),transparent_60%)]" />

        <Container className="relative z-10 max-w-4xl">
          {/* Header */}
          <div className="mb-12 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-brand-tertiary">
              <FileText className="h-3.5 w-3.5" />
              Văn bản pháp lý
            </div>
            <h1 className="mt-4 font-headline text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight text-brand-on-surface">
              Điều khoản sử dụng
            </h1>
            <div className="mt-3 flex items-center justify-center md:justify-start gap-2 text-sm text-brand-on-surface-variant">
              <Calendar className="h-4 w-4" />
              <span>Cập nhật lần cuối: {lastUpdated}</span>
            </div>
            <div className="beam-gradient h-1 w-24 rounded-full mt-6 opacity-70" />
          </div>

          {/* Main Card */}
          <div className="glass-card rounded-2xl p-6 md:p-12 shadow-2xl shadow-brand-tertiary/5 border border-brand-tertiary/15">
            <div className="prose prose-invert max-w-none text-brand-on-surface-variant leading-relaxed text-sm md:text-base space-y-8">
              <p className="text-brand-on-surface/90 font-medium">
                Chào mừng bạn đến với <strong>iLaw – Bạn đồng hành pháp luật</strong>. Điều khoản sử dụng này quy định các quyền và nghĩa vụ của người dùng khi truy cập và sử dụng website <a href="http://ilaw.io.vn" className="text-brand-tertiary hover:underline">ilaw.io.vn</a>.
              </p>
              <p className="text-brand-on-surface/90 font-medium">
                Bằng việc truy cập, đăng ký tài khoản hoặc sử dụng bất kỳ dịch vụ nào của iLaw, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ các điều khoản dưới đây.
              </p>

              <div className="h-px bg-brand-outline-variant/10 my-8" />

              {/* Sections */}
              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">1.</span> THÔNG TIN VỀ NỀN TẢNG
                </h2>
                <div className="pl-4 border-l-2 border-brand-tertiary/30 space-y-1">
                  <p><strong>Tên thương hiệu:</strong> iLaw – Bạn đồng hành pháp luật</p>
                  <p><strong>Website:</strong> <a href="http://ilaw.io.vn" className="text-brand-tertiary hover:underline">ilaw.io.vn</a></p>
                  <p><strong>Đơn vị vận hành:</strong> iLaw là dự án do nhóm khởi nghiệp vận hành</p>
                  <p><strong>Địa chỉ:</strong> Khu Công nghệ cao Hòa Lạc, Hà Nội</p>
                  <p><strong>Email hỗ trợ:</strong> <a href="mailto:ilaw.official@outlook.com" className="text-brand-tertiary hover:underline">ilaw.official@outlook.com</a></p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">2.</span> PHẠM VI DỊCH VỤ
                </h2>
                <p>iLaw cung cấp các dịch vụ hỗ trợ pháp lý bằng công nghệ AI, bao gồm nhưng không giới hạn:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>AI hỏi đáp pháp luật;</li>
                  <li>AI tra cứu văn bản pháp luật;</li>
                  <li>AI soạn thảo đơn từ và biểu mẫu;</li>
                  <li>AI hỗ trợ phân tích hợp đồng;</li>
                  <li>Kết nối người dùng với luật sư hoặc chuyên gia pháp lý;</li>
                  <li>Các dịch vụ và tính năng liên quan khác được công bố trên nền tảng.</li>
                </ul>
                <p className="italic text-xs text-brand-on-surface-variant/80">Chúng tôi có quyền bổ sung, thay đổi hoặc ngừng cung cấp một phần hoặc toàn bộ dịch vụ mà không cần thông báo trước.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">3.</span> ĐĂNG KÝ TÀI KHOẢN
                </h2>
                <p>Để sử dụng một số tính năng, người dùng có thể cần đăng ký tài khoản thông qua:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Tài khoản Google;</li>
                  <li>Email và mật khẩu.</li>
                </ul>
                <p>Người dùng cam kết:</p>
                <ul className="list-decimal pl-6 space-y-1">
                  <li>Cung cấp thông tin chính xác;</li>
                  <li>Không sử dụng thông tin giả mạo;</li>
                  <li>Bảo mật thông tin đăng nhập;</li>
                  <li>Chịu trách nhiệm đối với mọi hoạt động phát sinh từ tài khoản của mình.</li>
                </ul>
                <p className="text-amber-400/80 font-medium text-xs">Nếu phát hiện hành vi vi phạm, iLaw có quyền khóa hoặc chấm dứt tài khoản mà không cần báo trước.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">4.</span> NỘI DUNG DO AI CUNG CẤP
                </h2>
                <p>Các nội dung được tạo bởi hệ sinh thái AI của iLaw chỉ nhằm mục đích:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Tham khảo;</li>
                  <li>Học tập;</li>
                  <li>Nghiên cứu;</li>
                  <li>Hỗ trợ tiếp cận thông tin pháp luật.</li>
                </ul>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-2 text-brand-on-surface/90">
                  <p className="font-semibold text-amber-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <ShieldAlert className="h-4 w-4" />
                    Lưu ý đặc biệt quan trọng:
                  </p>
                  <ul className="list-decimal pl-5 space-y-1 text-sm text-brand-on-surface-variant">
                    <li>AI có thể tạo ra nội dung chưa chính xác hoặc chưa cập nhật;</li>
                    <li>Nội dung AI không phải là ý kiến tư vấn pháp lý chính thức;</li>
                    <li>Nội dung AI không thay thế luật sư, chuyên gia pháp lý hoặc cơ quan nhà nước có thẩm quyền.</li>
                  </ul>
                  <p className="text-xs font-medium text-brand-on-surface mt-2">Người dùng có trách nhiệm tự xác minh thông tin trước khi áp dụng vào thực tế.</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">5.</span> KẾT NỐI LUẬT SƯ
                </h2>
                <p>iLaw có thể cung cấp tính năng kết nối người dùng với luật sư hoặc chuyên gia pháp lý. Trong trường hợp này:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>iLaw chỉ đóng vai trò nền tảng kết nối;</li>
                  <li>Quan hệ giữa người dùng và luật sư được xác lập độc lập;</li>
                  <li>iLaw không chịu trách nhiệm đối với nội dung tư vấn hoặc thỏa thuận giữa các bên.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">6.</span> HÀNH VI BỊ CẤM
                </h2>
                <p>Người dùng tuyệt đối không được thực hiện các hành vi sau:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Vi phạm pháp luật Việt Nam;</li>
                  <li>Cung cấp thông tin giả mạo;</li>
                  <li>Xâm phạm quyền riêng tư của người khác;</li>
                  <li>Đăng tải nội dung xúc phạm, bôi nhọ hoặc quấy rối;</li>
                  <li>Tải lên mã độc, virus hoặc phần mềm gây hại;</li>
                  <li>Tấn công, can thiệp hoặc làm gián đoạn hoạt động của hệ thống;</li>
                  <li>Sử dụng nền tảng cho các hoạt động gian lận, lừa đảo hoặc trái pháp luật.</li>
                </ul>
                <p className="text-red-400/80 font-medium text-xs">Mọi hành vi vi phạm có thể dẫn đến việc khóa tài khoản và báo cáo cho cơ quan có thẩm quyền khi cần thiết.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">7.</span> QUYỀN SỞ HỮU TRÍ TUỆ
                </h2>
                <p>Toàn bộ nội dung thuộc nền tảng iLaw bao gồm:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Tên thương hiệu và Logo;</li>
                  <li>Thiết kế giao diện và trải nghiệm người dùng;</li>
                  <li>Mã nguồn, thuật toán và cơ sở dữ liệu hệ thống;</li>
                  <li>Nội dung do ban quản trị iLaw tạo lập;</li>
                </ul>
                <p>đều thuộc quyền sở hữu của iLaw hoặc các bên cấp phép hợp pháp. Người dùng không được sao chép, chỉnh sửa, phân phối hoặc khai thác thương mại khi chưa có sự đồng ý bằng văn bản của iLaw.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">8.</span> DỮ LIỆU NGƯỜI DÙNG
                </h2>
                <p>Khi sử dụng dịch vụ, người dùng đồng ý cho phép iLaw thu thập và xử lý các thông tin cần thiết như:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Họ tên (nếu cung cấp) và Email;</li>
                  <li>Số điện thoại (nếu có);</li>
                  <li>Nội dung câu hỏi và lịch sử sử dụng dịch vụ;</li>
                  <li>Các tài liệu được tải lên hệ thống.</li>
                </ul>
                <p>Việc xử lý dữ liệu được thực hiện bảo mật theo Chính sách bảo mật của iLaw.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">9.</span> GÓI DỊCH VỤ VÀ THANH TOÁN
                </h2>
                <p>iLaw có thể cung cấp các gói dịch vụ tùy biến:</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 my-2">
                  {['Miễn phí', 'Cơ bản', 'Pro', 'Cao cấp'].map((tier) => (
                    <div key={tier} className="border border-brand-outline-variant/20 bg-white/[0.02] p-3 text-center rounded-lg font-medium text-brand-on-surface text-sm">
                      {tier}
                    </div>
                  ))}
                </div>
                <p>Mức giá, quyền lợi và điều kiện sử dụng của từng gói sẽ được công bố chính thức trên website tại từng thời điểm. Người dùng có trách nhiệm thanh toán đầy đủ các khoản phí trước khi sử dụng các tính năng trả phí.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">10.</span> GIỚI HẠN TRÁCH NHIỆM
                </h2>
                <p>Trong phạm vi tối đa pháp luật cho phép, iLaw không chịu trách nhiệm đối với:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Sai sót trong nội dung do AI tự động tạo ra;</li>
                  <li>Thiệt hại phát sinh từ việc người dùng sử dụng thông tin trên nền tảng;</li>
                  <li>Tổn thất tài chính, thời gian hoặc cơ hội kinh doanh;</li>
                  <li>Sự cố kỹ thuật ngoài khả năng kiểm soát của chúng tôi;</li>
                  <li>Gián đoạn dịch vụ do các nguyên nhân bất khả kháng hoặc bảo trì định kỳ.</li>
                </ul>
                <p className="font-medium text-brand-on-surface text-xs italic">Người dùng tự chịu trách nhiệm đối với các quyết định được đưa ra dựa trên thông tin từ nền tảng.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">11.</span> TẠM NGỪNG HOẶC CHẤM DỨT DỊCH VỤ
                </h2>
                <p>iLaw có quyền:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Tạm ngừng hệ thống để bảo trì, sửa lỗi hoặc nâng cấp;</li>
                  <li>Thay đổi hoặc ngừng cung cấp dịch vụ;</li>
                  <li>Khóa hoặc chấm dứt tài khoản vi phạm điều khoản sử dụng mà không phát sinh nghĩa vụ bồi thường trong phạm vi pháp luật cho phép.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">12.</span> SỬA ĐỔI ĐIỀU KHOẢN
                </h2>
                <p>iLaw có quyền cập nhật hoặc sửa đổi Điều khoản sử dụng bất kỳ lúc nào. Phiên bản mới sẽ được đăng tải trên website và có hiệu lực kể từ thời điểm công bố. Việc tiếp tục sử dụng dịch vụ sau khi điều khoản được cập nhật đồng nghĩa với việc người dùng chấp nhận các thay đổi đó.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">13.</span> LUẬT ÁP DỤNG
                </h2>
                <p>Điều khoản sử dụng này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.</p>
                <p>Mọi tranh chấp phát sinh liên quan đến việc sử dụng dịch vụ sẽ được ưu tiên giải quyết thông qua thương lượng. Trường hợp không thể giải quyết bằng thương lượng, tranh chấp sẽ được đưa ra tòa án có thẩm quyền tại Việt Nam theo quy định của pháp luật.</p>
              </section>

              <section className="space-y-3">
                <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                  <span className="text-brand-tertiary">14.</span> THÔNG TIN LIÊN HỆ
                </h2>
                <div className="pl-4 border-l-2 border-brand-tertiary/30 space-y-1 text-sm">
                  <p><strong>iLaw – Bạn đồng hành pháp luật</strong></p>
                  <p><strong>Website:</strong> <a href="http://ilaw.io.vn" className="text-brand-tertiary hover:underline">ilaw.io.vn</a></p>
                  <p><strong>Email:</strong> <a href="mailto:ilaw.official@outlook.com" className="text-brand-tertiary hover:underline">ilaw.official@outlook.com</a></p>
                  <p><strong>Địa chỉ:</strong> Khu Công nghệ cao Hòa Lạc, Hà Nội</p>
                </div>
              </section>

              <div className="h-px bg-brand-outline-variant/10 my-8" />

              <p className="text-center text-xs text-brand-on-surface-variant font-medium">
                Khi sử dụng website ilaw.io.vn, người dùng xác nhận đã đọc, hiểu và đồng ý với toàn bộ Điều khoản sử dụng này.
              </p>
            </div>
          </div>
        </Container>
      </main>

      <LandingFooter />
    </div>
  );
}
