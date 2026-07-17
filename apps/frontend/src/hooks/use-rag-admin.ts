'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { ragAdminApi } from '@/lib/rag-admin';
import type { IOcrStatusResult, IRagDocument, RagDocumentStatus } from '@/types/rag';

// R2 bucket naming: lowercase letters, digits, hyphens, 3-63 chars.
export const BUCKET_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function useRagAdmin(isAdmin: boolean) {
  const [docs, setDocs] = useState<IRagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<string[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(true);
  const [bucket, setBucket] = useState('');

  const [pendingDelete, setPendingDelete] = useState<IRagDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk-delete UI state. We use a `Set` so toggling/clearing is O(1).
  // A separate `bulkDeleting` flag keeps the action bar button disabled
  // while the request is in flight — `deleting` is reserved for the
  // single-doc delete dialog.
  const [pendingBulkDelete, setPendingBulkDelete] = useState<Set<string> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

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

  // ─── Bulk select / delete ──────────────────────────────────────────────

  /**
   * Toggle a single doc id in the selection set. Returns the new Set so
   * the caller (the table) can re-render without waiting for the next
   * render cycle.
   */
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /**
   * Set the selection wholesale — used by the header "select all"
   * checkbox. Passing an empty array clears the selection.
   */
  const setSelectedMany = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Bulk delete the docs whose ids are in `pendingBulkDelete`. We make
   * a single POST and report per-id outcomes so the user knows exactly
   * which docs (if any) failed.
   */
  async function onConfirmBulkDelete() {
    if (!pendingBulkDelete || pendingBulkDelete.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    const ids = Array.from(pendingBulkDelete);
    try {
      const results = await ragAdminApi.bulkDelete(ids);
      const ok = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      if (failed.length === 0) {
        toast.success(`Đã xoá ${ok.length} tài liệu`);
      } else {
        toast.warning(
          `Đã xoá ${ok.length}/${results.length} tài liệu — ${failed.length} thất bại`,
          { description: failed[0]?.error ?? 'Vui lòng thử lại.' },
        );
      }
      // Drop the deleted ids from the selection so the action bar
      // disappears cleanly even if a partial failure left some docs.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ok.forEach((r) => next.delete(r.id));
        return next;
      });
      setPendingBulkDelete(null);
      await refreshDocs();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Xoá hàng loạt thất bại';
      toast.error('Xoá hàng loạt thất bại', { description: msg });
    } finally {
      setBulkDeleting(false);
    }
  }

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

  const [bulkSyncing, setBulkSyncing] = useState(false);

  async function onSync(doc: IRagDocument) {
    try {
      toast.promise(ragAdminApi.sync(doc.id), {
        loading: `Đang khởi chạy đồng bộ cho "${doc.name}"...`,
        success: () => {
          void refreshDocs();
          return `Đã bắt đầu đồng bộ "${doc.name}"`;
        },
        error: (err) => {
          const msg = err instanceof ApiError ? err.message : 'Đồng bộ thất bại';
          return `Đồng bộ thất bại: ${msg}`;
        },
      });
    } catch (e) {
      // Handled by toast.promise
    }
  }

  async function onBulkSync() {
    if (selectedIds.size === 0 || bulkSyncing) return;
    setBulkSyncing(true);
    const ids = Array.from(selectedIds);

    // Filter only documents that are in pending or failed state
    const docsToSync = docs.filter(
      (d) => ids.includes(d.id) && (d.status === 'pending' || d.status === 'failed'),
    );
    if (docsToSync.length === 0) {
      toast.info('Không có tài liệu nào cần đồng bộ', {
        description: 'Chỉ đồng bộ các tài liệu ở trạng thái "Chưa đồng bộ" hoặc "Lỗi".',
      });
      setBulkSyncing(false);
      return;
    }

    try {
      toast.promise(Promise.all(docsToSync.map((d) => ragAdminApi.sync(d.id))), {
        loading: `Đang khởi chạy đồng bộ cho ${docsToSync.length} tài liệu...`,
        success: () => {
          void refreshDocs();
          setSelectedIds(new Set()); // clear selection
          return `Đã bắt đầu đồng bộ cho ${docsToSync.length} tài liệu.`;
        },
        error: (err) => {
          const msg = err instanceof ApiError ? err.message : 'Lỗi đồng bộ hàng loạt';
          return `Đồng bộ hàng loạt thất bại: ${msg}`;
        },
      });
    } catch (e) {
      // Handled by toast.promise
    } finally {
      setBulkSyncing(false);
    }
  }

  return {
    docs,
    loading,
    setLoading,
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
    refreshBuckets,
    onConfirmDelete,
    onCreateBucket,
    onSync,
    onBulkSync,
    bulkSyncing,
  };
}

/**
 * Polls the OCR status endpoint for a single document until it leaves
 * `ocr_pending` (transitions to `ready` or `failed`).
 *
 * Returns:
 *  - `status`: the latest known status,
 *  - `error`: the API error if polling failed (so the caller can show
 *    a toast without unmounting the component).
 *
 * The caller should call `stop()` when unmounting — we also clean up
 * automatically when `enabled` flips to false.
 *
 * Polling cadence: 2s. Most Vietnamese legal PDFs (10-30 pages) finish
 * OCR in under a minute, so 2s feels responsive without hammering the
 * backend. The backend endpoint is admin-gated and cheap (single-row
 * SELECT), so the cost is negligible.
 */
export function useOcrStatusPolling(
  documentId: string | null,
  enabled: boolean,
  intervalMs: number = 2000,
): { status: RagDocumentStatus | null; error: string | null; stop: () => void } {
  const [status, setStatus] = useState<RagDocumentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled || !documentId) {
      setStatus(null);
      setError(null);
      return;
    }
    stoppedRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick(): Promise<void> {
      if (stoppedRef.current) return;
      try {
        const res: IOcrStatusResult = await ragAdminApi.getOcrStatus(documentId!);
        setStatus(res.status);
        if (res.status !== 'ocr_pending') {
          // Done — stop polling and surface the result.
          if (res.status === 'failed' && res.error) {
            setError(res.error);
          }
          stoppedRef.current = true;
          return;
        }
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Không tải được trạng thái OCR';
        setError(msg);
        // Don't stop — transient errors should not abort polling. The
        // next tick will try again.
      }
      if (!stoppedRef.current) {
        timer = setTimeout(tick, intervalMs);
      }
    }

    void tick();
    return () => {
      stoppedRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [documentId, enabled, intervalMs]);

  return { status, error, stop };
}
