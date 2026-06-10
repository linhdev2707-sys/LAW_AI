/**
 * Frontend view of a RAG document. Mirrors the TypeORM entity on the
 * backend, with snake_case fields mapped to camelCase in `lib/rag-admin`.
 */
export type RagDocumentStatus = 'pending' | 'ready' | 'failed';

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
}

export interface IRagBucket {
  name: string;
  region: string;
}
