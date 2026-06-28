import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagDocument } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { DocumentVersion } from './entities/document-version.entity';
import { DocumentJob } from './entities/document-job.entity';
import { ProcessingLog } from './entities/processing-log.entity';
import { RagService } from './rag.service';
import { RagAdminController } from './rag-admin.controller';
import { RagOcrCallbackController } from './rag-ocr-callback.controller';
import { LegalHierarchicalChunkerService } from './chunking/legal-hierarchical-chunker.service';
import { LegalEmbeddingService } from './embedding/legal-embedding.service';
import { RetrieverService } from './retrieval/retriever.service';
import { BgeRerankerService } from './retrieval/bge-reranker.service';
import { R2Service } from './storage/r2.service';
import { DocumentParserService } from './parsers/document-parser.service';
import { LegalStructureParser } from './parsers/legal-structure.parser';
import { MetadataEnricherService } from './parsers/metadata-enricher.service';
import { ReferenceExtractorService } from './parsers/reference-extractor.service';
import { OcrCallbackGuard } from './guards/ocr-callback.guard';
import { RagOcrSweeperService } from './rag-ocr-sweeper.service';
import { LlmModule } from '../llm/llm.module';
import { BullModule } from '@nestjs/bullmq';
import { RagQueueService } from './queue/rag-queue.service';
import { AnalyzeProcessor } from './queue/processors/analyze.processor';
import { TextExtractProcessor } from './queue/processors/text-extract.processor';
import { ChunkProcessor } from './queue/processors/chunk.processor';
import { EmbedProcessor } from './queue/processors/embed.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([RagDocument, RagChunk, DocumentVersion, DocumentJob, ProcessingLog]),
    // LlmModule is imported so MetadataEnricherService can @Optional()
    // inject LlmService. If LLM isn't configured the enricher silently
    // falls back to regex-only metadata extraction.
    LlmModule,
    BullModule.registerQueue(
      { name: 'analyze' },
      { name: 'ocr' },
      { name: 'text-extract' },
      { name: 'chunk' },
      { name: 'embed' },
    ),
  ],
  controllers: [RagAdminController, RagOcrCallbackController],
  providers: [
    RagService,
    LegalHierarchicalChunkerService,
    LegalEmbeddingService,
    BgeRerankerService,
    RetrieverService,
    R2Service,
    DocumentParserService,
    LegalStructureParser,
    MetadataEnricherService,
    ReferenceExtractorService,
    OcrCallbackGuard,
    RagOcrSweeperService,
    RagQueueService,
    AnalyzeProcessor,
    TextExtractProcessor,
    ChunkProcessor,
    EmbedProcessor,
  ],
  exports: [
    RagService,
    RetrieverService,
    LegalStructureParser,
    ReferenceExtractorService,
    RagQueueService,
  ],
})
export class RagModule {}
