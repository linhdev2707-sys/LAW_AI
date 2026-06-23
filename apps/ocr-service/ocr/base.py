from __future__ import annotations

from dataclasses import dataclass


class OcrUnavailableError(RuntimeError):
    """Raised when the selected OCR backend is not installed or configured."""


class OcrPageError(RuntimeError):
    """Raised when any single page cannot be OCRed completely."""


@dataclass(slots=True)
class OcrOptions:
    backend: str = "tesseract"
    languages: str = "vie+eng"
    dpi: int = 360
    psm: int = 3
    max_pages: int | None = None
    timeout: int = 0
    workers: int = 1  # Parallel workers for batch OCR
    aggressive: bool = False  # True = use only primary DPI/PSM, skip retries for speed

    def normalized(self) -> "OcrOptions":
        return OcrOptions(
            backend=(self.backend or "tesseract").strip().lower(),
            languages=(self.languages or "vie+eng").strip(),
            dpi=max(100, min(int(self.dpi or 360), 400)),
            psm=max(3, min(int(self.psm or 3), 13)),
            max_pages=max(1, int(self.max_pages)) if self.max_pages else None,
            timeout=max(0, int(self.timeout or 0)),
            workers=max(1, int(self.workers or 1)),
            aggressive=bool(self.aggressive),
        )
