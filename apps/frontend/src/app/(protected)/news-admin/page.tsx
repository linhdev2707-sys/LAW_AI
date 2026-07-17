'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  Image as ImageIcon,
  X,
  Globe,
} from 'lucide-react';
import { UserRole } from '@law-ai/shared';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  image?: string;
  publishedAt: string;
  createdAt: string;
}

export default function NewsAdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const router = useRouter();

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');
  const [source, setSource] = useState('Admin');
  const [content, setContent] = useState('');

  // Delete state
  const [deletingArticle, setDeletingArticle] = useState<NewsArticle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.push('/dashboard');
    } else {
      fetchArticles();
    }
  }, [sessionStatus, isAdmin, router]);

  async function fetchArticles() {
    try {
      setLoading(true);
      const data = await apiFetch<NewsArticle[]>('/api/v1/news/admin');
      setArticles(data);
    } catch (err: any) {
      toast.error('Không thể tải danh sách bài viết', {
        description: err.message || 'Vui lòng thử lại sau.',
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingArticle(null);
    setTitle('');
    setImage('');
    setSource('Admin');
    setContent('');
    setIsFormOpen(true);
  }

  function openEditModal(article: NewsArticle) {
    setEditingArticle(article);
    setTitle(article.title);
    setImage(article.image || '');
    setSource(article.source || 'Admin');
    setContent(article.content);
    setIsFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !source.trim()) {
      toast.error('Vui lòng điền đầy đủ tiêu đề, nguồn và nội dung.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingArticle) {
        // Update
        const updated = await apiFetch<NewsArticle>(`/api/v1/news/admin/${editingArticle.id}`, {
          method: 'PUT',
          body: { title, content, image, source },
        });
        setArticles((prev) => prev.map((a) => (a.id === editingArticle.id ? updated : a)));
        toast.success('Đã cập nhật bài viết thành công!');
      } else {
        // Create
        const created = await apiFetch<NewsArticle>('/api/v1/news/admin', {
          method: 'POST',
          body: { title, content, image, source },
        });
        setArticles((prev) => [created, ...prev]);
        toast.success('Đã tạo bài viết mới thành công!');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error('Không thể lưu bài viết', {
        description: err.message || 'Đã xảy ra lỗi.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingArticle) return;
    try {
      setDeleteLoading(true);
      await apiFetch(`/api/v1/news/admin/${deletingArticle.id}`, {
        method: 'DELETE',
      });
      setArticles((prev) => prev.filter((a) => a.id !== deletingArticle.id));
      toast.success('Đã xóa bài viết thành công!');
    } catch (err: any) {
      toast.error('Không thể xóa bài viết', {
        description: err.message || 'Đã xảy ra lỗi.',
      });
    } finally {
      setDeleteLoading(false);
      setDeletingArticle(null);
    }
  }

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-surface-container-lowest">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-brand-surface-container-lowest px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-brand-on-surface sm:text-3xl">
              Quản lý bản tin
            </h1>
            <p className="text-sm text-brand-on-surface-variant">
              Viết bài, cập nhật các chính sách pháp luật mới hiển thị lên trang chủ
            </p>
          </div>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-primary to-brand-tertiary font-semibold text-white shadow-md shadow-brand-primary/20 hover:shadow-lg hover:shadow-brand-primary/30"
          >
            <Plus className="h-4 w-4" />
            Thêm bài viết
          </Button>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-outline-variant/30 py-16 text-center">
            <FileText className="h-12 w-12 text-brand-on-surface-variant/40" />
            <h3 className="mt-4 text-base font-semibold text-brand-on-surface">Không có bài viết nào</h3>
            <p className="mt-1 text-sm text-brand-on-surface-variant">
              Hãy bắt đầu viết bài đầu tiên cho bảng tin của bạn.
            </p>
            <Button onClick={openCreateModal} className="mt-4 bg-white/10 text-brand-on-surface hover:bg-white/15">
              Tạo bài viết mới
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-brand-outline-variant/15 bg-brand-surface-container/30 shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-brand-outline-variant/15 bg-white/[0.02] text-xs font-bold uppercase tracking-wider text-brand-on-surface-variant/80">
                    <th className="px-6 py-4">Hình ảnh</th>
                    <th className="px-6 py-4">Tiêu đề</th>
                    <th className="px-6 py-4">Ngày đăng</th>
                    <th className="px-6 py-4">Nguồn</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-outline-variant/10">
                  {articles.map((item) => (
                    <tr
                      key={item.id}
                      className="group text-sm text-brand-on-surface hover:bg-white/[0.01]"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="h-12 w-20 rounded-md object-cover border border-brand-outline-variant/15"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=300';
                            }}
                          />
                        ) : (
                          <div className="flex h-12 w-20 items-center justify-center rounded-md bg-white/5 border border-brand-outline-variant/10 text-brand-on-surface-variant/40">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium max-w-sm">
                        <div className="line-clamp-2" title={item.title}>
                          {item.title}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-brand-on-surface-variant/80">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-brand-primary" />
                          {new Date(item.publishedAt).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="flex items-center gap-1 text-brand-on-surface-variant/80 font-medium">
                          <Globe className="h-3.5 w-3.5 text-brand-secondary" />
                          {item.source}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-white/5"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingArticle(item)}
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Edit/Create Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            onClick={() => !submitting && setIsFormOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-xs duration-200 animate-in fade-in-0"
          />

          <form
            onSubmit={handleSubmit}
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-brand-outline-variant/20 bg-brand-surface-container shadow-2xl duration-300 animate-in slide-in-from-right"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-brand-outline-variant/15 bg-white/[0.01] px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-brand-on-surface">
                  {editingArticle ? 'Chỉnh sửa bài viết' : 'Thêm bài viết mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-full p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface"
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-on-surface">Tiêu đề bài viết *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề bài viết..."
                  required
                  disabled={submitting}
                  className="bg-white/5 border-brand-outline-variant/30 text-brand-on-surface focus:border-brand-primary"
                />
              </div>

              {/* Image URL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-on-surface">Link hình ảnh (URL)</label>
                <Input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://example.com/image.png"
                  disabled={submitting}
                  className="bg-white/5 border-brand-outline-variant/30 text-brand-on-surface focus:border-brand-primary"
                />
                {image.trim() && (
                  <div className="mt-2 rounded-lg border border-brand-outline-variant/15 overflow-hidden max-w-xs bg-white/5">
                    <img
                      src={image}
                      alt="Xem trước hình ảnh"
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=300';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Source */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-on-surface">Nguồn bài viết *</label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Admin"
                  required
                  disabled={submitting}
                  className="bg-white/5 border-brand-outline-variant/30 text-brand-on-surface focus:border-brand-primary"
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-on-surface">Nội dung bài viết *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung bài viết..."
                  required
                  disabled={submitting}
                  rows={14}
                  className="w-full rounded-md border border-brand-outline-variant/30 bg-white/5 px-3 py-2 text-sm text-brand-on-surface focus:outline-none focus:border-brand-primary disabled:opacity-50"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-brand-outline-variant/15 bg-white/[0.01] px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFormOpen(false)}
                disabled={submitting}
                className="text-brand-on-surface hover:bg-white/5"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-brand-primary to-brand-tertiary font-semibold text-white shadow-md shadow-brand-primary/20 hover:shadow-lg hover:shadow-brand-primary/30"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lưu...
                  </span>
                ) : (
                  'Lưu bài viết'
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingArticle}
        onOpenChange={(open) => !open && setDeletingArticle(null)}
        title="Xóa bài viết?"
        description="Hành động này sẽ xóa vĩnh viễn bài viết khỏi bảng tin và trang chủ. Bạn không thể hoàn tác."
        confirmLabel="Xóa bài viết"
        cancelLabel="Hủy"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </main>
  );
}
