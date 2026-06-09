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

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'token_count', type: 'integer' })
  tokenCount: number;

  /**
   * JSON-serialized `number[]` of length `openai.embeddingDim` (default 1536).
   * Stored as TEXT for MVP — switch to `vector(1536)` + HNSW index in a later
   * migration when corpus size warrants it.
   */
  @Column({ type: 'text' })
  embedding: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
