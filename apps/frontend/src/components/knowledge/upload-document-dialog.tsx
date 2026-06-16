'use client';

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { formatBytes, ragAdminApi } from '@/lib/rag-admin';

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md,.markdown';
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buckets: string[];
  bucketsLoading: boolean;
  bucket: string;
  setBucket: (b: string) => void;
  onRefreshDocs: () => Promise<void>;
  onCreateBucketClick: () => void;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  buckets,
  bucketsLoading,
  bucket,
  setBucket,
  onRefreshDocs,
  onCreateBucketClick,
}: UploadDocumentDialogProps) {
  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    setFiles((prev) => {
      // Avoid adding duplicate files (same name & size)
      const uniqueSelected = selected.filter(
        (sf) => !prev.some((pf) => pf.name === sf.name && pf.size === sf.size),
      );
      const next = [...prev, ...uniqueSelected];

      if (next.length === 1 && next[0]) {
        const f = next[0];
        const dot = f.name.lastIndexOf('.');
        setName(dot > 0 ? f.name.slice(0, dot) : f.name);
      }
      return next;
    });
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Sync file input value if we cleared all files
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return next;
    });
  }

  function getDocName(f: File) {
    const dot = f.name.lastIndexOf('.');
    return dot > 0 ? f.name.slice(0, dot) : f.name;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0 || !bucket.trim() || uploading) return;

    // Validate all files
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`File "${f.name}" quá lớn`, { description: 'Tối đa 50 MB' });
        return;
      }
      if (f.size === 0) {
        toast.error(`File "${f.name}" rỗng`);
        return;
      }
    }

    setUploading(true);
    try {
      // Tracks whether any file was routed to the async OCR queue. We
      // show a single "pending OCR" toast in that case and rely on the
      // caller (knowledge page) to poll for completion.
      let anyOcrPending = false;
      if (files.length === 1) {
        const file = files[0]!;
        const docName = name.trim() || getDocName(file);
        const res = await ragAdminApi.upload({
          name: docName,
          bucket: bucket.trim(),
          file,
        });
        if (res.status === 'ocr_pending') {
          anyOcrPending = true;
          toast.info('Đã gửi tài liệu vào hàng đợi OCR', {
            description:
              'Tài liệu scan đang được xử lý bằng Cloudflare Workers AI. ' +
              'Danh sách sẽ tự cập nhật khi hoàn tất.',
            duration: 6000,
          });
        } else {
          toast.success('Đã tải lên tài liệu', {
            description: `${res.chunkCount} chunk đã được tạo trong bộ tài liệu "${bucket.trim()}".`,
          });
        }
      } else {
        let successCount = 0;
        let errorCount = 0;
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          const docName = getDocName(file);
          try {
            const res = await ragAdminApi.upload({
              name: docName,
              bucket: bucket.trim(),
              file,
            });
            if (res.status === 'ocr_pending') {
              anyOcrPending = true;
            } else {
              successCount++;
            }
          } catch (err) {
            errorCount++;
            // eslint-disable-next-line no-console
            console.error(`Tải lên file ${file.name} thất bại:`, err);
          }
        }

        if (successCount > 0) {
          toast.success(`Đã tải lên thành công ${successCount}/${files.length} tài liệu`, {
            description: `Đã lưu trữ trong bộ tài liệu "${bucket.trim()}".`,
          });
        }
        if (anyOcrPending) {
          toast.info('Một số tài liệu scan đang được OCR', {
            description:
              'Cloudflare Workers AI sẽ trích xuất văn bản. Danh sách tự cập nhật khi xong.',
            duration: 6000,
          });
        }
        if (errorCount > 0) {
          toast.error(`Tải lên thất bại ${errorCount} tài liệu. Vui lòng thử lại.`);
        }
      }

      setName('');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onRefreshDocs();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Tải lên thất bại';
      toast.error('Tải lên thất bại', { description: msg });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
    >
      <div
        aria-hidden
        onClick={() => !uploading && onOpenChange(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm duration-200 animate-in fade-in-0"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container shadow-2xl shadow-black/60 duration-200 animate-in fade-in-0 zoom-in-95"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
        />
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={uploading}
          aria-label="Đóng"
          className="absolute right-3 top-3 rounded-md p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tertiary/15 text-brand-tertiary">
              <UploadCloud className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="font-headline text-lg font-semibold leading-snug text-brand-on-surface">
                Tải lên tài liệu mới
              </h2>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Hỗ trợ PDF, DOCX, DOC, TXT, Markdown — tối đa 50 MB.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {files.length <= 1 && (
              <div className="grid gap-2">
                <Label htmlFor="name">Tên tài liệu</Label>
                <Input
                  id="name"
                  placeholder="VD: Bộ luật Dân sự 2015"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  required={files.length === 1}
                  disabled={uploading}
                  className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="file">Chọn file</Label>
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                onChange={onPickFile}
                required={files.length === 0}
                multiple
                disabled={uploading}
                className="border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 file:mr-3 file:rounded file:border-0 file:bg-brand-tertiary/15 file:px-3 file:py-1 file:text-xs file:font-medium file:text-brand-tertiary hover:file:bg-brand-tertiary/25 focus-visible:border-brand-tertiary focus-visible:ring-brand-tertiary/30"
              />
              {files.length === 1 && files[0] && (
                <p className="text-xs text-brand-on-surface-variant">
                  Đã chọn:{' '}
                  <span className="font-medium text-brand-on-surface">{files[0].name}</span>
                  {' · '}
                  {formatBytes(files[0].size)}
                </p>
              )}
            </div>

            {files.length > 1 && (
              <div className="grid gap-2">
                <Label>Danh sách tệp đã chọn ({files.length})</Label>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-brand-outline-variant/15 bg-brand-surface-container-lowest/30 p-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-md border border-brand-outline-variant/10 bg-brand-surface-container px-3 py-2 text-xs"
                    >
                      <span className="flex-1 truncate font-medium text-brand-on-surface">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-[10px] text-brand-on-surface-variant/70">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        disabled={uploading}
                        className="shrink-0 text-brand-on-surface-variant/60 transition-colors hover:text-red-400 disabled:opacity-50"
                        title="Xoá file khỏi danh sách"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
              className="rounded-lg border border-brand-outline-variant/30 bg-white/5 px-4 py-2 text-sm font-medium text-brand-on-surface transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={
                uploading ||
                files.length === 0 ||
                (files.length === 1 && !name.trim()) ||
                !bucket.trim()
              }
              className="rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/50 disabled:translate-y-0 disabled:opacity-60"
            >
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tải lên…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <UploadCloud className="h-4 w-4" />
                  Tải lên
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
