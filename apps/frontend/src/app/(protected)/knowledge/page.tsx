'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Database,
  FileText,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { UserRole } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ApiError } from '@/lib/api';
import { formatBytes, formatDateTime, ragAdminApi } from '@/lib/rag-admin';
import type { IRagDocument, RagDocumentStatus } from '@/types/rag';

const ACCEPTED = '.pdf,.docx,.txt,.md,.markdown';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — matches BE limit
// R2 bucket naming: lowercase letters, digits, hyphens, 3-63 chars.
const BUCKET_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * Admin-only page for managing the RAG knowledge base.
 *
 * Features:
 *  - Upload PDF/DOCX/TXT/MD files (multipart, up to 10 MB) into a chosen
 *    R2 bucket (or create a new one on the fly)
 *  - List all documents with status, size, chunk count, bucket
 *  - Delete with confirmation (object only — bucket is preserved)
 */
export default function KnowledgePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const [docs, setDocs] = useState<IRagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(true);

  const [name, setName] = useState('');
  const [bucket, setBucket] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingDelete, setPendingDelete] = useState<IRagDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [showCreateBucket, setShowCreateBucket] = useState(false);

  // ── Authorisation gate ───────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [sessionStatus, isAdmin, router]);

  // ── Load buckets + docs ──────────────────────────────────────────────
  const refreshBuckets = useCallback(async () => {
    setBucketsLoading(true);
    try {
      const list = await ragAdminApi.listBuckets();
      setBuckets(list);
      // Auto-select first bucket if nothing chosen yet
      setBucket((prev) => prev || list[0] || '');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không tải được danh sách bucket';
      toast.error('Không tải được danh sách bucket', { description: msg });
    } finally {
      setBucketsLoading(false);
    }
  }, []);

  const refreshDocs = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await ragAdminApi.list();
      setDocs(list);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Không tải được danh sách';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void refreshBuckets();
      void refreshDocs();
    }
  }, [isAdmin, refreshBuckets, refreshDocs]);

  // ── Upload ───────────────────────────────────────────────────────────
  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !name) {
      const dot = f.name.lastIndexOf('.');
      setName(dot > 0 ? f.name.slice(0, dot) : f.name);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !name.trim() || !bucket.trim() || uploading) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error('File quá lớn', { description: 'Tối đa 10 MB' });
      return;
    }
    if (file.size === 0) {
      toast.error('File rỗng');
      return;
    }

    setUploading(true);
    try {
      const res = await ragAdminApi.upload({
        name: name.trim(),
        bucket: bucket.trim(),
        file,
      });
      toast.success('Đã tải lên tài liệu', {
        description: `${res.chunkCount} chunk đã được tạo trong bucket "${bucket.trim()}".`,
      });
      setName('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshDocs();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Tải lên thất bại';
      toast.error('Tải lên thất bại', { description: msg });
    } finally {
      setUploading(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async function onConfirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const id = pendingDelete.id;
    try {
      await ragAdminApi.remove(id);
      toast.success('Đã xoá tài liệu', { description: pendingDelete.name });
      setPendingDelete(null);
      await refreshDocs();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Xoá thất bại';
      toast.error('Xoá thất bại', { description: msg });
    } finally {
      setDeleting(false);
    }
  }

  // ── Create bucket ────────────────────────────────────────────────────
  async function onCreateBucket(name: string) {
    if (!BUCKET_NAME_REGEX.test(name)) {
      toast.error('Tên bucket không hợp lệ', {
        description: 'Chỉ chữ thường, số, dấu gạch ngang, 3-63 ký tự.',
      });
      return false;
    }
    try {
      const res = await ragAdminApi.createBucket({ name });
      toast.success('Đã tạo bucket', { description: res.name });
      await refreshBuckets();
      setBucket(res.name);
      setShowCreateBucket(false);
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Tạo bucket thất bại';
      toast.error('Tạo bucket thất bại', { description: msg });
      return false;
    }
  }

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="relative min-h-[60vh] overflow-hidden bg-brand-background text-brand-on-surface-variant">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.10),transparent_60%)]"
        />
        <div className="relative flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-background text-brand-on-surface">
      {/* Soft cyan glow at the top — matches landing/chat backdrop so the
          page feels like part of the same app, not a separate white screen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.10),transparent_60%)]"
      />
      <div className="container relative max-w-6xl py-12">
      <header className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-tertiary/30 bg-brand-tertiary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-brand-on-surface">
          <Database className="h-3.5 w-3.5 text-brand-tertiary" />
          Quản trị
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-brand-on-surface">
          Quản lý Knowledge
        </h1>
        <p className="mt-1 text-sm text-brand-on-surface-variant">
          Tải lên tài liệu pháp lý vào từng bucket R2 riêng biệt theo bộ luật.
        </p>
      </header>

      {/* ── 2-column layout ──────────────────────────────────────────
          Sticky form on the left (always reachable while scrolling
          through the doc list); doc list takes the wider right column. */}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
        {/* ── Upload form (left, sticky) ─────────────────────────────── */}
        <div className="lg:sticky lg:top-6">
          <div className="relative overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
            {/* Top accent line — matches auth/chat dialog pattern */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
            />
            <div className="border-b border-brand-tertiary/15 px-6 py-5">
              <h2 className="flex items-center gap-2 font-headline text-lg font-semibold text-brand-on-surface">
                <UploadCloud className="h-5 w-5 text-brand-tertiary" />
                Tải lên tài liệu mới
              </h2>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Hỗ trợ PDF, DOCX, TXT, Markdown — tối đa 10 MB.
              </p>
            </div>
            <form onSubmit={onSubmit} className="grid gap-4 p-6">
              <div className="grid gap-2">
                <Label htmlFor="name">Tên tài liệu</Label>
                <Input
                  id="name"
                  placeholder="VD: Bộ luật Dân sự 2015"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  required
                  disabled={uploading}
                  className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bucket">Bucket R2</Label>
                <select
                  id="bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  required
                  disabled={uploading || bucketsLoading}
                  className="flex h-10 w-full rounded-md border border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 px-3 py-2 text-sm text-brand-on-surface focus-visible:border-brand-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-tertiary/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bucketsLoading ? (
                    <option value="">Đang tải…</option>
                  ) : buckets.length === 0 ? (
                    <option value="">— Chưa có bucket, hãy tạo —</option>
                  ) : (
                    buckets.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateBucket(true)}
                  disabled={uploading}
                  className="mt-1 inline-flex w-fit items-center gap-1 text-xs text-brand-tertiary transition-colors hover:text-brand-primary disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  Tạo bucket mới
                </button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={onPickFile}
                  required
                  disabled={uploading}
                  className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 file:mr-3 file:rounded file:border-0 file:bg-brand-tertiary/15 file:px-3 file:py-1 file:text-xs file:font-medium file:text-brand-tertiary hover:file:bg-brand-tertiary/25 focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30"
                />
                {file && (
                  <p className="text-xs text-brand-on-surface-variant">
                    Đã chọn:{' '}
                    <span className="font-medium text-brand-on-surface">
                      {file.name}
                    </span>
                    {' · '}
                    {formatBytes(file.size)}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={
                    uploading || !file || !name.trim() || !bucket.trim()
                  }
                  className="w-full"
                >
                  {uploading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải lên…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <UploadCloud className="h-4 w-4" />
                      Tải lên
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setName('');
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={uploading || (!name && !file)}
                  className="w-full"
                >
                  Xoá form
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Document list (right) ──────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Top accent line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
          />
          <div className="flex flex-row items-center justify-between gap-3 border-b border-brand-tertiary/15 px-6 py-5">
            <div>
              <h2 className="flex items-center gap-2 font-headline text-lg font-semibold text-brand-on-surface">
                <FileText className="h-5 w-5 text-brand-tertiary" />
                Tài liệu đã tải lên
              </h2>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                {loading
                  ? 'Đang tải…'
                  : `${docs.length} tài liệu trong cơ sở tri thức`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                void refreshDocs();
              }}
              disabled={loading}
              className="text-brand-on-surface-variant hover:bg-white/5 hover:text-brand-tertiary"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Làm mới'
              )}
            </Button>
          </div>
          <div className="p-6">
            {loadError && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Không tải được danh sách</p>
                  <p className="text-red-200/80">{loadError}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12 text-brand-on-surface-variant">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : docs.length === 0 ? (
              <div className="rounded-md border border-dashed border-brand-outline-variant/30 bg-white/5 p-8 text-center text-sm text-brand-on-surface-variant">
                Chưa có tài liệu nào. Hãy tải lên file đầu tiên ở bên trái.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-outline-variant/20 text-left text-xs uppercase tracking-wider text-brand-on-surface-variant">
                      <th className="py-2 pr-4 font-medium">Tên</th>
                      <th className="py-2 pr-4 font-medium">Bucket</th>
                      <th className="py-2 pr-4 font-medium">Loại</th>
                      <th className="py-2 pr-4 font-medium">Dung lượng</th>
                      <th className="py-2 pr-4 font-medium">Chunks</th>
                      <th className="py-2 pr-4 font-medium">Trạng thái</th>
                      <th className="py-2 pr-4 font-medium">Ngày tạo</th>
                      <th className="py-2 text-right font-medium">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-brand-outline-variant/10 transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="py-3 pr-4 align-top">
                          <p className="font-medium text-brand-on-surface">
                            {d.name}
                          </p>
                          {d.error && (
                            <p
                              className="mt-0.5 truncate text-xs text-red-300"
                              title={d.error}
                            >
                              {d.error}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className="inline-flex items-center gap-1 rounded-full border border-brand-tertiary/25 bg-brand-tertiary/10 px-2 py-0.5 text-xs font-mono text-brand-on-surface">
                            <Database className="h-3 w-3 text-brand-tertiary" />
                            {d.bucketName}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                          {shortMime(d.mimeType)}
                        </td>
                        <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                          {formatBytes(d.sizeBytes)}
                        </td>
                        <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                          {d.chunkCount}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                          {formatDateTime(d.createdAt)}
                        </td>
                        <td className="py-3 text-right align-top">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDelete(d)}
                            className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Xoá</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Xoá tài liệu?"
        description={
          pendingDelete
            ? `Tài liệu "${pendingDelete.name}" sẽ bị xoá vĩnh viễn cùng toàn bộ chunks và file trong bucket "${pendingDelete.bucketName}". Bucket được giữ lại. Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xoá"
        variant="danger"
        loading={deleting}
        onConfirm={onConfirmDelete}
      />

      <CreateBucketDialog
        open={showCreateBucket}
        onOpenChange={setShowCreateBucket}
        onSubmit={onCreateBucket}
      />
      </div>
    </main>
  );
}

function CreateBucketDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const [bucketName, setBucketName] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form + focus input when opened
  useEffect(() => {
    if (open) {
      setBucketName('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bucketName.trim() || creating) return;
    setCreating(true);
    const ok = await onSubmit(bucketName.trim());
    setCreating(false);
    if (ok) setBucketName('');
  }

  const valid = BUCKET_NAME_REGEX.test(bucketName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <div
        aria-hidden
        onClick={() => !creating && onOpenChange(false)}
        className="absolute inset-0 animate-in fade-in-0 bg-black/70 backdrop-blur-sm duration-200"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container shadow-2xl shadow-black/60 animate-in fade-in-0 zoom-in-95 duration-200"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
        />
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={creating}
          aria-label="Đóng"
          className="absolute right-3 top-3 rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tertiary/15 text-brand-tertiary">
              <Database className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="font-headline text-lg font-semibold leading-snug text-brand-on-surface">
                Tạo bucket R2 mới
              </h2>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Bucket sẽ được tạo trên R2 và dùng để chứa tài liệu. Tên phải
                là duy nhất trên toàn Cloudflare.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-bucket-name">Tên bucket</Label>
            <Input
              id="new-bucket-name"
              ref={inputRef}
              placeholder="law-ai-rag-civil-code-2015"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value.toLowerCase())}
              maxLength={63}
              required
              disabled={creating}
            />
            {bucketName && !valid && (
              <p className="text-xs text-amber-300">
                Tên phải 3-63 ký tự, chỉ gồm chữ thường, số và dấu gạch ngang,
                bắt đầu và kết thúc bằng chữ/số.
              </p>
            )}
            {valid && (
              <p className="text-xs text-emerald-300">Tên hợp lệ.</p>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={creating}
              className="rounded-lg border border-brand-outline-variant/30 bg-white/5 px-4 py-2 text-sm font-medium text-brand-on-surface transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!valid || creating}
              className="rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/50 disabled:translate-y-0 disabled:opacity-60"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tạo…
                </span>
              ) : (
                'Tạo bucket'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StatusBadge({ status }: { status: RagDocumentStatus }) {
  const styles: Record<RagDocumentStatus, string> = {
    ready: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    pending: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    failed: 'border-red-400/40 bg-red-500/10 text-red-200',
  };
  const labels: Record<RagDocumentStatus, string> = {
    ready: 'Sẵn sàng',
    pending: 'Đang xử lý',
    failed: 'Lỗi',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'ready'
            ? 'bg-emerald-400'
            : status === 'pending'
              ? 'bg-amber-400'
              : 'bg-red-400'
        }`}
      />
      {labels[status]}
    </span>
  );
}

function shortMime(mime: string): string {
  if (!mime) return '—';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('wordprocessingml')) return 'DOCX';
  if (mime === 'text/markdown') return 'MD';
  if (mime === 'text/plain') return 'TXT';
  const slash = mime.indexOf('/');
  return slash > 0 ? mime.slice(slash + 1).toUpperCase() : mime.toUpperCase();
}
