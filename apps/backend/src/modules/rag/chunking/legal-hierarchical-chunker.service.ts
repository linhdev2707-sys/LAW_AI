import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encode } from 'gpt-tokenizer';
import {
  LegalStructureParser,
  ILegalStructure,
  IDieu,
  IKhoan,
} from '../parsers/legal-structure.parser';

/**
 * A single retrieval unit. Always carries enough context (breadcrumb +
 * law name) to be self-describing.
 */
export interface ILegalChunk {
  id?: string;
  documentId?: string;
  chunkIndex: number;
  /** Chunk text. Always includes the breadcrumb as a header. */
  content: string;
  /** Plain text WITHOUT the breadcrumb (used for citation). */
  rawText: string;
  tokenCount: number;
  breadcrumb: string;
  lawName: string;
  lawNumber?: string;
  chapter?: string;
  section?: string;
  article: string;
  clause?: string;
  point?: string;
  charStart: number;
  charEnd: number;
}

interface IChunkerConfig {
  maxTokens: number;
  hardMaxTokens: number;
  overlapTokens: number;
}

@Injectable()
export class LegalHierarchicalChunkerService {
  private readonly logger = new Logger(LegalHierarchicalChunkerService.name);
  private readonly cfg: IChunkerConfig;

  constructor(
    private readonly structureParser: LegalStructureParser,
    config: ConfigService,
  ) {
    this.cfg = {
      maxTokens: config.get<number>('app.rag.chunkSize', 480),
      hardMaxTokens: config.get<number>('app.rag.hardChunkSize', 720),
      overlapTokens: config.get<number>('app.rag.chunkOverlap', 50),
    };
  }

  /**
   * Chunk a raw legal document.
   *
   * Strategy:
   *  1) Try to parse the legal structure.
   *  2) If parse succeeds with at least one Điều → walk the tree and emit
   *     one chunk per Khoản (with breadcrumb header).
   *  3) If a Khoản is longer than `hardMaxTokens` → split at Điểm boundary
   *     using the same sliding window as the legacy chunker.
   *  4) If parse FAILS (no Điều detected) → fall back to flat chunking.
   */
  chunk(
    rawText: string,
    lawName: string,
    lawNumber?: string,
  ): ILegalChunk[] {
    const cleaned = rawText.replace(/\r\n/g, '\n').trim();
    if (!cleaned) return [];

    const structure = this.structureParser.parse(cleaned);
    const articles = this.structureParser.flattenArticles(structure);

    if (articles.length === 0) {
      this.logger.warn(
        `[${lawName}] No legal structure detected — falling back to flat chunking`,
      );
      return this.flatFallback(cleaned, lawName, lawNumber);
    }

    const chunks: ILegalChunk[] = [];
    let idx = 0;

    for (const article of articles) {
      const breadcrumb = this.structureParser.breadcrumb(lawName, structure, {
        chuongRoman: (article as IDieu & { chuongRoman?: string }).chuongRoman,
        mucNumber: (article as IDieu & { mucNumber?: string }).mucNumber,
        dieuNumber: article.number,
      });

      if (article.khoanList.length === 0) {
        const articleText = cleaned.slice(article.charStart, article.charEnd).trim();
        const tokens = encode(articleText).length;
        if (tokens <= this.cfg.hardMaxTokens) {
          chunks.push(
            this.makeChunk({
              chunkIndex: idx++,
              content: this.wrapWithBreadcrumb(breadcrumb, articleText),
              rawText: articleText,
              tokenCount: tokens,
              breadcrumb,
              lawName,
              lawNumber,
              chapter: (article as IDieu & { chuongRoman?: string }).chuongRoman,
              section: (article as IDieu & { mucNumber?: string }).mucNumber,
              article: article.number,
              charStart: article.charStart,
              charEnd: article.charEnd,
            }),
          );
        } else {
          for (const sub of this.splitLong(articleText, this.cfg.hardMaxTokens, this.cfg.overlapTokens)) {
            chunks.push(
              this.makeChunk({
                chunkIndex: idx++,
                content: this.wrapWithBreadcrumb(breadcrumb, sub),
                rawText: sub,
                tokenCount: encode(sub).length,
                breadcrumb,
                lawName,
                lawNumber,
                chapter: (article as IDieu & { chuongRoman?: string }).chuongRoman,
                section: (article as IDieu & { mucNumber?: string }).mucNumber,
                article: article.number,
                charStart: article.charStart,
                charEnd: article.charEnd,
              }),
            );
          }
        }
        continue;
      }

      for (const khoan of article.khoanList) {
        const khoanText = cleaned.slice(khoan.charStart, khoan.charEnd).trim();
        const khoanTokens = encode(khoanText).length;

        if (khoanTokens <= this.cfg.hardMaxTokens) {
          chunks.push(
            this.makeChunk({
              chunkIndex: idx++,
              content: this.wrapWithBreadcrumb(breadcrumb, khoanText),
              rawText: khoanText,
              tokenCount: khoanTokens,
              breadcrumb,
              lawName,
              lawNumber,
              chapter: (article as IDieu & { chuongRoman?: string }).chuongRoman,
              section: (article as IDieu & { mucNumber?: string }).mucNumber,
              article: article.number,
              clause: khoan.number,
              charStart: khoan.charStart,
              charEnd: khoan.charEnd,
            }),
          );
        } else {
          const subChunks = this.splitKhoanAtDiem(khoan, cleaned);
          for (const sub of subChunks) {
            chunks.push(
              this.makeChunk({
                chunkIndex: idx++,
                content: this.wrapWithBreadcrumb(breadcrumb, sub.text),
                rawText: sub.text,
                tokenCount: encode(sub.text).length,
                breadcrumb,
                lawName,
                lawNumber,
                chapter: (article as IDieu & { chuongRoman?: string }).chuongRoman,
                section: (article as IDieu & { mucNumber?: string }).mucNumber,
                article: article.number,
                clause: khoan.number,
                point: sub.point,
                charStart: sub.charStart,
                charEnd: sub.charEnd,
              }),
            );
          }
        }
      }
    }

    this.logger.log(
      `[${lawName}] Hierarchical chunker emitted ${chunks.length} chunks from ${articles.length} articles`,
    );
    return chunks;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────

  private wrapWithBreadcrumb(breadcrumb: string, text: string): string {
    return `[${breadcrumb}]\n${text}`;
  }

  private splitKhoanAtDiem(
    khoan: IKhoan,
    fullText: string,
  ): Array<{ text: string; point?: string; charStart: number; charEnd: number }> {
    if (khoan.diemList.length <= 1) {
      return [{ text: fullText.slice(khoan.charStart, khoan.charEnd), charStart: khoan.charStart, charEnd: khoan.charEnd }];
    }

    const out: Array<{ text: string; point?: string; charStart: number; charEnd: number }> = [];

    const firstDiem = khoan.diemList[0]!;
    const preamble = fullText.slice(khoan.charStart, firstDiem.charStart).trim();
    if (preamble) {
      out.push({
        text: preamble,
        charStart: khoan.charStart,
        charEnd: firstDiem.charStart,
      });
    }

    for (let i = 0; i < khoan.diemList.length; i++) {
      const d = khoan.diemList[i]!;
      const next = khoan.diemList[i + 1];
      const end = next ? next.charStart : khoan.charEnd;
      const slice = fullText.slice(d.charStart, end).trim();
      if (!slice) continue;

      if (encode(slice).length > this.cfg.hardMaxTokens) {
        for (const sub of this.splitLong(slice, this.cfg.hardMaxTokens, this.cfg.overlapTokens)) {
          out.push({
            text: sub,
            point: d.key,
            charStart: d.charStart,
            charEnd: end,
          });
        }
      } else {
        out.push({ text: slice, point: d.key, charStart: d.charStart, charEnd: end });
      }
    }

    return out;
  }

  private splitLong(text: string, maxTokens: number, overlap: number): string[] {
    const { decode } = require('gpt-tokenizer');
    const tokens = encode(text);
    if (tokens.length <= maxTokens) return [text];
    const step = maxTokens - overlap;
    const out: string[] = [];
    for (let start = 0; start < tokens.length; start += step) {
      const end = Math.min(start + maxTokens, tokens.length);
      const slice = decode(tokens.slice(start, end)).trim();
      if (slice) out.push(slice);
      if (end === tokens.length) break;
    }
    return out;
  }

  private flatFallback(text: string, lawName: string, lawNumber?: string): ILegalChunk[] {
    const { decode } = require('gpt-tokenizer');
    const tokens = encode(text);
    const max = 600;
    const overlap = 100;
    const step = max - overlap;
    const out: ILegalChunk[] = [];
    let idx = 0;
    for (let start = 0; start < tokens.length; start += step) {
      const end = Math.min(start + max, tokens.length);
      const slice = decode(tokens.slice(start, end)).trim();
      if (!slice) continue;
      out.push(
        this.makeChunk({
          chunkIndex: idx++,
          content: this.wrapWithBreadcrumb(lawName, slice),
          rawText: slice,
          tokenCount: encode(slice).length,
          breadcrumb: lawName,
          lawName,
          lawNumber,
          article: '?',
          charStart: 0,
          charEnd: text.length,
        }),
      );
      if (end === tokens.length) break;
    }
    return out;
  }

  private makeChunk(input: Omit<ILegalChunk, 'id' | 'documentId'>): ILegalChunk {
    return { ...input };
  }

  static stripBreadcrumb(content: string): string {
    const idx = content.indexOf('\n');
    if (idx > 0 && content.startsWith('[') && content.slice(0, idx).endsWith(']')) {
      return content.slice(idx + 1).trim();
    }
    return content;
  }
}
