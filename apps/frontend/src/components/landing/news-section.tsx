'use client';

import { useEffect, useState } from 'react';
import { Newspaper, Calendar, Globe, ArrowRight, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Container } from './container';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  publishedAt: string;
  image?: string;
  link?: string;
}

export function NewsSection() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        const data = await apiFetch<NewsArticle[]>('/api/v1/news');
        setNews(data);
      } catch (err) {
        console.error('Failed to fetch legal news:', err);
      }
    }
    fetchNews().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="bg-brand-surface-container/10 py-16">
        <Container>
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-brand-primary"></div>
          </div>
        </Container>
      </section>
    );
  }

  if (news.length === 0) return null;

  return (
    <section className="border-t border-brand-outline-variant/10 bg-brand-surface-container-lowest/30 py-20">
      <Container>
        <div className="mb-12 flex items-center justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-primary">
              <Newspaper className="h-3.5 w-3.5" />
              Bản tin pháp luật
            </div>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-brand-on-surface">
              Tin tức & Cập nhật Pháp lý
            </h2>
            <p className="max-w-xl text-sm text-brand-on-surface-variant">
              Cập nhật các chính sách, nghị định và luật sửa đổi bổ sung mới nhất từ cơ quan nhà nước và ban quản trị.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {news.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="glass-card group flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/20 shadow-md transition-all duration-300 hover:border-brand-primary/40"
            >
              <div>
                {item.image && (
                  <div className="relative h-48 w-full overflow-hidden border-b border-brand-outline-variant/10 bg-black/20">
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between text-xs text-brand-on-surface-variant/80">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-brand-primary" />
                      {new Date(item.publishedAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {item.link ? (
                      <a
                        href={item.link.startsWith('/') ? (item.link.startsWith('/tin-tuc/') ? `https://moet.gov.vn${item.link}` : `https://moj.gov.vn${item.link}`) : item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-brand-primary hover:underline transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="h-3.5 w-3.5 text-brand-secondary" />
                        {item.source}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-brand-secondary" />
                        {item.source}
                      </span>
                    )}
                  </div>
                  <h3 className="line-clamp-2 font-headline text-lg font-bold text-brand-on-surface transition-colors group-hover:text-brand-primary">
                    {item.title}
                  </h3>
                  <p className="line-clamp-3 text-sm leading-relaxed text-brand-on-surface-variant/90">
                    {item.summary}
                  </p>
                </div>
              </div>
              <div className="px-6 pb-6">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(item)}
                  className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand-primary transition-colors hover:underline group-hover:text-brand-tertiary"
                >
                  Đọc toàn văn bài viết <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedArticle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              onClick={() => setSelectedArticle(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-primary/30 bg-brand-surface-container p-6 shadow-2xl shadow-black/80 duration-200 animate-in zoom-in-95 sm:p-8">
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="absolute right-4 top-4 rounded-full p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-6 overflow-y-auto pr-2">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-brand-on-surface-variant/80">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-brand-primary" />
                      {new Date(selectedArticle.publishedAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {selectedArticle.link ? (
                      <a
                        href={selectedArticle.link.startsWith('/') ? (selectedArticle.link.startsWith('/tin-tuc/') ? `https://moet.gov.vn${selectedArticle.link}` : `https://moj.gov.vn${selectedArticle.link}`) : selectedArticle.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-brand-primary hover:underline transition-colors"
                      >
                        <Globe className="h-3.5 w-3.5 text-brand-secondary" />
                        {selectedArticle.source}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-brand-secondary" />
                        {selectedArticle.source}
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline text-xl font-bold leading-snug text-brand-on-surface sm:text-2xl">
                    {selectedArticle.title}
                  </h3>
                </div>

                {selectedArticle.image && (
                  <div className="overflow-hidden rounded-xl border border-brand-outline-variant/15 max-h-72 w-full">
                    <img
                      src={selectedArticle.image}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="rounded-r-xl border-l-4 border-brand-primary/50 bg-brand-primary/5 p-4">
                  <p className="text-sm font-medium italic leading-relaxed text-brand-on-surface-variant">
                    {selectedArticle.summary}
                  </p>
                </div>
                <div className="space-y-4 whitespace-pre-line text-sm leading-relaxed text-brand-on-surface-variant sm:text-base">
                  {selectedArticle.content}
                </div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
