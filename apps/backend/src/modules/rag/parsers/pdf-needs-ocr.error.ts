/**
 * Thrown by DocumentParserService when a PDF upload has no recoverable
 * text layer (neither pdf-parse nor the raw BT/ET walker returned enough
 * text) AND we believe the file is a genuine scan that should go through
 * the OCR worker.
 *
 * `hasImages` distinguishes "scan-only" (likely OCR-able) from
 * "blank / metadata-only" (no content at all). The controller uses this
 * flag to decide whether to enqueue the file into the OCR pipeline
 * (`hasImages === true`) or surface a clear 400 (`hasImages === false`).
 *
 * Keeping this in a dedicated file (rather than tacking it onto
 * document-parser.service.ts) lets the controller do an `instanceof`
 * check without a circular import.
 */
export class PdfNeedsOcrError extends Error {
  constructor(public readonly hasImages: boolean) {
    super('PDF requires OCR (no text layer detected)');
    this.name = 'PdfNeedsOcrError';
  }
}
