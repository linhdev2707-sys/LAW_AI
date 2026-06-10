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
  READY = 'ready',
  FAILED = 'failed',
}

@Entity({ name: 'rag_documents' })
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
