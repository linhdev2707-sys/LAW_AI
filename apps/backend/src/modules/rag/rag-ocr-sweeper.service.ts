import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { RagDocument, RagDocumentStatus } from './entities/rag-document.entity';

/**
 * Self-healing cron that marks `OCR_PENDING` documents older than 30
 * minutes as `FAILED`. Without this, a row whose OCR worker callback
 * never arrives (e.g. Workers AI free-plan quota exhausted, worker crash,
 * network blip on the callback) sits at status `ocr_pending` forever
 * and the admin UI shows "Đang OCR" indefinitely.
 *
 * Why 30 minutes: the worker's happy path is sub-30 seconds. Anything
 * still pending after half an hour is almost certainly never coming
 * back. We surface the failure explicitly with a clear error message
 * so admins can distinguish quota exhaustion from a real worker bug
 * when they look at the failed-row UI.
 *
 * The 30-minute threshold is intentionally conservative — we'd rather
 * wait too long on a single file than prematurely mark a still-processing
 * scan as failed.
 */
@Injectable()
export class RagOcrSweeperService {
  private readonly logger = new Logger(RagOcrSweeperService.name);

  /** Stuck-row threshold. Exported as a constant for tests. */
  static readonly STUCK_TIMEOUT_MS = 30 * 60 * 1000;

  constructor(
    @InjectRepository(RagDocument)
    private readonly docRepo: Repository<RagDocument>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepStuckOcr(): Promise<void> {
    const cutoff = new Date(Date.now() - RagOcrSweeperService.STUCK_TIMEOUT_MS);
    const result = await this.docRepo
      .createQueryBuilder()
      .update(RagDocument)
      .set({
        status: RagDocumentStatus.FAILED,
        error:
          'OCR worker did not complete within 30 minutes (likely quota exhaustion)',
      })
      .where('status = :s', { s: RagDocumentStatus.OCR_PENDING })
      .andWhere('created_at < :c', { c: cutoff })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(
        `Swept ${result.affected} stuck OCR_PENDING document(s) to FAILED`,
      );
    }
  }
}