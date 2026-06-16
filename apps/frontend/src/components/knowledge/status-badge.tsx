import type { RagDocumentStatus } from '@/types/rag';

export function StatusBadge({ status }: { status: RagDocumentStatus }) {
  const styles: Record<RagDocumentStatus, string> = {
    ready: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    pending: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
    ocr_pending: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    failed: 'border-red-400/40 bg-red-500/10 text-red-200',
  };
  const labels: Record<RagDocumentStatus, string> = {
    ready: 'Sẵn sàng',
    pending: 'Đang xử lý',
    ocr_pending: 'Đang OCR',
    failed: 'Lỗi',
  };
  const dotColor: Record<RagDocumentStatus, string> = {
    ready: 'bg-emerald-400',
    pending: 'bg-amber-400',
    ocr_pending: 'bg-sky-400 animate-pulse',
    failed: 'bg-red-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dotColor[status]}`} />
      {labels[status]}
    </span>
  );
}
