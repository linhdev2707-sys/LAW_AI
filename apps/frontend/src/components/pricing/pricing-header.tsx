import { TrendingUp } from 'lucide-react';

/**
 * Hero section above the pricing grid: section badge, headline, accent bar,
 * and intro paragraph. Pure presentational — no props.
 */
export function PricingHeader() {
  return (
    <div className="mb-16 flex flex-col items-center text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-4 py-1.5 font-label text-label-md font-medium uppercase tracking-widest text-brand-tertiary">
        <TrendingUp className="h-4 w-4" />
        Bảng giá & Cơ cấu Chi phí
      </div>
      <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-brand-on-surface max-w-3xl leading-tight">
        Mô hình giá minh bạch & vận hành tinh gọn
      </h1>
      <div className="beam-gradient mt-6 h-1 w-24 rounded-full opacity-70" />
      <p className="mx-auto mt-6 max-w-2xl font-body text-base text-brand-on-surface-variant md:text-lg">
        Chúng tôi tối ưu hóa chi phí cố định để mang lại dịch vụ trợ lý pháp lý AI chất lượng cao với chi phí dễ tiếp cận nhất cho mọi người dân.
      </p>
    </div>
  );
}
