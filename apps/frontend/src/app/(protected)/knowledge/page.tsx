'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Database,
  FileText,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { UserRole } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Custom Hooks & Components
import { useRagAdmin, useOcrStatusPolling } from '@/hooks/use-rag-admin';
import { DocumentTable } from '@/components/knowledge/document-table';
import { CreateBucketDialog } from '@/components/knowledge/create-bucket-dialog';
import { UploadDocumentDialog } from '@/components/knowledge/upload-document-dialog';

/**
 * Admin-only page for managing the RAG knowledge base.
 */
export default function KnowledgePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  // Authorization gate
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [sessionStatus, isAdmin, router]);

  const {
    docs,
    loading,
    loadError,
    buckets,
    bucketsLoading,
    bucket,
    setBucket,
    pendingDelete,
    setPendingDelete,
    deleting,
    selectedIds,
    toggleSelected,
    setSelectedMany,
    clearSelection,
    pendingBulkDelete,
    setPendingBulkDelete,
    bulkDeleting,
    onConfirmBulkDelete,
    showCreateBucket,
    setShowCreateBucket,
    showUploadDialog,
    setShowUploadDialog,
    refreshDocs,
    onConfirmDelete,
    onCreateBucket,
  } = useRagAdmin(isAdmin);

  const pendingDoc = useMemo(
    () => docs.find((d) => d.status === 'ocr_pending') ?? null,
    [docs],
  );
  const { status: polledStatus, error: pollError } = useOcrStatusPolling(
    pendingDoc?.id ?? null,
    !!pendingDoc,
  );

  useEffect(() => {
    if (polledStatus && polledStatus !== 'ocr_pending') {
      void refreshDocs();
    }
  }, [polledStatus, refreshDocs]);

  useEffect(() => {
    if (pollError) {
      console.warn('OCR status polling error:', pollError);
    }
  }, [pollError]);

  if (sessionStatus === 'loading' || !isAdmin) {
    return (
      <main className="relative h-full overflow-y-auto bg-brand-background text-brand-on-surface-variant">
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
    <main className="relative h-full overflow-y-auto bg-brand-background text-brand-on-surface">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-brand-on-surface">
                Quản lý Knowledge
              </h1>
              <p className="mt-1 text-sm text-brand-on-surface-variant">
                Lưu trữ và quản lý tài liệu pháp lý cho cơ sở tri thức AI.
              </p>
            </div>
            <button
              onClick={() => setShowUploadDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-primary to-brand-tertiary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-primary/50"
            >
              <UploadCloud className="h-4 w-4" />
              Upload dữ liệu
            </button>
          </div>
        </header>

        {/* ── Document list (full width) ──────────────────────────────────── */}
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
                refreshDocs();
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
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-brand-outline-variant/30 bg-white/5 p-8 text-center text-sm text-brand-on-surface-variant">
                <span className="mb-2 text-brand-on-surface-variant">Chưa có tài liệu nào trong cơ sở tri thức.</span>
                <button
                  onClick={() => setShowUploadDialog(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-tertiary transition-colors hover:text-brand-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tải lên tài liệu đầu tiên
                </button>
              </div>
            ) : (
              <>
                {/* Bulk action bar — only renders when ≥1 row is selected.
                    Sits flush above the table so it reads as a single
                    unit with the table card. */}
                {selectedIds.size > 0 && (
                  <div
                    role="region"
                    aria-label="Hành động hàng loạt"
                    className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-tertiary/30 bg-brand-tertiary/10 px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 text-brand-on-surface">
                      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-brand-tertiary/30 px-1.5 text-xs font-bold text-brand-on-surface">
                        {selectedIds.size}
                      </span>
                      <span>
                        đã chọn{' '}
                        <span className="text-brand-on-surface-variant">
                          / {docs.length} tài liệu
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearSelection}
                        disabled={bulkDeleting}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-on-surface disabled:opacity-50"
                      >
                        Bỏ chọn
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingBulkDelete(new Set(selectedIds))}
                        disabled={bulkDeleting}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoá đã chọn
                      </button>
                    </div>
                  </div>
                )}
                <DocumentTable
                  docs={docs}
                  selectedIds={selectedIds}
                  onToggleSelected={toggleSelected}
                  onToggleAll={(ids) => setSelectedMany(ids)}
                  onDeleteClick={setPendingDelete}
                />
              </>
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

      <ConfirmDialog
        open={!!pendingBulkDelete}
        onOpenChange={(open) => !open && setPendingBulkDelete(null)}
        title="Xoá hàng loạt tài liệu?"
        description={
          pendingBulkDelete
            ? `${pendingBulkDelete.size} tài liệu đã chọn sẽ bị xoá vĩnh viễn cùng toàn bộ chunks và file trong R2. Bucket được giữ lại. Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel={`Xoá ${pendingBulkDelete?.size ?? 0} tài liệu`}
        variant="danger"
        loading={bulkDeleting}
        onConfirm={onConfirmBulkDelete}
      />

      <CreateBucketDialog
        open={showCreateBucket}
        onOpenChange={setShowCreateBucket}
        onSubmit={onCreateBucket}
      />

      <UploadDocumentDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        buckets={buckets}
        bucketsLoading={bucketsLoading}
        bucket={bucket}
        setBucket={setBucket}
        onRefreshDocs={refreshDocs}
        onCreateBucketClick={() => setShowCreateBucket(true)}
      />
    </main>
  );
}
