import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { KnowledgeImportService } from './knowledge-import.service';

/**
 * Cron-driven wrapper around `KnowledgeImportService.importFolder`.
 *
 * Default schedule: 08:00 every day (`0 8 * * *`).
 *
 * Why a separate sweeper rather than calling the service directly
 * from a controller:
 * - Decouples cadence from request lifecycle — the import can take
 * minutes for hundreds of files; nobody wants a request blocked that
 * long.
 * - Matches the project's existing pattern (`RagOcrSweeperService`,
 * `SubscriptionExpirySweeper`).
 * - Allows the schedule to be turned off in tests / dev by clearing
 * `KNOWLEDGE_IMPORT_ENABLED=false`.
 *
 * Failure handling: every error is caught and logged. We NEVER throw
 * out of a `@Cron` method — that would crash the scheduler's internal
 * job queue and stop all future cron ticks for this service.
 */
@Injectable()
export class KnowledgeImportSweeper {
  private readonly logger = new Logger(KnowledgeImportSweeper.name);

  constructor(
    private readonly service: KnowledgeImportService,
    private readonly config: ConfigService,
  ) {}

  /**
   * `@Cron` expression is resolved at decorator-evaluation time, so we
   * can't read it from the config object. The expression still defaults
   * to `0 8 * * *` (08:00 daily); operators can override by editing the
   * decorator in one place.
   *
   * `name` makes the job identifiable in the NestJS scheduler registry
   * for debugging (`SchedulerRegistry.getCronJob('knowledge-import')`).
   */
  @Cron(process.env.KNOWLEDGE_IMPORT_CRON || '0 8 * * *', {
    name: 'knowledge-import',
  })
  async sweep(): Promise<void> {
    const enabled = this.config.get<boolean>('app.knowledgeImport.enabled', true) ?? true;
    if (!enabled) {
      this.logger.debug('[knowledge-import] disabled (KNOWLEDGE_IMPORT_ENABLED=false)');
      return;
    }

    const dir = this.config.get<string>('app.knowledgeImport.dir', '');
    if (!dir) {
      this.logger.warn('[knowledge-import] skipped: KNOWLEDGE_IMPORT_DIR is not set');
      return;
    }

    const start = Date.now();
    this.logger.log(`[knowledge-import] cron start (dir=${dir})`);
    try {
      const summary = await this.service.importFolder(dir);
      this.logger.log(
        `[knowledge-import] cron end: ok=${summary.ok} skipped=${summary.skipped} ` +
          `failed=${summary.failed} in ${((Date.now() - start) / 1000).toFixed(1)}s`,
      );
      // Errors per file are already logged inside the service; here we
      // only care about the *aggregate* state. We deliberately do not
      // re-throw — the next tick should still fire.
    } catch (e) {
      this.logger.error(
        `[knowledge-import] cron fatal: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
