import { LandingNavbar } from '@/components/landing/landing-navbar';
import { LandingHero } from '@/components/landing/landing-hero';
import { SocialProof } from '@/components/landing/social-proof';
import { FeaturesSection } from '@/components/landing/features-section';
import { CtaSection } from '@/components/landing/cta-section';
import { DisclaimerSection } from '@/components/landing/disclaimer-section';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingScroll } from '@/components/landing/landing-scroll';
import { FloatingChatbox } from '@/components/landing/floating-chatbox';
import { NewsSection } from '@/components/landing/news-section';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-brand-background text-brand-on-surface">
      <LandingNavbar />
      <LandingScroll />

      <LandingHero />
      <SocialProof />
      <FeaturesSection />
      <NewsSection />
      <CtaSection />
      <DisclaimerSection />
      <LandingFooter />

      {/* Portal — element sẽ render ra body, không bị parent stacking context ảnh hưởng */}
      <FloatingChatbox />
    </main>
  );
}
