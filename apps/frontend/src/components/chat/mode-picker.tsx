'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Brain, BookOpen, Zap, Check } from 'lucide-react';
import { CHAT_MODES, CHAT_MODE_LABELS, type ChatMode } from '@law-ai/shared';
import { cn } from '@/lib/utils';

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

/**
 * Mode picker dropdown. Replaces the (disabled) paperclip attachment
 * button in the chat input. Shows the current mode as a label + icon,
 * and opens a Radix DropdownMenu with the three options on click.
 *
 * Keyboard: Tab to focus, Enter/Space to open, ↑/↓ to navigate, Enter
 * to select, Esc to close — all handled by Radix.
 */
export function ModePicker({ value, onChange, disabled }: ModePickerProps) {
  const CurrentIcon = ICONS[value];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Chọn chế độ chat: ${CHAT_MODE_LABELS[value].label}`}
          title={`Chế độ: ${CHAT_MODE_LABELS[value].label} — ${CHAT_MODE_LABELS[value].description}`}
          className={cn(
            'ml-2 mb-2 flex h-9 w-9 items-center justify-center rounded-lg',
            'text-brand-on-surface-variant transition-colors',
            'hover:bg-white/5 hover:text-brand-tertiary',
            'data-[state=open]:bg-white/5 data-[state=open]:text-brand-tertiary',
            'disabled:opacity-50 disabled:hover:bg-transparent',
            // No focus ring on the trigger after a click — selecting an
            // option would otherwise leave a visible halo around the
            // button while the user is composing the next message.
            // Keyboard users still get a visible state via the open
            // background (data-[state=open]).
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
            return (
              <DropdownMenu.Item
                key={m}
                onSelect={() => onChange(m)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5',
                  'text-sm outline-none transition-colors',
                  'data-[highlighted]:bg-white/5',
                  'focus:bg-white/5',
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-tertiary" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-brand-on-surface">
                      {CHAT_MODE_LABELS[m].label}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-brand-tertiary" />
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-brand-on-surface-variant">
                    {CHAT_MODE_LABELS[m].description}
                  </div>
                </div>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}