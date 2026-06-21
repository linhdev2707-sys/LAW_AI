import { Injectable, Logger } from '@nestjs/common';

export interface IExtractedReference {
  /** "Điều 15", "Khoản 2 Điều 15", "Điểm a Khoản 2 Điều 15 Bộ luật Lao động 2019" */
  raw: string;
  targetType?: string;
  targetLawName?: string;
  targetLawNumber?: string;
  article?: string;
  clause?: string;
  point?: string;
  charStart: number;
  charEnd: number;
  relation?: string;   // THAM_CHIEU | SUA_DOI | THAY_THE | BAI_BO | HET_HIEU_LUC
}

/**
 * Extracts cross-references from a Vietnamese legal document. Used to
 * populate the Knowledge Graph (THAM_CHIEU, SUA_DOI, BAI_BO relations)
 * and to enrich chunks with "see also" links at retrieval time.
 */
@Injectable()
export class ReferenceExtractorService {
  private readonly logger = new Logger(ReferenceExtractorService.name);

  private readonly REF_RE =
    /(Điểm\s+[a-zA-ZđĐ]\s+)?(Khoản\s+\d+\s+)?(Điều\s+\d+(?:\s+Bộ\s+luật|\s+Luật|\s+Nghị\s+định|\s+Thông\s+tư|\s+Quyết\s+định|\s+Nghị\s+quyết|\s+Pháp\s+lệnh)?[^\.\,;]{0,200}?)(?=[,.;\n]|$)/gim;

  private readonly LAW_REF_RE =
    /(?:theo|quy\s+định\s+tại|căn\s+cứ\s+vào)\s+(Bộ\s+luật|Luật|Nghị\s+định|Thông\s+tư|Quyết\s+định|Nghị\s+quyết|Pháp\s+lệnh)\s+([^\.\,;\n]{3,200}?)(?:\s+(số\s+\d+\/\d+\/[A-ZĐ0-9-]+))?/gim;

  private readonly RELATION_RE =
    /\b(sửa\s+đổi,\s*bổ\s*sung|thay\s+thế|bãi\s*bỏ|hết\s+hiệu\s+lực|mất\s+hiệu\s+lực)\b\s+(Bộ\s+luật|Luật|Nghị\s+định|Thông\s+tư|Quyết\s+định|Nghị\s+quyết|Pháp\s+lệnh)\s+([^\.\,;\n]{3,200}?)(?:\s+số\s+(\d+\/\d+\/[A-ZĐ0-9-]+))?/gim;

  extract(text: string): IExtractedReference[] {
    const out: IExtractedReference[] = [];

    let m: RegExpExecArray | null;

    // 1) Direct article references
    this.REF_RE.lastIndex = 0;
    while ((m = this.REF_RE.exec(text)) !== null) {
      const raw = m[0].trim();
      out.push({
        raw,
        ...this.parseArticleRef(raw),
        charStart: m.index,
        charEnd: m.index + m[0].length,
      });
    }

    // 2) Whole-law references
    this.LAW_REF_RE.lastIndex = 0;
    while ((m = this.LAW_REF_RE.exec(text)) !== null) {
      const raw = m[0].trim();
      out.push({
        raw,
        targetType: this.normDocType(m[1]!),
        targetLawName: `${m[1]?.trim()} ${m[2]?.trim()}`.replace(/\s+/g, ' ').trim(),
        targetLawNumber: m[3]?.replace(/^số\s+/i, '').trim() ?? undefined,
        charStart: m.index,
        charEnd: m.index + m[0].length,
      });
    }

    // 3) Amendment / repeal relations
    this.RELATION_RE.lastIndex = 0;
    while ((m = this.RELATION_RE.exec(text)) !== null) {
      const verb = m[1]!.toLowerCase();
      const relation =
        /sửa\s+đổi/.test(verb) ? 'SUA_DOI' :
        /thay\s+thế/.test(verb) ? 'THAY_THE' :
        /bãi\s*bỏ|mất\s+hiệu\s+lực/.test(verb) ? 'BAI_BO' :
        /hết\s+hiệu\s+lực/.test(verb) ? 'HET_HIEU_LUC' : 'THAM_CHIEU';
      const raw = m[0].trim();
      out.push({
        raw,
        targetType: this.normDocType(m[2]!),
        targetLawName: `${m[2]?.trim()} ${m[3]?.trim()}`.replace(/\s+/g, ' ').trim(),
        targetLawNumber: m[4],
        article: undefined,
        clause: undefined,
        point: undefined,
        charStart: m.index,
        charEnd: m.index + m[0].length,
        relation,
      });
    }

    // Dedupe by (charStart, raw)
    const seen = new Set<string>();
    return out.filter((r) => {
      const k = `${r.charStart}::${r.raw}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────

  private parseArticleRef(raw: string): Pick<IExtractedReference, 'article' | 'clause' | 'point' | 'targetLawName'> {
    const out: Pick<IExtractedReference, 'article' | 'clause' | 'point' | 'targetLawName'> = {
      article: undefined, clause: undefined, point: undefined, targetLawName: undefined,
    };
    const article = raw.match(/Điều\s+(\d+)/);
    if (article) out.article = article[1]!;
    const clause = raw.match(/Khoản\s+(\d+)/);
    if (clause) out.clause = clause[1]!;
    const point = raw.match(/Điểm\s+([a-zA-ZđĐ])/);
    if (point) out.point = point[1]!.toLowerCase();
    const lawName = raw.match(/(Bộ\s+luật|Luật|Nghị\s+định|Thông\s+tư|Quyết\s+định)\s+([^\.\,;]+)/);
    if (lawName) out.targetLawName = `${lawName[1]?.trim()} ${lawName[2]?.trim()}`.trim();
    return out;
  }

  private normDocType(s: string): string {
    const t = s.toLowerCase();
    if (t.includes('bộ luật') || t === 'luật') return 'luat';
    if (t.includes('nghị định')) return 'nghi_dinh';
    if (t.includes('thông tư')) return 'thong_tu';
    if (t.includes('quyết định')) return 'quyet_dinh';
    if (t.includes('nghị quyết')) return 'nghi_quyet';
    if (t.includes('pháp lệnh')) return 'phap_lenh';
    return 'van_ban_khac';
  }
}
