import { apiFetch } from './api';
import type { ChatMode } from '@law-ai/shared';

export type Role = 'user' | 'assistant' | 'system';

export interface IMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  /**
   * For assistant messages: which chat mode produced the answer. Drives
   * the small badge above the bubble ("Nhanh" / "Suy nghĩ sâu" /
   * "Tra cứu văn bản"). Set from the SSE `start` event on the wire.
   */
  mode?: ChatMode;
  /**
   * For assistant messages: where the answer came from. `rag` = grounded
   * in uploaded documents (citation possible). `general` = LLM fallback
   * when no document matched (general-knowledge, may be wrong). Used by
   * `MessageBubble` to render a source-of-truth badge.
   */
  answerSource?: 'rag' | 'general' | 'lookup' | 'rag_warning';
  /**
   * Live indicator while a deep-mode agent call is iterating. Set by
   * `onToolCall`, cleared on `onDone`. Rendered as a small inline line
   * above the placeholder bubble ("🔎 Đang tra cứu: rag_search(...)").
   */
  pendingToolCall?: { tool: string; args: Record<string, unknown> };
}

export interface IConversationListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface IConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: IMessage[];
}

export interface ISendMessageResponse {
  conversationId: string;
  userMessage: IMessage;
  assistantMessage: IMessage;
}

export const chatApi = {
  list: () => apiFetch<IConversationListItem[]>('/api/v1/chat/conversations'),
  get: (id: string) => apiFetch<IConversationDetail>(`/api/v1/chat/conversations/${id}`),
  create: (title?: string) =>
    apiFetch<{ id: string; title: string; createdAt: string; updatedAt: string }>(
      '/api/v1/chat/conversations',
      { method: 'POST', body: { title }, anonymous: false },
    ),
  send: (content: string, conversationId?: string) =>
    apiFetch<ISendMessageResponse>('/api/v1/chat/messages', {
      method: 'POST',
      body: { content, conversationId },
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/v1/chat/conversations/${id}`, { method: 'DELETE' }),
};
