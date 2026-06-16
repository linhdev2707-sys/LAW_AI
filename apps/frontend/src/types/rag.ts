/**
 * Frontend view of a RAG document. Mirrors the TypeORM entity on the
 * backend, with snake_case fields mapped to camelCase in `lib/rag-admin`.
 */
export type RagDocumentStatus = 'pending' | 'ocr_pending' | 'ready' | 'failed';

export interface IRagDocument {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  /** R2 bucket this document lives in. */
  bucketName: string;
  bucketRegion: string;
  status: RagDocumentStatus;
  /** Populated when status === 'failed'. */
  error: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface IUploadRagDocumentResult {
  id: string;
  chunkCount: number;
  /**
   * Status of the document right after the upload response. `ocr_pending`
   * means the file is a scanned PDF and the Cloudflare Worker is
   * running OCR — the admin UI should poll until this flips to
   * `ready` or `failed`. `ready` means chunking/embedding already
   * finished in the same request.
   */
  status: RagDocumentStatus;
}

export interface IOcrStatusResult {
  id: string;
  status: RagDocumentStatus;
  chunkCount: number;
  error: string | null;
}

export interface IRagBucket {
  name: string;
  region: string;
}
