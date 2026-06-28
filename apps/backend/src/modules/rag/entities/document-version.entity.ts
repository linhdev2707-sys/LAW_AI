import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RagDocument } from './rag-document.entity';
import { RagChunk } from './rag-chunk.entity';
import { DocumentJob } from './document-job.entity';

export enum DocumentVersionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity({ name: 'document_versions' })
@Index('IDX_document_versions_doc_num', ['documentId', 'versionNumber'], { unique: true })
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @ManyToOne(() => RagDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: RagDocument;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber: number;

  @Column({ name: 'r2_key', type: 'varchar', length: 500 })
  r2Key: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'chunk_count', type: 'integer', default: 0 })
  chunkCount: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: DocumentVersionStatus.PENDING,
  })
  status: DocumentVersionStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => RagChunk, (c) => c.version, { cascade: false })
  chunks: RagChunk[];

  @OneToMany(() => DocumentJob, (j) => j.version, { cascade: false })
  jobs: DocumentJob[];
}
export { RagDocument };
export { RagChunk };
export { DocumentJob };
