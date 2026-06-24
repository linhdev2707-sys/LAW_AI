import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Knowledge Graph service — Phase 4 placeholder.
 *
 * The full design uses Neo4j to model:
 *   (BoLuat) -[:CO_CHUONG]-> (Chuong) -[:CO_MUC]-> (Muc)
 *           -[:CO_DIEU]-> (Dieu) -[:CO_KHOAN]-> (Khoan) -[:CO_DIEM]-> (Diem)
 *           -[:THAM_CHIEU]-> (Dieu)        // cross-document reference
 *           -[:SUA_DOI]-> (Dieu)           // amends
 *           -[:THAY_THE]-> (Dieu)          // replaces
 *           -[:BAI_BO]-> (Dieu)            // repeals
 *   (KhaiNiem) <-[:DANH_NGHIA]- (Dieu)    // concept extraction
 *
 * Setting up a Neo4j instance requires Docker / Aura and is a separate
 * infra decision. Until then this service runs in STUB MODE: it
 * accepts all sync/query calls and returns empty results so the
 * surrounding code (agent tools, reindex pipeline) keeps working.
 *
 * To enable the real backend:
 *   1) Add `neo4j-driver` to package.json
 *   2) Set NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD in .env
 *   3) Replace the stub methods with actual Cypher queries
 */
@Injectable()
export class KgService implements OnModuleInit {
  private readonly logger = new Logger(KgService.name);
  private enabled = false;
  private driver: unknown = null; // typed as `any` once neo4j-driver is installed

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri = this.config.get<string>('app.neo4j.uri', '');
    const user = this.config.get<string>('app.neo4j.user', '');
    const password = this.config.get<string>('app.neo4j.password', '');
    if (!uri || !user || !password) {
      this.logger.log('Knowledge Graph: STUB MODE (set NEO4J_* env vars to enable)');
      this.enabled = false;
      return;
    }
    try {
      // Lazy import so the neo4j-driver dep is optional at runtime.
      const mod = 'neo4j-driver';
      const neo4j = await (new Function('m', 'return import(m)')(mod) as Promise<any>);
      this.driver = neo4j.default.driver(uri, neo4j.default.auth.basic(user, password));
      this.enabled = true;
      this.logger.log(`Knowledge Graph: CONNECTED to ${uri}`);
    } catch (e) {
      this.logger.warn(
        `Failed to init Neo4j driver (${(e as Error).message}); staying in stub mode`,
      );
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ─── STUB: sync a single document's legal tree into the graph ────────

  async syncDocument(input: {
    documentId: string;
    lawName?: string | null;
    lawNumber?: string | null;
    chapter?: string | null;
    article: string;
    clause?: string | null;
    point?: string | null;
    breadcrumb: string;
    references?: string[];
  }): Promise<{ ok: boolean; nodesCreated: number }> {
    if (!this.enabled) return { ok: false, nodesCreated: 0 };
    // Real implementation:
    //   MERGE (l:BoLuat {number: $lawNumber}) SET l.name = $lawName
    //   MERGE (l)-[:CO_DIEU]->(d:Dieu {number: $article, lawNumber: $lawNumber})
    //   ...
    this.logger.debug(`[stub] syncDocument ${input.documentId} → ${input.breadcrumb}`);
    return { ok: true, nodesCreated: 0 };
  }

  // ─── STUB: query the graph for cross-references ─────────────────────

  async expandReferences(input: {
    text: string;
    direction: 'forward' | 'backward' | 'both';
  }): Promise<Array<{ lawName: string; lawNumber?: string; article: string; relation: string }>> {
    if (!this.enabled) return [];
    // Real implementation runs Cypher:
    //   MATCH (d:Dieu)-[r:THAM_CHIEU|SUA_DOI|BAI_BO]->(t:Dieu)
    //   WHERE d.text CONTAINS $text
    //   RETURN t.lawName, t.lawNumber, t.number AS article, type(r) AS relation
    return [];
  }

  // ─── STUB: back-refs (who references this) ──────────────────────────

  async backwardReferences(input: {
    lawNumber?: string;
    article: string;
  }): Promise<Array<{ lawName: string; lawNumber?: string; article: string; relation: string }>> {
    if (!this.enabled) return [];
    return [];
  }

  async onModuleDestroy(): Promise<void> {
    if (this.driver && typeof (this.driver as any).close === 'function') {
      await (this.driver as any).close();
    }
  }
}
