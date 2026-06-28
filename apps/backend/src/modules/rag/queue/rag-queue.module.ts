import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RagQueueService } from './rag-queue.service';
import { DocumentJob } from '../entities/document-job.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { ProcessingLog } from '../entities/processing-log.entity';
import { RagDocument } from '../entities/rag-document.entity';

// We will import processors here
import { AnalyzeProcessor } from './processors/analyze.processor';
import { TextExtractProcessor } from './processors/text-extract.processor';
import { ChunkProcessor } from './processors/chunk.processor';
import { EmbedProcessor } from './processors/embed.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentJob, DocumentVersion, ProcessingLog, RagDocument]),
    BullModule.registerQueue(
      { name: 'analyze' },
      { name: 'ocr' },
      { name: 'text-extract' },
      { name: 'chunk' },
      { name: 'embed' },
    ),
  ],
  providers: [
    RagQueueService,
    AnalyzeProcessor,
    TextExtractProcessor,
    ChunkProcessor,
    EmbedProcessor,
  ],
  exports: [RagQueueService, BullModule],
})
export class RagQueueModule {}
