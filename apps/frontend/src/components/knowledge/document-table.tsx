'use client';

import { Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { formatBytes, formatDateTime } from '@/lib/rag-admin';
import type { IRagDocument } from '@/types/rag';

interface DocumentTableProps {
  docs: IRagDocument[];
  /** Currently-selected doc ids (controlled). Empty set = nothing selected. */
  selectedIds: Set<string>;
  /** Toggle a single row. */
  onToggleSelected: (id: string) => void;
  /**
   * Select/deselect every row currently in `docs`. The table calls this
   * with either all ids (to select) or [] (to deselect); the parent
   * owns the actual state.
   */
  onToggleAll: (ids: string[]) => void;
  onDeleteClick: (doc: IRagDocument) => void;
  onSyncClick?: (doc: IRagDocument) => void;
}

export function DocumentTable({
  docs,
  selectedIds,
  onToggleSelected,
  onToggleAll,
  onDeleteClick,
  onSyncClick,
}: DocumentTableProps) {
  // "All selected" = every row in the current view is in the selection
  // set. We intentionally don't care about ids outside `docs` — those
  // are stale (deleted or filtered out) and shouldn't affect the
  // header checkbox state.
  const allIds = docs.map((d) => d.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-outline-variant/20 text-left text-xs uppercase tracking-wider text-brand-on-surface-variant">
            <th className="w-10 py-2 pr-2 font-medium">
              <input
                type="checkbox"
                aria-label="Chọn tất cả tài liệu"
                checked={allSelected}
                // `aria-checked="mixed"` lets screen readers announce the
                // indeterminate state when only some rows are selected.
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={(e) => onToggleAll(e.target.checked ? allIds : [])}
                className="h-4 w-4 cursor-pointer rounded border-brand-outline-variant/40 bg-white/5 text-brand-primary accent-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:ring-offset-0"
              />
            </th>
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
          {docs.map((d) => {
            const isSelected = selectedIds.has(d.id);
            return (
              <tr
                key={d.id}
                className={`border-b border-brand-outline-variant/10 transition-colors last:border-0 hover:bg-white/[0.03] ${
                  isSelected ? 'bg-brand-tertiary/[0.06]' : ''
                }`}
              >
                <td className="py-3 pr-2 align-top">
                  <input
                    type="checkbox"
                    aria-label={`Chọn tài liệu ${d.name}`}
                    checked={isSelected}
                    onChange={() => onToggleSelected(d.id)}
                    className="h-4 w-4 cursor-pointer rounded border-brand-outline-variant/40 bg-white/5 text-brand-primary accent-brand-primary focus:ring-2 focus:ring-brand-primary/30 focus:ring-offset-0"
                  />
                </td>
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
                   <div className="flex items-center justify-end gap-1">
                     {onSyncClick && (d.status === 'pending' || d.status === 'failed') && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => onSyncClick(d)}
                         className="text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary-variant"
                       >
                         <RefreshCw className="h-4 w-4 mr-1" />
                         Đồng bộ
                       </Button>
                     )}
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => onDeleteClick(d)}
                       className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                     >
                       <Trash2 className="h-4 w-4" />
                       <span className="sr-only">Xoá</span>
                     </Button>
                   </div>
                 </td>
              </tr>
            );
          })}
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