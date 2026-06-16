import { apiFetch } from './api';
import type {
  IUploadRagDocumentResult,
  IRagDocument,
  IRagBucket,
  IOcrStatusResult,
  RagDocumentStatus,
} from '@/types/rag';

/**
 * Raw shape coming back from the BE. The entity column names are
 * snake_case (TypeORM default) — we map them to camelCase in
 * `toDocument` so the rest of the FE speaks a single, idiomatic TS shape.
 */
interface IRawRagDocument {
  id: string;
  name: string;
  r2Key?: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  bucketName: string;
  bucketRegion: string;
  status: RagDocumentStatus;
  error: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

function toDocument(raw: IRawRagDocument): IRagDocument {
  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType,
    sizeBytes: raw.sizeBytes,
    chunkCount: raw.chunkCount,
    bucketName: raw.bucketName,
    bucketRegion: raw.bucketRegion,
    status: raw.status,
    error: raw.error ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const ragAdminApi = {
  async list(): Promise<IRagDocument[]> {
    const raw = await apiFetch<IRawRagDocument[]>('/api/v1/admin/rag/documents');
    return (raw ?? []).map(toDocument);
  },

  /**
   * Upload a document via multipart/form-data.
   * Note: apiFetch is used with a FormData body — the api layer detects
   * FormData and skips the JSON Content-Type so the browser sets the
   * correct multipart boundary.
   */
  async upload(opts: {
    name: string;
    bucket: string;
    file: File;
  }): Promise<IUploadRagDocumentResult> {
    const form = new FormData();
    form.append('name', opts.name);
    form.append('bucket', opts.bucket);
    form.append('file', opts.file);
    return apiFetch<IUploadRagDocumentResult>('/api/v1/admin/rag/documents/upload', {
      method: 'POST',
      body: form,
    });
  },

  /**
   * Delete by id. Backend returns 204 No Content — `apiFetch` returns
   * `undefined` for empty responses, so we just await it.
   */
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/api/v1/admin/rag/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Lightweight status endpoint for polling a document that's still in
   * `ocr_pending` after a scanned-PDF upload. Returns a trimmed view
   * (no chunks, no R2 keys) — we only need to know when it leaves
   * the OCR queue.
   */
  async getOcrStatus(id: string): Promise<IOcrStatusResult> {
    return apiFetch<IOcrStatusResult>(
      `/api/v1/admin/rag/documents/${encodeURIComponent(id)}/ocr-status`,
    );
  },

  // ─── Bucket helpers ───────────────────────────────────────────────────

  /**
   * List bucket names owned by the configured R2 account.
   * Returns just the names (sorted) — sorted on the BE for free.
   */
  async listBuckets(): Promise<string[]> {
    return apiFetch<string[]>('/api/v1/admin/rag/buckets');
  },

  /**
   * Create a new bucket (idempotent — succeeds even if the bucket
   * already exists on R2). Returns the canonical {name, region} pair.
   */
  async createBucket(opts: { name: string; region?: string }): Promise<IRagBucket> {
    return apiFetch<IRagBucket>('/api/v1/admin/rag/buckets', {
      method: 'POST',
      body: { name: opts.name, region: opts.region },
    });
  },
};

/**
 * Helper: human-friendly file size (e.g. 1.2 MB).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Helper: human-friendly date (e.g. "09/06/2026 14:23").
 * Accepts the ISO string returned by the BE.
 */
export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
