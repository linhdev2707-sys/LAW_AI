import os
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ocr.tesseract_backend import run_pdf_ocr
from ocr_fallback import needs_ocr

app = FastAPI(title="LAW_AI OCR Service")

# Cho phép gọi API từ các ứng dụng khác (NestJS, Frontend, v.v.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thư mục chứa các file tạm thời trong quá trình OCR
TEMP_DIR = Path("temp_files")
TEMP_DIR.mkdir(exist_ok=True)

@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    """API nhận tệp PDF hoặc hình ảnh, thực hiện OCR và trả về chuỗi văn bản nhận diện được."""
    filename_lower = file.filename.lower()
    is_pdf = filename_lower.endswith(".pdf")
    is_image = any(filename_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif", ".webp"])

    if not (is_pdf or is_image):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tệp định dạng PDF hoặc hình ảnh (PNG, JPG, JPEG, TIFF, BMP, GIF, WEBP).")

    # Lưu tệp tạm thời lên ổ đĩa
    file_path = TEMP_DIR / file.filename
    pdf_path_temp = None
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        if is_pdf:
            text = run_pdf_ocr(file_path)
        else:
            # Chuyển đổi hình ảnh sang PDF bằng Pillow để tái sử dụng công cụ OCR PDF đã viết
            from PIL import Image
            img = Image.open(file_path)
            # fitz/tesseract hoạt động tốt nhất khi ảnh được chuyển thành RGB
            rgb_img = img.convert('RGB')
            pdf_path_temp = file_path.with_suffix('.pdf_temp')
            rgb_img.save(pdf_path_temp, 'PDF')
            img.close()
            
            text = run_pdf_ocr(pdf_path_temp)
            
        return {
            "success": True,
            "filename": file.filename,
            "text": text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi thực hiện OCR: {str(e)}")
    finally:
        # Xóa các file tạm sau khi xử lý xong
        if file_path.exists():
            file_path.unlink()
        if pdf_path_temp and pdf_path_temp.exists():
            pdf_path_temp.unlink()

@app.post("/check-needs-ocr")
async def check_needs_ocr_endpoint(data: dict):
    """API kiểm tra xem đoạn văn bản trích xuất trực tiếp có cần chạy OCR bổ sung không."""
    text = data.get("text", "")
    required = needs_ocr(text)
    return {"needs_ocr": required}
