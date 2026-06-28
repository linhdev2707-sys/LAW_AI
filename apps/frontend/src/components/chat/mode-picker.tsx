'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Brain, BookOpen, Zap, Check, Lock } from 'lucide-react';
import { CHAT_MODES, CHAT_MODE_LABELS, type ChatMode } from '@law-ai/shared';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface ModePickerProps {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

const ICONS: Record<ChatMode, React.ComponentType<{ className?: string }>> = {
  fast: Zap,
  deep: Brain,
  lookup: BookOpen,
};

const DESCRIPTIONS: Record<ChatMode, string> = {
  fast: 'Trò chuyện nhanh, phản hồi tức thì',
  deep: 'Phân tích chuyên sâu với lập luận chi tiết',
  lookup: 'Chỉ hiển thị trích dẫn điều luật, không sinh câu trả lời',
};

/**
 * Mode picker dropdown. Replaces the (disabled) paperclip attachment
 * button in the chat input. Shows the current mode as a label + icon,
 * and opens a Radix DropdownMenu with the three options on click.
 */
export function ModePicker({ value, onChange, disabled }: ModePickerProps) {
  const { data: session } = useSession();
  const plan = session?.user?.subscriptionPlan || 'free';
  const isPaid = ['basic', 'pro', 'premium'].includes(plan);

  const CurrentIcon = ICONS[value];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Chọn chế độ chat: ${CHAT_MODE_LABELS[value].label}`}
          title={`Chế độ: ${CHAT_MODE_LABELS[value].label}`}
          className={cn(
            'ml-2 mb-2 flex h-9 w-9 items-center justify-center rounded-lg',
            'text-brand-on-surface-variant transition-colors',
            'hover:bg-white/5 hover:text-brand-tertiary',
            'data-[state=open]:bg-white/5 data-[state=open]:text-brand-tertiary',
            'disabled:opacity-50 disabled:hover:bg-transparent',
            'focus:outline-none focus-visible:outline-none',
          )}
        >
          <CurrentIcon className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className={cn(
            'z-50 min-w-[280px] rounded-xl border border-white/10',
            'bg-brand-surface p-1 shadow-xl',
            'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
          )}
        >
          {CHAT_MODES.map((m) => {
            const Icon = ICONS[m];
            const isSelected = m === value;
            const isLocked = !isPaid && m !== 'fast';

            return (
              <DropdownMenu.Item
                key={m}
                onSelect={(e) => {
                  if (isLocked) {
                    e.preventDefault(); // Prevent closing menu
                    toast.error(
                      `Chế độ "${CHAT_MODE_LABELS[m].label}" chỉ dành cho tài khoản hội viên. Vui lòng nâng cấp gói cước để sử dụng!`,
                    );
                    return;
                  }
                  onChange(m);
                }}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5',
                  'text-sm outline-none transition-colors',
                  isLocked
                    ? 'opacity-60 hover:bg-white/5'
                    : 'data-[highlighted]:bg-white/5 focus:bg-white/5',
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-tertiary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('font-medium', isLocked ? 'text-brand-on-surface-variant' : 'text-brand-on-surface')}>
                      {CHAT_MODE_LABELS[m].label}
                    </span>
                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5 text-brand-on-surface-variant/40" />
                    ) : isSelected ? (
                      <Check className="h-3.5 w-3.5 text-brand-tertiary" />
                    ) : null}
                  </div>
                  <span className="block text-[11px] text-brand-on-surface-variant/60 mt-0.5 font-normal">
                    {DESCRIPTIONS[m]}
                  </span>
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}