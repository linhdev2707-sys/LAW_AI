import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagDocument } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { RagService } from './rag.service';
import { RagAdminController } from './rag-admin.controller';
import { RagOcrCallbackController } from './rag-ocr-callback.controller';
import { ChunkerService } from './chunking/chunker.service';
import { LocalEmbeddingService } from './embedding/local-embedding.service';
import { RetrieverService } from './retrieval/retriever.service';
import { R2Service } from './storage/r2.service';
import { DocumentParserService } from './parsers/document-parser.service';
import { OcrCallbackGuard } from './guards/ocr-callback.guard';
import { RagOcrSweeperService } from './rag-ocr-sweeper.service';

@Module({
  imports: [TypeOrmModule.forFeature([RagDocument, RagChunk])],
  controllers: [RagAdminController, RagOcrCallbackController],
  providers: [
    RagService,
    ChunkerService,
    LocalEmbeddingService,
    RetrieverService,
    R2Service,
    DocumentParserService,
    OcrCallbackGuard,
    // Cron that sweeps OCR_PENDING docs older than 30 min → FAILED.
    RagOcrSweeperService,
  ],
  exports: [
    RagService,
    // Exposed for ChatModule's AgentService (deep-mode function-calling
    // tools). Other services like DocumentLookupService in the same module
    // don't need this — only consumers outside RagModule do.
    RetrieverService,
  ],
})
export class RagModule {}
