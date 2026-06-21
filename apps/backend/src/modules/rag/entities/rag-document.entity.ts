import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RagChunk } from './rag-chunk.entity';

export enum RagDocumentStatus {
  PENDING = 'pending',
  PARSING = 'parsing',
  OCR_PENDING = 'ocr_pending',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
  READY = 'ready',
  FAILED = 'failed',
}

export enum RagDocumentType {
  LUAT = 'luat',
  NGHIDINH = 'nghi_dinh',
  THONGTU = 'thong_tu',
  QUYETDINH = 'quyet_dinh',
  NGHIPHAP = 'nghi_quyet',
  PHAPLENH = 'phap_lenh',
  HOPDONG = 'hop_dong',
  VANBAN_KHAC = 'van_ban_khac',
}

export enum RagLegalStatus {
  CON_HIEU_LUC = 'con_hieu_luc',
  HET_HIEU_LUC = 'het_hieu_luc',
  HET_HIEU_LUC_MOT_PHAN = 'het_hieu_luc_mot_phan',
  CHUA_CO_HIEU_LUC = 'chua_co_hieu_luc',
  KHONG_XAC_DINH = 'khong_xac_dinh',
}

@Entity({ name: 'rag_documents' })
@Index('IDX_rag_documents_law_number', ['lawNumber'])
@Index('IDX_rag_documents_legal_status', ['legalStatus'])
@Index('IDX_rag_documents_effective_date', ['effectiveDate'])
export class RagDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'r2_key', type: 'varchar', length: 500 })
  r2Key: string;

  @Index()
  @Column({ name: 'bucket_name', type: 'varchar', length: 100 })
  bucketName: string;

  @Column({
    name: 'bucket_region',
    type: 'varchar',
    length: 20,
    default: 'auto',
  })
  bucketRegion: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, default: 'text/plain' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'chunk_count', type: 'integer', default: 0 })
  chunkCount: number;

  @Index()
  @Column({
    type: 'enum',
    enum: RagDocumentStatus,
    default: RagDocumentStatus.PENDING,
  })
  status: RagDocumentStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  // ─── Legal metadata (Phase 1) ──────────────────────────────────────

  @Index()
  @Column({
    name: 'document_type',
    type: 'enum',
    enum: RagDocumentType,
    default: RagDocumentType.VANBAN_KHAC,
  })
  documentType: RagDocumentType;

  @Column({ name: 'law_name', type: 'varchar', length: 300, nullable: true })
  lawName: string | null;

  /** e.g. "100/2019/QH14" */
  @Column({ name: 'law_number', type: 'varchar', length: 100, nullable: true })
  lawNumber: string | null;

  @Column({ name: 'issuer', type: 'varchar', length: 300, nullable: true })
  issuer: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date | null;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate: Date | null;

  @Column({
    name: 'legal_status',
    type: 'enum',
    enum: RagLegalStatus,
    default: RagLegalStatus.KHONG_XAC_DINH,
  })
  legalStatus: RagLegalStatus;

  /** Original URL crawled/downloaded from. */
  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  /** Reference to the document that this one amends. */
  @Column({ name: 'amendment_of', type: 'uuid', nullable: true })
  amendmentOf: string | null;

  /** Raw structured metadata that doesn't fit the columns above. */
  @Column({ name: 'extra_metadata', type: 'jsonb', nullable: true })
  extraMetadata: Record<string, unknown> | null;

  // ─── Audit ─────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => RagChunk, (c) => c.document, { cascade: false })
  chunks: RagChunk[];
}
