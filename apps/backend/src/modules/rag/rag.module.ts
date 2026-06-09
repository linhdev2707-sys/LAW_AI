import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagDocument } from './entities/rag-document.entity';
import { RagChunk } from './entities/rag-chunk.entity';
import { RagService } from './rag.service';
import { RagAdminController } from './rag-admin.controller';
import { ChunkerService } from './chunking/chunker.service';
import { OpenAIEmbeddingService } from './embedding/openai-embedding.service';
import { RetrieverService } from './retrieval/retriever.service';
import { R2Service } from './storage/r2.service';

@Module({
  imports: [TypeOrmModule.forFeature([RagDocument, RagChunk])],
  controllers: [RagAdminController],
  providers: [RagService, ChunkerService, OpenAIEmbeddingService, RetrieverService, R2Service],
  exports: [RagService],
})
export class RagModule {}
