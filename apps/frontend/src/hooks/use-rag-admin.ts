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
    showCreateBucket,
    setShowCreateBucket,
    showUploadDialog,
    setShowUploadDialog,
    refreshDocs,
    refreshBuckets,
    onConfirmDelete,
    onCreateBucket,
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
