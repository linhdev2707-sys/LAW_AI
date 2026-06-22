import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { Providers } from '@/components/providers';

// Self-host Google Fonts via next/font — eliminates the render-blocking
// <link> tags the previous layout used and dodges the
// `no-page-custom-font` / `google-font-display` ESLint warnings.
// Variable axis exposes one CSS var per family, already wired into
// Tailwind's `font-sans` / `font-display` via globals.css.
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: 'iLaw | Giải đáp thắc mắc pháp luật 24/7',
  description:
    'Tận dụng sức mạnh của trí tuệ nhân tạo để tối ưu nghiên cứu pháp lý, phân tích tài liệu và quản lý vụ việc với độ chính xác tuyệt đối và tốc độ vượt trội.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        {/* Material Symbols Outlined — icon font used by MaterialIcon.
            Kept as a stylesheet link (next/font does not cover icon fonts)
            but with display=block so it never blocks first paint. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
