'use client';

import { cn } from '@/lib/utils';
import type { IMessage } from '@/lib/chat';
import { Bot, User } from 'lucide-react';

interface MessageBubbleProps {
  message: IMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div
      className={cn(
        'group w-full',
        isUser ? 'bg-transparent' : 'bg-brand-surface-container-high/50 border-y border-brand-outline-variant/5',
      )}
    >
      <div className="mx-auto flex max-w-3xl gap-3 px-4 py-6 md:px-6">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
            isUser
              ? 'bg-brand-primary-container text-brand-on-primary-container'
              : 'bg-gradient-to-br from-brand-primary to-brand-tertiary text-white',
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-xs font-semibold text-brand-on-surface">
            {isUser ? 'You' : 'LAW AI'}
          </div>
          <div
            className={cn(
              'prose prose-invert max-w-none text-[15px] leading-7 text-brand-on-surface',
              '[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2',
              '[&_strong]:font-semibold [&_strong]:text-brand-tertiary',
              '[&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
            )}
          >
            {renderContent(message.content)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal markdown renderer — handles **bold**, `code`, line breaks.
 * Good enough for an MVP; swap for react-markdown later.
 */
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold + code
    const parts: (string | JSX.Element)[] = [];
    let remaining = line;
    let key = 0;
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = re.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('**')) {
        parts.push(<strong key={`b-${i}-${key++}`}>{token.slice(2, -2)}</strong>);
      } else {
        parts.push(<code key={`c-${i}-${key++}`}>{token.slice(1, -1)}</code>);
      }
      lastIndex = re.lastIndex;
    }
    if (lastIndex < remaining.length) {
      parts.push(remaining.slice(lastIndex));
    }
    return (
      <p key={i} className={i === 0 ? 'mt-0' : ''}>
        {parts.length ? parts : ' '}
      </p>
    );
  });
}
