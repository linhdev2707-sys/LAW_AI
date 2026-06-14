import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

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
        default:
          throw new Error(
            `Unsupported file type: ${mimeType || 'unknown'}` +
              (filename ? ` (filename=${filename})` : ''),
          );
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Unsupported file type')) throw e;
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
      default:
        return mimeType;
    }
  }

  private async fromPdf(buffer: Buffer): Promise<string> {
    const pdfParse = getPdfParse();
    const result = await pdfParse(buffer);
    return result.text || '';
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
}
