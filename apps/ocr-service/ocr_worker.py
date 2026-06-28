import asyncio
import os
import logging
from pathlib import Path
import boto3
from PIL import Image
from bullmq import Worker, Queue
from ocr.tesseract_backend import run_pdf_ocr

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("OCRWorker")

# Walk up and find the .env file to load variables manually in Python
for env_path in [Path(".env"), Path("../.env"), Path("../../.env"), Path("../../../.env")]:
    if env_path.exists():
        logger.info(f"Loading environment variables from {env_path.resolve()}")
        with env_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    # Strip spaces and enclosing quotes
                    os.environ[k.strip()] = v.strip().strip("'\"")
        break

# Environment configurations
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_ENDPOINT = os.getenv("R2_ENDPOINT", "")

if R2_ACCOUNT_ID and not R2_ENDPOINT:
    R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Local temporary directory for processing
TEMP_DIR = Path("temp_files")
TEMP_DIR.mkdir(exist_ok=True)

# Initialize next queue in pipeline (chunk-queue)
chunk_queue = Queue("chunk", {"connection": REDIS_URL})

# Initialize S3 client for Cloudflare R2 conditionally
client_kwargs = {
    'service_name': 's3',
    'aws_access_key_id': R2_ACCESS_KEY_ID,
    'aws_secret_access_key': R2_SECRET_ACCESS_KEY,
    'region_name': 'auto'
}
if R2_ENDPOINT and R2_ENDPOINT.strip():
    client_kwargs['endpoint_url'] = R2_ENDPOINT.strip()

s3_client = boto3.client(**client_kwargs)

async def process_ocr_job(job, job_token):
    data = job.data
    document_id = data.get("documentId")
    version_id = data.get("versionId")
    job_id = data.get("jobId")
    r2_key = data.get("r2Key")
    bucket_name = data.get("bucketName")

    logger.info(f"Received OCR Job: {job.id} for Document: {document_id}, Version: {version_id}")

    if not r2_key or not bucket_name:
        raise ValueError("Missing r2Key or bucketName in job payload.")

    # Determine file type
    filename = r2_key.split('/')[-1]
    ext = os.path.splitext(filename.lower())[-1]
    is_pdf = ext == ".pdf"
    is_image = ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif", ".webp"]

    local_path = TEMP_DIR / f"{version_id}{ext}"
    pdf_path_temp = None

    try:
        # 1. Download file from Cloudflare R2
        logger.info(f"Downloading {r2_key} from bucket {bucket_name} to {local_path}...")
        s3_client.download_file(bucket_name, r2_key, str(local_path))

        # 2. Run OCR processing
        logger.info(f"Running OCR on file {local_path}...")
        if is_pdf:
            text = run_pdf_ocr(local_path)
        elif is_image:
            # Convert image to RGB PDF using Pillow
            img = Image.open(local_path)
            rgb_img = img.convert('RGB')
            pdf_path_temp = TEMP_DIR / f"{version_id}_temp.pdf"
            rgb_img.save(pdf_path_temp, 'PDF')
            img.close()

            text = run_pdf_ocr(pdf_path_temp)
        else:
            raise ValueError(f"Unsupported file format for OCR: {ext}")

        if not text or not text.strip():
            raise ValueError("OCR process returned empty text.")

        # 3. Enqueue result to chunk-queue
        logger.info(f"OCR successful (length: {len(text)}). Enqueuing to chunk-queue...")
        await chunk_queue.add("chunk", {
            "documentId": document_id,
            "versionId": version_id,
            "jobId": job_id,
            "text": text
        })

        return {"success": True, "textLength": len(text)}

    except Exception as e:
        logger.error(f"OCR failed for Job {job.id}: {str(e)}")
        raise e

    finally:
        # Cleanup temporary files
        if local_path.exists():
            try:
                local_path.unlink()
            except Exception as e:
                logger.warn(f"Failed to delete temp file {local_path}: {e}")
        if pdf_path_temp and pdf_path_temp.exists():
            try:
                pdf_path_temp.unlink()
            except Exception as e:
                logger.warn(f"Failed to delete temp PDF file {pdf_path_temp}: {e}")

async def main():
    logger.info("Initializing Python OCR Worker...")
    # Initialize BullMQ Worker for queue 'ocr'
    worker = Worker("ocr", process_ocr_job, {"connection": REDIS_URL})
    logger.info("Python OCR Worker is listening to 'ocr' queue...")
    
    try:
        await worker.run()
    except asyncio.CancelledError:
        logger.info("OCR Worker task cancelled.")
    finally:
        await chunk_queue.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("OCR Worker stopped by user.")
