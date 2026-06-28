import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentJob } from './document-job.entity';

export enum ProcessingLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

@Entity({ name: 'processing_logs' })
export class ProcessingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => DocumentJob, (j) => j.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: DocumentJob;

  @Column({ type: 'varchar', length: 50 })
  step: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ProcessingLogLevel.INFO,
  })
  level: ProcessingLogLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
