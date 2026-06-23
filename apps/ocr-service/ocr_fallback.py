"""Compatibility OCR fallback for scanned/image PDFs.

The heavy EasyOCR backend was replaced by the lighter Tesseract CLI backend.
This module keeps the old public functions for legacy pipeline callers.
"""

from __future__ import annotations

from pathlib import Path

from ocr import OcrOptions, OcrPageError, OcrUnavailableError, run_pdf_ocr

# Trigger OCR when text layer is too sparse or likely garbled.
MIN_USABLE_TEXT_CHARS = 200
# Vietnamese diacritics range: 0x1EA0-0x1EF9 (ư, ơ, ê, ô, etc.)
VIETNAMESE_DIACRITIC_START = 0x1EA0
VIETNAMESE_DIACRITIC_END = 0x1EF9


def _has_vietnamese_chars(text: str) -> bool:
    """Check if text contains Vietnamese diacritic characters."""
    return any(VIETNAMESE_DIACRITIC_START <= ord(c) <= VIETNAMESE_DIACRITIC_END for c in text)


def needs_ocr(text: str) -> bool:
    """Return True if extracted text is too sparse or likely garbled to be a real document body."""
    text = text.strip()
    if len(text) < MIN_USABLE_TEXT_CHARS:
        return True
    # Vietnamese docs have diacritics. If no diacritics and text is short-ish,
    # likely extraction failure (garbled encoding), not a real short doc.
    if not _has_vietnamese_chars(text) and len(text) < 500:
        return True
    return False


def run_ocr(file_path: Path) -> str:
    """Render PDF pages to images, OCR each. Returns concatenated text."""
    try:
        return run_pdf_ocr(file_path, OcrOptions())
    except (OcrUnavailableError, OcrPageError, ValueError):
        return ""
