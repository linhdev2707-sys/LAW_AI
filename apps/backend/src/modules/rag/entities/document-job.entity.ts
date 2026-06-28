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
import { DocumentVersion } from './document-version.entity';
import { ProcessingLog } from './processing-log.entity';

export enum DocumentJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'document_jobs' })
@Index('IDX_document_jobs_status', ['status'])
export class DocumentJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @ManyToOne(() => RagDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: RagDocument;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @ManyToOne(() => DocumentVersion, (v) => v.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: DocumentVersion;

  @Column({ name: 'bullmq_job_id', type: 'varchar', length: 100, nullable: true })
  bullmqJobId: string | null;

  @Column({ name: 'queue_name', type: 'varchar', length: 50 })
  queueName: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: DocumentJobStatus.PENDING,
  })
  status: DocumentJobStatus;

  @Column({ type: 'integer', default: 0 })
  progress: number;

  @Column({ name: 'current_step', type: 'varchar', length: 50 })
  currentStep: string;

  @Column({ type: 'integer', default: 0 })
  retries: number;

  @Column({ name: 'max_retries', type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ProcessingLog, (l) => l.job, { cascade: false })
  logs: ProcessingLog[];
}
export { ProcessingLog };
