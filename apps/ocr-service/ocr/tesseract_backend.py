from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import fitz  # PyMuPDF for PDF rendering

from .base import OcrOptions, OcrPageError, OcrUnavailableError

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class OcrPageResult:
    page_number: int
    total_pages: int
    text: str
    dpi: int
    psm: int
    attempts: int
    blank_page: bool = False


@dataclass
class OcrJobResult:
    file_path: Path
    success: bool
    text: str = ""
    error: str = ""
    pages_processed: int = 0


def _resolve_tesseract_path() -> str:
    path = shutil.which("tesseract")
    if path:
        return path
    import os
    default_win_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(default_win_path):
        return default_win_path
    return ""


def run_pdf_ocr(file_path: Path, options: OcrOptions | None = None) -> str:
    return "\n\n".join(page.text.strip() for page in run_pdf_ocr_pages(file_path, options)).strip()


def run_pdf_ocr_pages(file_path: Path, options: OcrOptions | None = None) -> list[OcrPageResult]:
    opts = (options or OcrOptions()).normalized()
    if opts.backend != "tesseract":
        raise ValueError(f"Unsupported OCR backend: {opts.backend}")
    if not _resolve_tesseract_path():
        raise OcrUnavailableError(
            "Tesseract executable not found. Install Tesseract OCR and Vietnamese language data (vie)."
        )
    try:
        doc = fitz.open(str(file_path))
    except Exception as exc:
        raise OcrUnavailableError(f"Failed to open PDF: {exc}")

    pages: list[OcrPageResult] = []

    try:
        total_pages = len(doc)
        page_count = min(total_pages, opts.max_pages) if opts.max_pages else total_pages
        with tempfile.TemporaryDirectory(prefix="exe-ocr-") as tmp_dir:
            tmp_root = Path(tmp_dir)
            for page_index in range(page_count):
                timeout_label = "no timeout" if opts.timeout == 0 else f"timeout={opts.timeout}s"
                logger.info("OCR page %d/%d (%s)", page_index + 1, page_count, timeout_label)
                print(f"    OCR page {page_index + 1}/{page_count} ({timeout_label})", flush=True)
                pages.append(_ocr_page_mupdf(doc[page_index], tmp_root, page_index, page_count, opts))
    finally:
        doc.close()
    return pages


def _ocr_page_mupdf(
    page,
    tmp_root: Path,
    page_index: int,
    total_pages: int | OcrOptions,
    opts: OcrOptions | None = None,
) -> OcrPageResult:
    if opts is None:
        opts = total_pages  # Back-compat
        total_pages = page_index + 1
    assert isinstance(opts, OcrOptions)

    errors: list[str] = []
    attempts = 0
    blank_page = False
    aggressive = opts.aggressive

    try:
        for dpi in _dpi_candidates(opts.dpi, aggressive):
            image_path = tmp_root / f"page-{page_index + 1}-{dpi}dpi.png"
            try:
                blank_page = _render_page_image_mupdf(page, image_path, dpi)
            except Exception as render_err:
                logger.warning("Failed to render page %d at %d DPI: %s", page_index + 1, dpi, render_err)
                errors.append(f"render dpi={dpi}: {render_err}")
                continue

            for psm in _psm_candidates(opts.psm, aggressive):
                attempts += 1
                text, error = _run_tesseract(image_path, page_index, opts, dpi, psm)
                if text.strip():
                    return OcrPageResult(
                        page_number=page_index + 1,
                        total_pages=int(total_pages),
                        text=text,
                        dpi=dpi,
                        psm=psm,
                        attempts=attempts,
                        blank_page=False,
                    )
                errors.append(error or f"dpi={dpi}, psm={psm}: empty text")
            try:
                image_path.unlink()
            except OSError:
                pass

        # All attempts failed - check if blank page
        if blank_page:
            return OcrPageResult(
                page_number=page_index + 1,
                total_pages=int(total_pages),
                text=f"[OCR blank page {page_index + 1}/{int(total_pages)}]",
                dpi=opts.dpi,
                psm=opts.psm,
                attempts=attempts,
                blank_page=True,
            )

        # Return partial text with error marker instead of raising
        return OcrPageResult(
            page_number=page_index + 1,
            total_pages=int(total_pages),
            text=f"[OCR page {page_index + 1}/{int(total_pages)} - extraction failed]",
            dpi=opts.dpi,
            psm=opts.psm,
            attempts=attempts,
            blank_page=False,
        )
    except Exception as page_err:
        logger.error("Page %d error: %s", page_index + 1, page_err)
        # Return error marker instead of raising to continue processing
        return OcrPageResult(
            page_number=page_index + 1,
            total_pages=int(total_pages),
            text=f"[OCR page {page_index + 1}/{int(total_pages)} - error: {str(page_err)[:50]}]",
            dpi=opts.dpi,
            psm=opts.psm,
            attempts=attempts,
            blank_page=False,
        )


def _render_page_image_mupdf(page, image_path: Path, dpi: int) -> bool:
    """Render PDF page to image using PyMuPDF. Returns True if image is blank."""
    try:
        # PyMuPDF: render page at specified DPI
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat)
        pix.save(str(image_path))
        pix = None  # Help GC

        # Check if blank
        from PIL import Image
        img = Image.open(image_path)
        return _is_blank_image(img)
    except Exception as e:
        logger.warning("Failed to render page at %d DPI: %s", dpi, e)
        return False


def _prepare_image(image):
    from PIL import ImageFilter, ImageOps

    image = image.convert("L")
    image = ImageOps.autocontrast(image)
    return image.filter(ImageFilter.SHARPEN)


def _run_tesseract(image_path: Path, page_index: int, opts: OcrOptions, dpi: int, psm: int) -> tuple[str, str]:
    tess_path = _resolve_tesseract_path()
    if not tess_path:
        return "", f"dpi={dpi}, psm={psm}: Tesseract executable not found"
    cmd = [
        tess_path,
        str(image_path),
        "stdout",
        "-l",
        opts.languages,
        "--oem",
        "1",
        "--psm",
        str(psm),
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=opts.timeout or None,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return "", f"dpi={dpi}, psm={psm}: timed out after {opts.timeout}s"
    if proc.returncode != 0:
        return "", f"dpi={dpi}, psm={psm}: {proc.stderr.strip()}"
    return proc.stdout, ""


def _dpi_candidates(primary: int, aggressive: bool = False) -> list[int]:
    """Return DPI values to try. Aggressive mode = only primary."""
    if aggressive:
        return [primary]
    values = [primary, 360, 380, 320, 400, 300]
    seen: set[int] = set()
    return [dpi for dpi in values if 100 <= dpi <= 400 and not (dpi in seen or seen.add(dpi))]


def _psm_candidates(primary: int, aggressive: bool = False) -> list[int]:
    """Return PSM values to try. Aggressive mode = only primary."""
    if aggressive:
        return [primary]
    values = [primary, 3, 6, 4, 11]
    seen: set[int] = set()
    return [psm for psm in values if 3 <= psm <= 13 and not (psm in seen or seen.add(psm))]


def _is_blank_image(image) -> bool:
    histogram = image.histogram()
    total = sum(histogram)
    if total == 0:
        return True
    dark = sum(histogram[:245])
    return dark / total < 0.001


def run_pdf_ocr_batch(
    file_paths: list[Path],
    options: OcrOptions | None = None,
    progress_callback: Callable[[int, int, str], None] | None = None,
) -> list[OcrJobResult]:
    """Batch OCR multiple PDFs in parallel using thread pool.

    Args:
        file_paths: List of PDF paths to OCR
        options: OcrOptions (workers, aggressive, dpi, psm, etc.)
        progress_callback: Optional callback(processed, total, current_file) for progress
    """
    opts = (options or OcrOptions()).normalized()
    workers = opts.workers

    results: list[OcrJobResult] = []

    if workers <= 1:
        # Single-threaded fallback
        for idx, fp in enumerate(file_paths, start=1):
            try:
                text = run_pdf_ocr(fp, options)
                results.append(OcrJobResult(file_path=fp, success=True, text=text, pages_processed=1))
            except Exception as exc:
                results.append(OcrJobResult(file_path=fp, success=False, error=str(exc)))
            if progress_callback:
                progress_callback(idx, len(file_paths), str(fp.name))
        return results

    # Parallel processing with thread pool
    completed = 0
    total = len(file_paths)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(_ocr_single_file, fp, opts): fp for fp in file_paths}

        for future in as_completed(futures):
            fp = futures[future]
            completed += 1
            try:
                result = future.result()
                results.append(result)
            except Exception as exc:
                results.append(OcrJobResult(file_path=fp, success=False, error=str(exc)))
            if progress_callback:
                progress_callback(completed, total, str(fp.name))

    return results


def _ocr_single_file(file_path: Path, opts: OcrOptions) -> OcrJobResult:
    """OCR single PDF file with given options."""
    try:
        pages = run_pdf_ocr_pages(file_path, opts)
        text = "\n\n".join(page.text.strip() for page in pages).strip()
        return OcrJobResult(
            file_path=file_path,
            success=True,
            text=text,
            pages_processed=len(pages),
        )
    except Exception as exc:
        return OcrJobResult(file_path=file_path, success=False, error=str(exc))
