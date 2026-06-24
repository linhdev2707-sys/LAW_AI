import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RagDocumentType, RagLegalStatus } from '../entities/rag-document.entity';
import { LlmService } from '../../llm/llm.service';

export interface IEnrichmentInput {
  documentName: string;
  fullText: string;
  sourceUrl?: string | null;
}

export interface IEnrichmentResult {
  documentType: RagDocumentType;
  lawName: string | null;
  lawNumber: string | null;
  issuer: string | null;
  issuedDate: Date | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  legalStatus: RagLegalStatus;
  extraMetadata: Record<string, unknown>;
}

/**
 * Extracts structured legal metadata from a parsed Vietnamese document.
 *
 * Pipeline:
 *   1) Regex pass — fast, deterministic, covers ~80% of well-formed docs.
 *   2) LLM pass — used ONLY when regex confidence is low OR specific
 *      fields (e.g. effective_date) are missing.
 *
 * The enrichment is ALWAYS synchronous from the caller's point of view.
 */
@Injectable()
export class MetadataEnricherService {
  private readonly logger = new Logger(MetadataEnricherService.name);
  private readonly useLlm: boolean;

  private readonly DOC_TYPE_HINTS: Array<{
    type: RagDocumentType;
    re: RegExp;
    issuer?: string;
  }> = [
    { type: RagDocumentType.LUAT, re: /Bộ\s+luật|Luật\s+/ },
    { type: RagDocumentType.NGHIDINH, re: /Nghị\s+định\s+(\d+\/\d+\/NĐ-CP)/, issuer: 'Chính phủ' },
    { type: RagDocumentType.THONGTU, re: /Thông\s+tư\s+(\d+\/\d+\/TT-)/, issuer: 'Bộ' },
    { type: RagDocumentType.QUYETDINH, re: /Quyết\s+định\s+(\d+\/QĐ-)/, issuer: 'Thủ tướng' },
    { type: RagDocumentType.NGHIPHAP, re: /Nghị\s+quyết\s+(\d+\/\d+\/QH)/, issuer: 'Quốc hội' },
    { type: RagDocumentType.PHAPLENH, re: /Pháp\s+lệnh\s+(\d+\/\d+\/UBTVQH)/, issuer: 'UBTVQH' },
  ];

  private readonly NUMBER_RE = /Số[:\s]+([0-9]+\/[0-9]+\/[A-ZĐ0-9-]+)/i;
  /**
   * Capture the law name. The character class is intentionally narrow:
   *   - exclude whitespace boundaries (\n, .)
   *   - exclude semicolons (;) and colons (:) which commonly appear
   *     after the title in real-world OCR text (e.g.
   *     "Luật Tổ chức Chính phủ ngày 25 tháng 12 năm 2001;")
   *   - exclude the dash/hyphen sequence which signals "về việc..."
   *     and other trailing clauses
   * The `+` is non-greedy so we stop at the first terminator.
   */
  private readonly LAW_NAME_RE =
    /(Bộ\s+luật|Luật|Nghị\s+định|Thông\s+tư|Quyết\s+định|Nghị\s+quyết|Pháp\s+lệnh)\s+([^\n.;:]{3,200}?)(?=\s+(?:năm|số|về|ngày|;|:|$))/i;

  private readonly DATE_RE =
    /(ngày\s+)?(\d{1,2})\s*(tháng\s+(\d{1,2})\s*)?(năm\s+(\d{4}))?|(\d{1,2}\/\d{1,2}\/\d{4})/gi;

  private readonly EFFECTIVE_RE =
    /có\s+hiệu\s+lực(?:\s+kể\s+từ|\s+từ|\s+ngày)\s+((?:ngày\s+)?\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i;

  private readonly EXPIRY_RE =
    /hết\s+hiệu\s+lực(?:\s+ngày|\s+từ\s+ngày|\s+kể\s+từ)?\s+((?:ngày\s+)?\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i;

  constructor(
    config: ConfigService,
    @Optional() private readonly llm?: LlmService,
  ) {
    this.useLlm = config.get<boolean>('app.rag.enricherUseLlm', true);
  }

  async enrich(input: IEnrichmentInput): Promise<IEnrichmentResult> {
    const text = input.fullText.slice(0, 8000);
    const regex = this.regexPass(input.documentName, text);

    if (regex.lawName && regex.lawNumber && regex.effectiveDate) {
      return regex;
    }

    // LLM pass is only attempted when:
    //  1) the config flag enables it
    //  2) the LlmService was actually injected (RagModule must import
    //     LlmModule for this). If either is false we silently fall back
    //     to the regex result — no error, no warning spam in the logs.
    if (!this.useLlm || !this.llm) {
      return regex;
    }

    try {
      const llm = await this.llmPass(input.documentName, text, regex);
      return { ...regex, ...llm };
    } catch (e: unknown) {
      this.logger.warn(`LLM enrichment failed, returning regex result: ${(e as Error).message}`);
      return regex;
    }
  }

  // ─── Regex pass ──────────────────────────────────────────────────────

  private regexPass(name: string, text: string): IEnrichmentResult {
    let documentType = RagDocumentType.VANBAN_KHAC;
    let issuer: string | null = null;
    for (const hint of this.DOC_TYPE_HINTS) {
      if (hint.re.test(text) || hint.re.test(name)) {
        documentType = hint.type;
        issuer = hint.issuer ?? null;
        break;
      }
    }

    const numMatch = text.match(this.NUMBER_RE);
    const lawNumber = numMatch?.[1] ?? null;

    const nameMatch = text.match(this.LAW_NAME_RE);
    const lawName = nameMatch
      ? `${nameMatch[1]?.trim()} ${nameMatch[2]?.trim()}`
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/[;:,]+$/, '')
      : null;

    const header = text.slice(0, 1500);
    const issuedDate = this.extractFirstDate(header);

    const effMatch = text.match(this.EFFECTIVE_RE);
    const effectiveDate = effMatch ? this.parseDate(effMatch[1]!) : null;

    const expMatch = text.match(this.EXPIRY_RE);
    const expiryDate = expMatch ? this.parseDate(expMatch[1]!) : null;

    let legalStatus = RagLegalStatus.KHONG_XAC_DINH;
    if (/hết\s+hiệu\s+lực\s+toàn\s+bộ/.test(text)) legalStatus = RagLegalStatus.HET_HIEU_LUC;
    else if (/hết\s+hiệu\s+lực\s+một\s+phần|hết\s+hiệu\s+lực\s+.*\s+Điều/.test(text))
      legalStatus = RagLegalStatus.HET_HIEU_LUC_MOT_PHAN;
    else if (effectiveDate && effectiveDate > new Date())
      legalStatus = RagLegalStatus.CHUA_CO_HIEU_LUC;
    else if (expiryDate && expiryDate < new Date()) legalStatus = RagLegalStatus.HET_HIEU_LUC;
    else if (effectiveDate) legalStatus = RagLegalStatus.CON_HIEU_LUC;

    return {
      documentType,
      lawName,
      lawNumber,
      issuer,
      issuedDate,
      effectiveDate,
      expiryDate,
      legalStatus,
      extraMetadata: {
        sourceName: name,
        regexConfidence: this.scoreConfidence(lawName, lawNumber, effectiveDate),
      },
    };
  }

  private scoreConfidence(
    lawName: string | null,
    lawNumber: string | null,
    effectiveDate: Date | null,
  ): number {
    let score = 0;
    if (lawName) score += 0.4;
    if (lawNumber) score += 0.4;
    if (effectiveDate) score += 0.2;
    return score;
  }

  // ─── LLM pass (optional, JSON mode) ─────────────────────────────────

  private async llmPass(
    name: string,
    text: string,
    seed: IEnrichmentResult,
  ): Promise<Partial<IEnrichmentResult>> {
    if (!this.llm) {
      throw new Error('LlmService not available; cannot run LLM enrichment pass');
    }
    const sys = `Bạn là bộ trích xuất siêu dữ liệu văn bản pháp luật Việt Nam. Trả về JSON hợp lệ.`;
    const usr = `Tên tài liệu: ${name}

Đoạn đầu văn bản:
"""${text.slice(0, 4000)}"""

Đã trích được (regex):
${JSON.stringify(seed, null, 2)}

Hãy bổ sung các trường còn thiếu hoặc sai. Trả về JSON đúng schema:
{
  "documentType": "luat|nghi_dinh|thong_tu|quyet_dinh|nghi_quyet|phap_lenh|hop_dong|van_ban_khac",
  "lawName": string|null,
  "lawNumber": string|null,
  "issuer": string|null,
  "issuedDate": "YYYY-MM-DD"|null,
  "effectiveDate": "YYYY-MM-DD"|null,
  "expiryDate": "YYYY-MM-DD"|null,
  "legalStatus": "con_hieu_luc|het_hieu_luc|het_hieu_luc_mot_phan|chua_co_hieu_luc|khong_xac_dinh"
}`;

    const raw = await this.callLlmJson(sys, usr);
    const parsed = safeJsonParse(raw);
    if (!parsed) {
      throw new Error('LLM returned non-JSON output even after stripping markdown');
    }
    return {
      documentType: (parsed.documentType as RagDocumentType) ?? seed.documentType,
      lawName: (parsed.lawName as string) ?? seed.lawName,
      lawNumber: (parsed.lawNumber as string) ?? seed.lawNumber,
      issuer: (parsed.issuer as string) ?? seed.issuer,
      issuedDate: parsed.issuedDate ? this.parseDate(String(parsed.issuedDate)) : seed.issuedDate,
      effectiveDate: parsed.effectiveDate
        ? this.parseDate(String(parsed.effectiveDate))
        : seed.effectiveDate,
      expiryDate: parsed.expiryDate ? this.parseDate(String(parsed.expiryDate)) : seed.expiryDate,
      legalStatus: (parsed.legalStatus as RagLegalStatus) ?? seed.legalStatus,
    };
  }

  /**
   * LlmService currently exposes only streaming APIs. For the one-shot
   * enrichment call we accumulate the stream and return the final text.
   * If/when LlmService grows a `completeJson` method we can swap this
   * for a direct call.
   */
  private async callLlmJson(sys: string, usr: string): Promise<string> {
    let text = '';
    for await (const delta of this.llm!.streamChat(
      [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
      {},
    )) {
      if (delta.content) text += delta.content;
    }
    return stripMarkdownJson(text);
  }

  // ─── Date helpers ────────────────────────────────────────────────────

  private extractFirstDate(text: string): Date | null {
    let m: RegExpExecArray | null;
    this.DATE_RE.lastIndex = 0;
    while ((m = this.DATE_RE.exec(text)) !== null) {
      const d = this.parseDate(m[0]);
      if (d) return d;
    }
    return null;
  }

  parseDate(raw: string): Date | null {
    const cleaned = raw.replace(/ngày\s+/i, '').trim();
    const slash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const [, dd, mm, yyyy] = slash;
      const d = new Date(Date.UTC(+yyyy!, +mm! - 1, +dd!));
      return isNaN(d.getTime()) ? null : d;
    }
    const vn = cleaned.match(/^(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})$/i);
    if (vn) {
      const [, dd, mm, yyyy] = vn;
      const d = new Date(Date.UTC(+yyyy!, +mm! - 1, +dd!));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Module-level helpers (no `this` — pure functions, easy to unit test)
// ─────────────────────────────────────────────────────────────────────

/**
 * Strip markdown code fences from LLM output. DeepSeek frequently
 * wraps JSON in:
 *   ```json
 *   { ... }
 *   ```
 * We try to extract the first {...} or [...] block; if that fails we
 * fall back to the original text so the caller can decide.
 */
export function stripMarkdownJson(raw: string): string {
  if (!raw) return raw;
  let s = raw.trim();

  // 1) Remove leading/trailing ``` fences
  const fenceAll = /^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i;
  const m = s.match(fenceAll);
  if (m) s = m[1]!.trim();

  // 2) If the string still contains markdown fences somewhere (LLM
  //    sometimes emits prose + a code block), grab the first {...} or [...]
  if (!s.startsWith('{') && !s.startsWith('[')) {
    const obj = s.match(/\{[\s\S]*\}/);
    const arr = s.match(/\[[\s\S]*\]/);
    if (obj) s = obj[0];
    else if (arr) s = arr[0];
  }

  return s.trim();
}

/**
 * Parse a string that may contain markdown-wrapped JSON. Returns the
 * parsed value or `null` if parsing fails. Never throws.
 */
export function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const cleaned = stripMarkdownJson(raw);
  try {
    const v = JSON.parse(cleaned);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}
