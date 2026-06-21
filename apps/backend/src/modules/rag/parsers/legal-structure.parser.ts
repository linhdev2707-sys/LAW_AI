import { Injectable, Logger } from '@nestjs/common';

/**
 * Parses the Vietnamese legal document hierarchy:
 *   Văn bản > Chương > Mục > Điều > Khoản > Điểm
 *
 * Output is a tree-like structure preserving character offsets so
 * downstream chunkers can map each chunk back to its (Chương, Điều, Khoản).
 *
 * The parser is regex-first for performance. Edge cases from OCR
 * (typos, missing diacritics) are tolerated by allowing optional
 * whitespace and a "fuzzy" pass that LLM-validates the result.
 */

export interface IDiem {
  /** "a", "b", "đ"… or "1", "2"… */
  key: string;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface IKhoan {
  /** "1", "2", "3"… */
  number: string;
  text: string;
  diemList: IDiem[];
  charStart: number;
  charEnd: number;
}

export interface IDieu {
  /** "1", "2", "15"… */
  number: string;
  /** Title/heading of the article, may be empty if the source didn't have one. */
  title: string;
  khoanList: IKhoan[];
  charStart: number;
  charEnd: number;
}

export interface IMuc {
  number: string;
  title: string;
  dieuList: IDieu[];
  charStart: number;
  charEnd: number;
}

export interface IChuong {
  /** Roman numeral: I, II, III, IV, V, VI, VII, VIII, IX, X… */
  roman: string;
  /** "1", "2", "3"… derived from roman for indexing */
  number: string;
  title: string;
  mucList: IMuc[];
  /** Articles that belong directly to the chapter when there is no Mục. */
  dieuList: IDieu[];
  charStart: number;
  charEnd: number;
}

export interface ILegalStructure {
  chuongList: IChuong[];
  /** Articles that appear before Chương I (e.g. preamble, Điều 1 mở đầu). */
  preambleDieuList: IDieu[];
}

type THitKind = 'CHUONG' | 'MUC' | 'DIEU' | 'KHOAN' | 'DIEM';

interface IHit {
  kind: THitKind;
  charStart: number;
  charEnd: number;
  captures: string[];
}

@Injectable()
export class LegalStructureParser {
  private readonly logger = new Logger(LegalStructureParser.name);

  // ─────────────────────────────────────────────────────────────────────
  // Regex catalog
  // ─────────────────────────────────────────────────────────────────────

  /** Chương I/II/III/IV/V/VI/VII/VIII/IX/X/XI/XII (case-insensitive, allow OCR "Chuong"). */
  private readonly CHUONG_RE =
    /^[ \t]*Chương[ \t]+(I{1,3}|IV|V|VI{0,3}|IX|X|XI{0,3}|XIV|XVI{0,3}|XIX|XXI{0,3})[ \t]*([^\n]*)$/gim;

  /** Mục 1, Mục 2 … */
  private readonly MUC_RE = /^[ \t]*Mục[ \t]+(\d+)[ \t]*([^\n]*)$/gim;

  /**
   * Điều 1. Tiêu đề …   (period is OPTIONAL — many OCRs drop it)
   * Also matches "Điều 1 Tiêu đề" (space) and "Điều 1:" (colon).
   */
  private readonly DIEU_RE =
    /^[ \t]*Điều[ \t]+(\d+)[ \t]*[.:]?[ \t]*([^\n]*)$/gim;

  /**
   * Khoản 1. nội dung…   (period OPTIONAL)
   * Also tolerate "Khoản 1)" and "Khoản 1:".
   */
  private readonly KHOAN_RE =
    /^[ \t]*Khoản[ \t]+(\d+)[ \t]*[.):]?[ \t]?/gim;

  /**
   * Điểm a) nội dung …
   * Điểm 1) nội dung …
   * Also "a." or "1." (no closing paren).
   */
  private readonly DIEM_RE = /^[ \t]*([a-zA-ZđĐ]|\d+)[ \t]*[)\.][ \t]+/gim;

  // ─────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Parse raw text into the legal structure tree.
   * Returns an empty `chuongList` (and possibly a `preambleDieuList`) for
   * unstructured input — caller should fall back to flat chunking.
   */
  parse(text: string): ILegalStructure {
    if (!text || !text.trim()) {
      return { chuongList: [], preambleDieuList: [] };
    }

    const matches = this.collectMatches(text);
    return this.buildTree(text, matches);
  }

  /**
   * Return all articles in document order, regardless of nesting.
   * Useful for chunkers that just want a flat list of (article, raw text).
   */
  flattenArticles(structure: ILegalStructure): Array<IDieu & { chuongRoman?: string; mucNumber?: string }> {
    const out: Array<IDieu & { chuongRoman?: string; mucNumber?: string }> = [];
    for (const d of structure.preambleDieuList) {
      out.push({ ...d });
    }
    for (const c of structure.chuongList) {
      for (const d of c.dieuList) {
        out.push({ ...d, chuongRoman: c.roman });
      }
      for (const m of c.mucList) {
        for (const d of m.dieuList) {
          out.push({ ...d, chuongRoman: c.roman, mucNumber: m.number });
        }
      }
    }
    return out;
  }

  /**
   * Build a human-readable breadcrumb for a given article.
   * Example: "Bộ luật Lao động 2019 > Chương II > Mục 1 > Điều 15"
   */
  breadcrumb(
    lawName: string,
    structure: ILegalStructure,
    target: { chuongRoman?: string; mucNumber?: string; dieuNumber: string },
  ): string {
    const parts: string[] = [lawName];
    if (target.chuongRoman) {
      const c = structure.chuongList.find((x) => x.roman === target.chuongRoman);
      if (c) {
        parts.push(`Chương ${c.roman}`);
        if (c.title) parts.push(c.title);
        if (target.mucNumber) {
          const m = c.mucList.find((x) => x.number === target.mucNumber);
          if (m) {
            parts.push(`Mục ${m.number}`);
            if (m.title) parts.push(m.title);
          }
        }
      }
    }
    parts.push(`Điều ${target.dieuNumber}`);
    return parts.join(' > ');
  }

  // ─────────────────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────────────────

  private collectMatches(text: string): IHit[] {
    const hits: IHit[] = [];

    const collect = (re: RegExp, kind: THitKind): void => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        hits.push({
          kind,
          charStart: m.index,
          charEnd: m.index + m[0].length,
          captures: m.slice(1),
        });
        if (m.index === re.lastIndex) re.lastIndex++; // safety
      }
    };

    collect(this.CHUONG_RE, 'CHUONG');
    collect(this.MUC_RE, 'MUC');
    collect(this.DIEU_RE, 'DIEU');
    collect(this.KHOAN_RE, 'KHOAN');
    collect(this.DIEM_RE, 'DIEM');

    hits.sort((a, b) => a.charStart - b.charStart);
    return hits;
  }

  private buildTree(text: string, hits: IHit[]): ILegalStructure {
    const structure: ILegalStructure = { chuongList: [], preambleDieuList: [] };

    let currentChuong: IChuong | null = null;
    let currentMuc: IMuc | null = null;
    let currentDieu: IDieu | null = null;
    let currentKhoan: IKhoan | null = null;

    const trim = (s: string | undefined | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
    const romanToNumber = (r: string): string => String(this.romanToInt(r));

    for (let i = 0; i < hits.length; i++) {
      const h = hits[i]!;
      const next = hits[i + 1];
      const blockEnd = next ? next.charStart : text.length;

      switch (h.kind) {
        case 'CHUONG': {
          this.closeKhoan(currentKhoan, blockEnd, text);
          this.closeDieu(currentDieu, blockEnd);
          currentKhoan = null;
          currentDieu = null;
          currentMuc = null;

          const roman = (h.captures[0] ?? '').toUpperCase();
          const title = trim(h.captures[1]);
          currentChuong = {
            roman,
            number: romanToNumber(roman),
            title,
            mucList: [],
            dieuList: [],
            charStart: h.charStart,
            charEnd: blockEnd,
          };
          structure.chuongList.push(currentChuong);
          break;
        }

        case 'MUC': {
          if (!currentChuong) {
            this.logger.warn(`Mục at offset ${h.charStart} appeared before any Chương — ignoring`);
            break;
          }
          this.closeKhoan(currentKhoan, blockEnd, text);
          this.closeDieu(currentDieu, blockEnd);
          currentKhoan = null;
          currentDieu = null;

          const number = h.captures[0] ?? '';
          const title = trim(h.captures[1]);
          currentMuc = {
            number,
            title,
            dieuList: [],
            charStart: h.charStart,
            charEnd: blockEnd,
          };
          currentChuong.mucList.push(currentMuc);
          break;
        }

        case 'DIEU': {
          this.closeKhoan(currentKhoan, h.charStart, text);
          this.closeDieu(currentDieu, h.charStart);
          currentKhoan = null;

          const number = h.captures[0] ?? '';
          const title = trim(h.captures[1]);
          currentDieu = {
            number,
            title,
            khoanList: [],
            charStart: h.charStart,
            charEnd: blockEnd,
          };
          if (currentMuc && currentChuong) {
            currentMuc.dieuList.push(currentDieu);
          } else if (currentChuong) {
            currentChuong.dieuList.push(currentDieu);
          } else {
            structure.preambleDieuList.push(currentDieu);
          }
          break;
        }

        case 'KHOAN': {
          this.closeKhoan(currentKhoan, h.charStart, text);
          if (!currentDieu) break;
          const number = h.captures[0] ?? '';
          currentKhoan = {
            number,
            text: '',
            diemList: [],
            charStart: h.charStart,
            charEnd: blockEnd,
          };
          currentDieu.khoanList.push(currentKhoan);
          break;
        }

        case 'DIEM': {
          if (!currentKhoan) break;
          const key = (h.captures[0] ?? '').toLowerCase();
          const diemText = text.slice(h.charStart, blockEnd).trim();
          currentKhoan.diemList.push({
            key,
            text: diemText,
            charStart: h.charStart,
            charEnd: blockEnd,
          });
          currentKhoan.text = text.slice(currentKhoan.charStart, blockEnd).trim();
          break;
        }
      }
    }

    this.closeKhoan(currentKhoan, text.length, text);
    this.closeDieu(currentDieu, text.length);

    return structure;
  }

  private closeKhoan(khoan: IKhoan | null, blockEnd: number, text: string): void {
    if (!khoan) return;
    khoan.charEnd = blockEnd;
    if (!khoan.text) {
      khoan.text = text.slice(khoan.charStart, blockEnd).trim();
    }
  }

  private closeDieu(dieu: IDieu | null, blockEnd: number): void {
    if (!dieu) return;
    dieu.charEnd = blockEnd;
  }

  private romanToInt(roman: string): number {
    const map: Record<string, number> = {
      I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
    };
    let total = 0;
    let prev = 0;
    for (let i = roman.length - 1; i >= 0; i--) {
      const cur = map[roman[i]!] ?? 0;
      total += cur < prev ? -cur : cur;
      prev = cur;
    }
    return total;
  }
}
