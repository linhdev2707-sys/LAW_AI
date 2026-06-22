import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagDocument } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([RagDocument, RagChunk]),
    // LlmModule is imported so MetadataEnricherService can @Optional()
    // inject LlmService. If LLM isn't configured the enricher silently
    // falls back to regex-only metadata extraction.
    LlmModule,
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
  ],
  exports: [
    RagService,
    RetrieverService,
    LegalStructureParser,
    ReferenceExtractorService,
  ],
})
export class RagModule {}
