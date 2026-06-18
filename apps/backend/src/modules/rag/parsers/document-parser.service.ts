import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { PdfNeedsOcrError } from './pdf-needs-ocr.error';

// pdf-parse 1.x has no @types, and we lazy-load it on first PDF to avoid
// a hard require() at module load time (the package pulls in pdfjs-dist
// whose top-level evaluation can crash on Node < 22 if any DOMMatrix-style
// global is missing). The require is also wrapped in a try/catch so a
// missing/incompatible pdf-parse doesn't take down the whole service.
type PdfParseFn = (buf: Buffer) => Promise<{ text: string; numpages?: number }>;
let _pdfParse: PdfParseFn | null = null;
function getPdfParse(): PdfParseFn {
  if (_pdfParse) return _pdfParse;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  _pdfParse = require('pdf-parse') as PdfParseFn;
  return _pdfParse;
}

// Minimum recovered-text length (after trim) to consider a PDF "has a
// text layer". Below this threshold the recovered string is almost always
// PDF metadata or junk, and we'd rather let OCR handle the file than
// embed garbage chunks.
const MIN_USEFUL_TEXT = 80;

// Hard wall-clock cap on the BT/ET walker. Most legal PDFs finish in
// low milliseconds; we abort well before this on pathological inputs
// (e.g. 50 MB FlateDecode-heavy PDFs) and fall through to OCR.
const BT_ET_TIMEOUT_MS = 2000;

// Per-BT-block search window. If we don't find a matching ET within this
// many bytes, treat the block as corrupt/non-text and move on.
const BT_ET_BLOCK_LIMIT = 64 * 1024;

/**
 * Best-effort plain-text extraction for uploaded documents.
 *
 * Supported input types: PDF (via pdf-parse), DOCX (via mammoth), DOC (via word-extractor),
 * and plain text / Markdown (utf-8). Anything else is rejected with an
 * error that's mapped to a 4xx by the global exception filter.
 *
 * The output feeds straight into the existing RAG ingest pipeline
 * (chunker → embedder), so we normalise line endings, trim, and
 * surface a clear error when the document yields no usable text
 * (e.g. a PDF that's only scanned images with no OCR layer).
 */
@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * Extract plain text from a binary upload.
   *
   * @param buffer   Raw file bytes (max 10 MB enforced at the controller)
   * @param mimeType MIME type from the multipart `file` field, used to
   *                 pick the parser. May be `application/octet-stream`
   *                 in which case we fall back to the filename extension.
   * @param filename Original filename (only used for the octet-stream fallback)
   */
  async extractText(buffer: Buffer, mimeType: string, filename?: string): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new Error('Uploaded file is empty');
    }

    const effectiveMime = this.resolveMimeType(mimeType, filename);
    let text: string;

    try {
      switch (effectiveMime) {
        case 'application/pdf':
          text = await this.fromPdf(buffer);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          text = await this.fromDocx(buffer);
          break;
        case 'application/msword':
          text = await this.fromDoc(buffer);
          break;
        case 'text/markdown':
        case 'text/plain':
          text = buffer.toString('utf8');
          break;
        case 'application/json':
          text = this.fromJson(buffer);
          break;
        default:
          throw new Error(
            `Unsupported file type: ${mimeType || 'unknown'}` +
              (filename ? ` (filename=${filename})` : ''),
          );
      }
    } catch (e) {
      // Re-throw typed errors (PdfNeedsOcrError, Unsupported file type)
      // untouched so the controller can `instanceof`-check them.
      if (e instanceof PdfNeedsOcrError) throw e;
      if (e instanceof Error && e.message.startsWith('Unsupported file type')) throw e;
      if (e instanceof Error && e.message.startsWith('Uploaded file is empty')) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Parse failed for ${effectiveMime}: ${msg}`);
      throw new Error(`Failed to parse ${effectiveMime}: ${msg}`);
    }

    // Normalise + trim. Use 1GB upper bound to guard against pathological
    // inputs — the chunker will turn it into smaller pieces anyway.
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    if (!cleaned) {
      throw new Error(
        'Document produced no extractable text ' +
          '(PDF may be scanned/image-only with no text layer)',
      );
    }
    return cleaned;
  }

  /**
   * Pick a real MIME type for routing. `application/octet-stream` is what
   * browsers send when they don't recognise the file — we sniff the
   * extension in that case to keep the API forgiving.
   */
  private resolveMimeType(mimeType: string, filename?: string): string {
    if (mimeType && mimeType !== 'application/octet-stream') {
      return mimeType;
    }
    if (!filename) return mimeType;
    const ext = extname(filename).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.doc':
        return 'application/msword';
      case '.md':
      case '.markdown':
        return 'text/markdown';
      case '.txt':
        return 'text/plain';
      case '.json':
        return 'application/json';
      default:
        return mimeType;
    }
  }

  private async fromPdf(buffer: Buffer): Promise<string> {
    // Stage A — pdf-parse (fast path). Returns "" for files pdf-parse can't
    // decode (often because it bundles an outdated pdf.js that misparses
    // newer PDFs); throws on truly malformed inputs.
    try {
      const text = await this.fromPdfWithPdfParse(buffer);
      if (text.trim().length >= MIN_USEFUL_TEXT) return text;
    } catch (e) {
      this.logger.warn(
        `pdf-parse failed, trying BT/ET fallback: ${(e as Error).message}`,
      );
    }

    // Stage B — raw BT...ET content-stream walker. Recovers text from
    // PDFs that pdf-parse silently returns empty for. Cheap and library-
    // independent.
    const fallbackText = this.fromPdfRawTextStreams(buffer);
    if (fallbackText.trim().length >= MIN_USEFUL_TEXT) {
      this.logger.log(
        'Recovered PDF text via raw BT/ET scan — pdf-parse missed it',
      );
      return fallbackText;
    }

    // Stage C — image count. If both text stages came up empty but the
    // file has at least one embedded image, it's a scan that needs OCR.
    // Zero images means blank/metadata-only → fail loudly.
    const hasImages = this.countEmbeddedImages(buffer) > 0;
    throw new PdfNeedsOcrError(hasImages);
  }

  private async fromPdfWithPdfParse(buffer: Buffer): Promise<string> {
    const pdfParse = getPdfParse();
    const result = await pdfParse(buffer);
    return result.text || '';
  }

  /**
   * Walk the raw PDF byte stream looking for `BT ... ET` text blocks and
   * concatenate any string operands of the text-showing operators inside
   * them (`Tj`, `TJ`, `'`, `"`). This is the same approach pdf.js takes
   * at its lowest level — it works for any conforming text PDF regardless
   * of pdf.js version, and it cannot be fooled by encryption or broken
   * cross-refs because it never tries to follow the page tree.
   *
   * It is intentionally simple: no positioning, no font metrics, no kerning
   * — the chunker normalises whitespace downstream, and any garbage from a
   * custom CMap is filtered by the MIN_USEFUL_TEXT length check in the
   * caller. /FlateDecode streams are skipped (we can't inflate on the
   * cheap); in practice those files are still readable by Stage A above,
   * so the worst case is "file falls through to OCR" which is the safe
   * behaviour.
   */
  private fromPdfRawTextStreams(buffer: Buffer): string {
    const start = Date.now();
    const haystack = buffer;
    const out: string[] = [];
    let searchFrom = 0;

    // Iterate over every BT...ET block in the file. PDF keywords are
    // case-sensitive and uppercase in valid PDFs.
    while (searchFrom < haystack.length) {
      if (Date.now() - start > BT_ET_TIMEOUT_MS) break;

      const btIdx = haystack.indexOf(Buffer.from('BT'), searchFrom);
      if (btIdx === -1) break;

      // Boundary check: BT must be preceded by whitespace or be at offset 0
      // to avoid matching inside other tokens (e.g. "OBTJ").
      if (btIdx > 0) {
        const prev = haystack[btIdx - 1];
        if (prev !== 0x20 && prev !== 0x0a && prev !== 0x0d && prev !== 0x09 && prev !== 0x00) {
          searchFrom = btIdx + 2;
          continue;
        }
      }

      const etLimit = Math.min(haystack.length, btIdx + BT_ET_BLOCK_LIMIT);
      const etIdx = haystack.indexOf(Buffer.from('ET'), btIdx + 2);
      if (etIdx === -1 || etIdx >= etLimit) {
        searchFrom = btIdx + 2;
        continue;
      }

      // Slice the block and scan for text-showing operators. We operate on
      // a copy of the slice as a string so we can use regex for the
      // operator-and-operand pairing without re-walking byte-by-byte.
      const block = haystack.subarray(btIdx, etIdx + 2).toString('latin1');
      const blockText = this.extractStringsFromTextBlock(block);
      if (blockText) out.push(blockText);

      searchFrom = etIdx + 2;
    }

    return out.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Given a `BT ... ET` block as a latin1 string, pull out all string
   * operands of text-showing operators. Operands come immediately before
   * the operator in left-to-right PDF grammar.
   */
  private extractStringsFromTextBlock(block: string): string {
    // Find each Tj / TJ / ' / "  and capture the operand that precedes it.
    // We allow either a parenthesised string `( ... )` with balanced parens
    // (PDF string literal) or a hex string `< ... >`.
    const opPattern = /\b(TJ|Tj|'|")/g;
    const parts: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = opPattern.exec(block)) !== null) {
      const operand = this.readStringOperandBefore(block, m.index);
      if (operand !== null) parts.push(operand);
    }
    return parts.join(' ');
  }

  /**
   * Walk backwards from `opIndex` (position of a text-show operator) and
   * return the decoded PDF string operand, or null if we can't find one
   * within a reasonable distance.
   */
  private readStringOperandBefore(block: string, opIndex: number): string | null {
    // Strip trailing whitespace between operand and operator.
    let i = opIndex - 1;
    while (i >= 0 && (block[i] === ' ' || block[i] === '\t' || block[i] === '\n' || block[i] === '\r')) {
      i--;
    }
    if (i < 0) return null;

    // Look back at most ~256 chars — anything further is almost certainly
    // a different expression (matrix, font size, etc.), not a string operand.
    const startScan = Math.max(0, i - 256);

    if (block[i] === ')') {
      // Parenthesised literal. Walk back counting parens (PDF parens can
      // be escaped with backslash) until we hit the matching `(`.
      let depth = 1;
      let j = i - 1;
      while (j >= startScan && depth > 0) {
        if (block[j] === '\\') {
          j -= 2; // skip the escaped char
          continue;
        }
        if (block[j] === ')') depth++;
        else if (block[j] === '(') depth--;
        j--;
      }
      if (depth !== 0) return null;
      const openIdx = j + 1; // points to `(`
      const raw = block.slice(openIdx + 1, i); // between ( and )
      return this.decodePdfParenString(raw);
    }

    if (block[i] === '>') {
      // Hex literal `< ... >`. Walk back to the matching `<`.
      let j = i - 1;
      while (j >= startScan && block[j] !== '<') j--;
      if (j < startScan) return null;
      const hex = block.slice(j + 1, i).replace(/\s+/g, '');
      return this.decodePdfHexString(hex);
    }

    return null;
  }

  /** Decode a PDF parenthesised literal body. Handles `\\`, `\\(`, `\\)`, `\\n`, `\\r`, `\\t`. */
  private decodePdfParenString(raw: string): string {
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '\\' && i + 1 < raw.length) {
        const next = raw[i + 1];
        switch (next) {
          case 'n': out += '\n'; break;
          case 'r': out += '\r'; break;
          case 't': out += '\t'; break;
          case 'b': out += '\b'; break;
          case 'f': out += '\f'; break;
          case '(': out += '('; break;
          case ')': out += ')'; break;
          case '\\': out += '\\'; break;
          default: out += next; break;
        }
        i++;
      } else {
        out += c;
      }
    }
    // Latin-1 round-trip preserves WinAnsi mapping for the printable
    // subset (covers Vietnamese diacritics in most fonts that use the
    // standard WinAnsiEncoding). Garbage for code points outside that
    // subset is acceptable — MIN_USEFUL_TEXT filters it downstream.
    return Buffer.from(out, 'latin1').toString('latin1');
  }

  /** Decode a PDF hex string body (whitespace stripped by caller). */
  private decodePdfHexString(hex: string): string {
    if (hex.length % 2 === 1) hex += '0'; // pad odd-length
    if (!/^[0-9a-fA-F]*$/.test(hex)) return '';
    return Buffer.from(hex, 'hex').toString('latin1');
  }

  /**
   * Quick heuristic: count `/Subtype /Image` occurrences in the raw PDF
   * bytes. A scanned PDF with N pages has at least N such references
   * (one raster per page); a text-only PDF has zero. We use this only
   * to decide whether a text-less PDF is "scan-like" (route to OCR) or
   * "blank" (fail loudly).
   */
  private countEmbeddedImages(buffer: Buffer): number {
    const matches = buffer.toString('latin1').match(/\/Subtype\s*\/Image/g);
    return matches ? matches.length : 0;
  }

  private async fromDocx(buffer: Buffer): Promise<string> {
    // mammoth.extractRawText returns { value, messages } — value is plain text.
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  private async fromDoc(buffer: Buffer): Promise<string> {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return doc.getBody() || '';
  }

  /**
   * Convert a JSON document into a flat, semicolon-delimited string the
   * chunker + embedder can ingest.
   *
   * Why this format: the chunker is a sliding-window over plain text
   * with token-aware splitting. A JSON-stringified dump loses
   * structure and produces odd embeddings; a pretty-printed tree
   * keeps structure but eats tokens. The middle ground is "key: value"
   * pairs joined by newline+semicolon — readable, dense, and easy for
   * the embedder to chunk on legal-document-shaped text.
   *
   * Throws on malformed JSON so the caller can surface a clear error
   * to the user rather than embedding garbage.
   */
  private fromJson(buffer: Buffer): string {
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }

    // Walk the value tree and produce a list of "path.to.key: value"
    // lines. Objects and arrays are recursed; primitives are formatted
    // as-is. Strings get quoted so trailing/leading whitespace is
    // preserved through the chunker.
    const lines: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (value === null || value === undefined) {
        lines.push(`${path}: null`);
        return;
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${path}: []`);
          return;
        }
        value.forEach((item, idx) => walk(item, `${path}[${idx}]`));
        return;
      }
      if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
          lines.push(`${path}: {}`);
          return;
        }
        for (const [k, v] of entries) {
          const childPath = path ? `${path}.${k}` : k;
          walk(v, childPath);
        }
        return;
      }
      if (typeof value === 'string') {
        lines.push(`${path}: "${value.replace(/"/g, '\\"')}"`);
        return;
      }
      // number / boolean
      lines.push(`${path}: ${String(value)}`);
    };
    walk(parsed, '');
    return lines.join('\n');
  }
}
