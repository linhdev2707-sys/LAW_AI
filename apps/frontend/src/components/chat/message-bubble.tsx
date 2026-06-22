'use client';

import { useState } from 'react';
import {
  Bot,
  User,
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Sparkles,
  Brain,
  Zap,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MODE_LABELS, type ChatMode } from '@law-ai/shared';
import type { IMessage } from '@/lib/chat';
import type { StreamSource } from '@/lib/chat-stream';
import { SourcesRow } from './sources-row';

interface MessageBubbleProps {
  message: IMessage;
  /** RAG sources attached to this assistant message. Ignored for user msgs. */
  sources?: StreamSource[];
  /** True when this is the assistant placeholder still streaming. */
  loading?: boolean;
}

export function MessageBubble({ message, sources, loading }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={cn(
        'group w-full',
        // User: subtle translucent band on the right; AI: full-width band.
        isUser
          ? 'bg-transparent'
          : 'border-y border-brand-outline-variant/5 bg-gradient-to-b from-brand-surface-container-high/40 to-brand-surface-container-high/10',
      )}
    >
      <div
        className={cn(
          'mx-auto grid max-w-3xl grid-cols-[36px_1fr_36px] gap-4 px-4 py-4 md:gap-5 md:px-6 md:py-5',
        )}
      >
        {/* Avatar (col 1) */}
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md',
            isUser
              ? 'order-3 bg-gradient-to-br from-brand-primary-container to-brand-primary text-white'
              : 'order-1 bg-gradient-to-br from-brand-primary to-brand-tertiary text-white shadow-brand-tertiary/20',
          )}
          aria-hidden
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        {/* Body (col 2) */}
        <div
          className={cn(
            'min-w-0',
            isUser ? 'order-2 flex flex-col items-end' : 'order-2',
          )}
        >
          {/* Mode + answer-source badge row — only for AI messages */}
          {!isUser && message.mode && <ModeBadge mode={message.mode} />}

          {/* In-flight tool-call indicator — only visible while a deep-mode
              agent is iterating. Renders above the placeholder content. */}
          {!isUser && loading && message.pendingToolCall && (
            <ToolCallIndicator toolCall={message.pendingToolCall} />
          )}

          {/* Content / bubble */}
          {isUser ? (
            <div
              className={cn(
                'inline-block max-w-[85%] rounded-2xl rounded-tr-md px-5 py-3',
                'bg-gradient-to-br from-brand-primary to-brand-tertiary text-white shadow-md shadow-brand-primary/20',
              )}
            >
              <div className="whitespace-pre-wrap break-words text-[15px] leading-7">
                {message.content}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'prose prose-invert max-w-none px-1 text-[15px] leading-7 text-brand-on-surface',
                '[&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3',
                '[&_strong]:font-semibold [&_strong]:text-brand-tertiary',
                '[&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm',
                '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
                '[&_li]:my-1.5 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base',
              )}
            >
              {renderContent(message.content)}
            </div>
          )}

          {/* Source-of-truth badge — only for AI messages, and only once
              the streaming metadata has arrived. */}
          {!isUser && message.answerSource && (
            <AnswerSourceBadge kind={message.answerSource} />
          )}

          {/* Sources row — only for AI messages */}
          {!isUser && sources && sources.length > 0 && (
            <SourcesRow sources={sources} />
          )}

          {/* Action row — only for AI messages */}
          {!isUser && (
            <div className="flex items-center gap-1 pt-2.5 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <ActionButton onClick={handleCopy} label={copied ? 'Đã sao chép' : 'Sao chép'}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </ActionButton>
              <ActionButton
                onClick={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
                active={feedback === 'up'}
                label="Hữu ích"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton
                onClick={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
                active={feedback === 'down'}
                label="Chưa tốt"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </ActionButton>
            </div>
          )}
        </div>

        {/* Spacer (col 3) — empty cell to keep grid columns balanced */}
        <div aria-hidden className={isUser ? 'order-1' : 'order-3'} />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  label,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
        active
          ? 'bg-brand-tertiary/15 text-brand-tertiary'
          : 'text-brand-on-surface-variant/70 hover:bg-white/5 hover:text-brand-on-surface',
      )}
    >
      {children}
    </button>
  );
}

const MODE_ICON: Record<ChatMode, React.ComponentType<{ className?: string }>> = {
  fast: Zap,
  deep: Brain,
  lookup: BookOpen,
};

const MODE_BADGE_STYLE: Record<ChatMode, string> = {
  fast: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  deep: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
  lookup: 'border-teal-400/30 bg-teal-500/10 text-teal-200',
};

/**
 * Small pill above each assistant bubble indicating which mode was used.
 * Users rely on this to understand the depth/cost of each answer — a
 * "Suy nghĩ sâu" answer is more thorough but took more LLM tokens.
 */
function ModeBadge({ mode }: { mode: ChatMode }) {
  const Icon = MODE_ICON[mode];
  return (
    <div
      className={cn(
        'mb-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        MODE_BADGE_STYLE[mode],
      )}
      title={CHAT_MODE_LABELS[mode].label}
    >
      <Icon className="h-3 w-3" />
      {CHAT_MODE_LABELS[mode].label}
    </div>
  );
}

/**
 * Inline indicator shown above the placeholder while a deep-mode agent
 * call is iterating. Replaced on every new tool_call event.
 */
function ToolCallIndicator({
  toolCall,
}: {
  toolCall: { tool: string; args: Record<string, unknown> };
}) {
  // Render the tool's primary argument if it's a query/text field —
  // gives the user a sense of what the agent is currently searching for.
  const argSnippet =
    typeof toolCall.args.query === 'string'
      ? toolCall.args.query
      : typeof toolCall.args.text === 'string'
        ? toolCall.args.text
        : '';

  return (
    <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/5 px-3 py-1.5 text-[12px] text-violet-200">
      <Wrench className="h-3 w-3 animate-pulse" />
      <span className="font-medium">{toolCall.tool}</span>
      {argSnippet && (
        <>
          <span className="text-violet-300/60">·</span>
          <span className="truncate italic text-violet-200/80">&ldquo;{argSnippet}&rdquo;</span>
        </>
      )}
    </div>
  );
}

/**
 * Tiny pill that tells the user whether the AI's answer came from the
 * uploaded documents (trustworthy, citation present) or from the LLM's
 * general legal knowledge (informative, but may be wrong on specifics).
 *
 * Only renders for assistant messages — the `message.answerSource` is
 * unset for user messages and for assistant messages still streaming.
 */
function AnswerSourceBadge({
  kind,
}: {
  kind: NonNullable<IMessage['answerSource']>;
}) {
  switch (kind) {
    case 'rag':
      return (
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200"
          title="Câu trả lời dựa trên tài liệu đã tải lên, có trích dẫn nguồn."
        >
          <BookOpen className="h-3 w-3" />
          Trả lời từ tài liệu
        </div>
      );
    case 'general':
      return (
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200"
          title="Tài liệu hiện không có thông tin này. Câu trả lời dựa trên kiến thức pháp luật phổ thông của mô hình, có thể chưa chính xác. Vui lòng kiểm chứng."
        >
          <Sparkles className="h-3 w-3" />
          Trả lời tham khảo chung
        </div>
      );
    case 'lookup':
      return (
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/10 px-2.5 py-1 text-[11px] font-medium text-teal-200"
          title="Chế độ tra cứu văn bản — chỉ trả về trích dẫn, không sinh câu trả lời."
        >
          <BookOpen className="h-3 w-3" />
          Trích dẫn văn bản
        </div>
      );
    case 'rag_warning':
      return (
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-400/40 bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-200"
          title="Agent đã đạt giới hạn suy luận. Câu trả lời có thể chưa đầy đủ — hãy thử lại với câu hỏi cụ thể hơn."
        >
          <AlertTriangle className="h-3 w-3" />
          Đã đạt giới hạn suy luận
        </div>
      );
  }
}

/**
 * Minimal markdown renderer — handles **bold**, `code`, line breaks.
 * Good enough for an MVP; swap for react-markdown later.
 */
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
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
        {parts.length ? parts : ' '}
      </p>
    );
  });
}