import { Metadata } from 'next';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingFooter } from '@/components/landing/landing-footer';
import { Container } from '@/components/landing/container';
import { Button } from '@/components/ui/button';
import { ChatLink } from '@/components/landing/chat-link';
import {
  Heart,
  Users,
  Sparkles,
  MessageCircle,
  Mail,
  MapPin,
  Target,
  Compass,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Về chúng tôi | iLaw',
  description:
    'iLaw – Bạn đồng hành pháp luật. Trợ lý AI giúp mọi người dân tiếp cận pháp luật dễ dàng, nhanh chóng và minh bạch hơn.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <LandingNavbar />

      <main className="relative pt-32 pb-24">
        {/* Soft radial backdrop glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_60%)]" />

        <Container className="relative z-10 max-w-4xl">
          {/* Header */}
          <div className="mb-12 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-brand-tertiary">
              <Heart className="h-3.5 w-3.5" />
              Về chúng tôi
            </div>
            <h1 className="mt-4 font-headline text-3xl font-bold leading-tight tracking-tight sm:text-4xl text-brand-on-surface">
              iLaw – Bạn đồng hành pháp luật
            </h1>
            <div className="beam-gradient h-1 w-24 rounded-full mt-6 opacity-70" />
            <p className="mt-6 text-base md:text-lg leading-relaxed text-brand-on-surface-variant">
              Chúng tôi là một nhóm nhỏ những người yêu công nghệ và quan tâm đến pháp luật.
              iLaw ra đời với một mong muốn đơn giản: <strong className="text-brand-on-surface">giúp mọi người dân
              tiếp cận pháp luật dễ dàng hơn</strong> – bằng ngôn ngữ đời thường, thông qua một trợ lý AI thân thiện.
            </p>
          </div>

          {/* Main Card */}
          <div className="glass-card rounded-2xl p-6 md:p-12 shadow-2xl shadow-brand-tertiary/5 border border-brand-tertiary/15 space-y-10">
            {/* Sứ mệnh */}
            <section className="space-y-3">
              <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                <Target className="h-5 w-5 text-brand-tertiary" />
                Sứ mệnh
              </h2>
              <p className="text-brand-on-surface-variant leading-relaxed">
                Pháp luật Việt Nam rất phong phú nhưng cũng rất phức tạp. Chúng tôi tin rằng ai cũng xứng đáng
                được giải đáp những thắc mắc pháp lý của mình một cách nhanh chóng, dễ hiểu và miễn phí.
                iLaw được xây dựng để trở thành người bạn đồng hành đáng tin cậy – luôn sẵn sàng lắng nghe
                và đưa ra câu trả lời dựa trên các văn bản pháp luật hiện hành.
              </p>
            </section>

            {/* Giá trị cốt lõi */}
            <section className="space-y-3">
              <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                <Compass className="h-5 w-5 text-brand-tertiary" />
                Giá trị chúng tôi theo đuổi
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { icon: <Sparkles className="h-4 w-4" />, title: 'Đơn giản', desc: 'Giải thích bằng ngôn ngữ đời thường.' },
                  { icon: <Users className="h-4 w-4" />, title: 'Minh bạch', desc: 'Luôn trích dẫn điều luật cụ thể.' },
                  { icon: <Heart className="h-4 w-4" />, title: 'Thân thiện', desc: 'AI lắng nghe, không phán xét.' },
                  { icon: <MessageCircle className="h-4 w-4" />, title: 'Luôn sẵn sàng', desc: 'Hỗ trợ 24/7, bất kể ngày đêm.' },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-brand-outline-variant/15 bg-white/[0.02] p-4 flex items-start gap-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tertiary/10 text-brand-tertiary">
                      {item.icon}
                    </span>
                    <div>
                      <p className="font-semibold text-brand-on-surface">{item.title}</p>
                      <p className="text-brand-on-surface-variant text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Câu chuyện */}
            <section className="space-y-3">
              <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-tertiary" />
                Câu chuyện của chúng tôi
              </h2>
              <p className="text-brand-on-surface-variant leading-relaxed">
                iLaw được khởi tạo bởi một nhóm sinh viên và cộng sự tại Khu Công nghệ cao Hòa Lạc, Hà Nội.
                Xuất phát từ câu hỏi: <em className="text-brand-on-surface/90">&ldquo;Làm sao để một người bình thường –
                không phải luật sư – vẫn có thể hiểu và bảo vệ được quyền lợi của mình?&rdquo;</em>, chúng tôi bắt tay
                vào xây dựng một trợ lý pháp lý AI tận tâm, dễ dùng và đặt quyền lợi người dùng lên hàng đầu.
              </p>
              <p className="text-brand-on-surface-variant leading-relaxed">
                Đây vẫn là hành trình dài, và chúng tôi đang từng ngày hoàn thiện sản phẩm.
                Mọi góp ý của bạn đều là động lực để chúng tôi tiếp tục.
              </p>
            </section>

            {/* Liên hệ */}
            <section className="space-y-3">
              <h2 className="font-headline text-lg md:text-xl font-semibold text-brand-on-surface border-b border-brand-outline-variant/10 pb-2 flex items-center gap-2">
                <Mail className="h-5 w-5 text-brand-tertiary" />
                Liên hệ
              </h2>
              <div className="rounded-xl border border-brand-outline-variant/15 bg-white/[0.02] p-4 space-y-2 text-sm text-brand-on-surface-variant">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-brand-tertiary" />
                  <span>Email:</span>
                  <a href="mailto:ilaw.official@outlook.com" className="text-brand-tertiary hover:underline">
                    ilaw.official@outlook.com
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-tertiary" />
                  <span>Khu Công nghệ cao Hòa Lạc, Hà Nội</span>
                </p>
              </div>
            </section>

            <div className="h-px bg-brand-outline-variant/10" />

            {/* CTA */}
            <div className="text-center space-y-3">
              <p className="text-sm text-brand-on-surface-variant">
                Có câu hỏi pháp lý? Hãy bắt đầu trò chuyện với iLaw ngay nhé.
              </p>
              <Button
                asChild
                className="rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/50"
              >
                <ChatLink className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Trò chuyện với iLaw
                </ChatLink>
              </Button>
            </div>
          </div>
        </Container>
      </main>

      <LandingFooter />
    </div>
  );
}
