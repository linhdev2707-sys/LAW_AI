import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RagDocument } from './rag-document.entity';

@Entity({ name: 'rag_chunks' })
@Index('IDX_rag_chunks_doc_index', ['documentId', 'chunkIndex'])
@Index('IDX_rag_chunks_law_article', ['lawNumber', 'article', 'clause'])
@Index('IDX_rag_chunks_breadcrumb', ['breadcrumb'])
export class RagChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @ManyToOne(() => RagDocument, (d) => d.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: RagDocument;

  @Column({ name: 'chunk_index', type: 'integer' })
  chunkIndex: number;

  /** Chunk text WITH breadcrumb header. Used for embedding. */
  @Column({ type: 'text' })
  content: string;

  /** Chunk text WITHOUT breadcrumb header. Used for LLM prompt + citation. */
  @Column({ name: 'raw_text', type: 'text' })
  rawText: string;

  @Column({ name: 'token_count', type: 'integer' })
  tokenCount: number;

  // ─── Legal coordinates (Phase 1) ──────────────────────────────────

  @Column({ name: 'breadcrumb', type: 'text' })
  breadcrumb: string;

  @Column({ name: 'law_name', type: 'varchar', length: 300, nullable: true })
  lawName: string | null;

  @Column({ name: 'law_number', type: 'varchar', length: 100, nullable: true })
  lawNumber: string | null;

  /** "II" — Roman numeral of the Chương, or null if preamble. */
  @Column({ name: 'chapter', type: 'varchar', length: 20, nullable: true })
  chapter: string | null;

  /** "1" — number of the Mục, or null. */
  @Column({ name: 'section', type: 'varchar', length: 20, nullable: true })
  section: string | null;

  /** "15" — number of the Điều. */
  @Column({ name: 'article', type: 'varchar', length: 20 })
  article: string;

  /** "2" — number of the Khoản, or null. */
  @Column({ name: 'clause', type: 'varchar', length: 20, nullable: true })
  clause: string | null;

  /** "a" — letter of the Điểm, or null. */
  @Column({ name: 'point', type: 'varchar', length: 20, nullable: true })
  point: string | null;

  // ─── Vector + FTS ──────────────────────────────────────────────────

  /**
   * pgvector column. We keep the legacy `embedding TEXT` for backward
   * compatibility (down-time reindex) but write to BOTH during migration.
   * Once reindex is complete, the JSON column can be dropped.
   */
  @Column({
    name: 'embedding_vec',
    type: 'vector',
    nullable: true,
  })
  embeddingVec: number[] | null;

  /** Legacy JSON-serialized vector (kept for rollback). */
  @Column({ type: 'text', nullable: true })
  embedding: string | null;

  @Column({
    type: 'tsvector',
    select: false,
  })
  tsv: unknown;

  @Column({ name: 'char_start', type: 'integer', nullable: true })
  charStart: number | null;

  @Column({ name: 'char_end', type: 'integer', nullable: true })
  charEnd: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
