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
  ],
  exports: [RagService],
})
export class RagModule {}
