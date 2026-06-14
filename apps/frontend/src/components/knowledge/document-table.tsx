'use client';

import { Trash2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { formatBytes, formatDateTime } from '@/lib/rag-admin';
import type { IRagDocument } from '@/types/rag';

interface DocumentTableProps {
  docs: IRagDocument[];
  onDeleteClick: (doc: IRagDocument) => void;
}

export function DocumentTable({ docs, onDeleteClick }: DocumentTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-outline-variant/20 text-left text-xs uppercase tracking-wider text-brand-on-surface-variant">
            <th className="py-2 pr-4 font-medium">Tên</th>
            <th className="py-2 pr-4 font-medium">Loại</th>
            <th className="py-2 pr-4 font-medium">Dung lượng</th>
            <th className="py-2 pr-4 font-medium">Chunks</th>
            <th className="py-2 pr-4 font-medium">Trạng thái</th>
            <th className="py-2 pr-4 font-medium">Ngày tạo</th>
            <th className="py-2 text-right font-medium">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr
              key={d.id}
              className="border-b border-brand-outline-variant/10 transition-colors last:border-0 hover:bg-white/[0.03]"
            >
              <td className="py-3 pr-4 align-top">
                <p className="font-medium text-brand-on-surface">
                  {d.name}
                </p>
                {d.error && (
                  <p
                    className="mt-0.5 truncate text-xs text-red-300"
                    title={d.error}
                  >
                    {d.error}
                  </p>
                )}
              </td>

              <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                {shortMime(d.mimeType)}
              </td>
              <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                {formatBytes(d.sizeBytes)}
              </td>
              <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                {d.chunkCount}
              </td>
              <td className="py-3 pr-4 align-top">
                <StatusBadge status={d.status} />
              </td>
              <td className="py-3 pr-4 align-top text-brand-on-surface-variant">
                {formatDateTime(d.createdAt)}
              </td>
              <td className="py-3 text-right align-top">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteClick(d)}
                  className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Xoá</span>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shortMime(mime: string): string {
  if (!mime) return '—';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('wordprocessingml')) return 'DOCX';
  if (mime === 'application/msword') return 'DOC';
  if (mime === 'text/markdown') return 'MD';
  if (mime === 'text/plain') return 'TXT';
  const slash = mime.indexOf('/');
  return slash > 0 ? mime.slice(slash + 1).toUpperCase() : mime.toUpperCase();
}
