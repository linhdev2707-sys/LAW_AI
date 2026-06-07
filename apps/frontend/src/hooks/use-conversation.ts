'use client';

import { useCallback, useState } from 'react';
import { chatApi, type IConversationDetail, type IMessage } from '@/lib/chat';

export function useConversation(initialId?: string) {
  const [conversation, setConversation] = useState<IConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const conv = await chatApi.get(id);
        setConversation(conv);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Send a message and optimistically append the user + assistant replies. */
  const send = useCallback(
    async (content: string) => {
      if (!conversation) {
        // Should not happen — caller is expected to load first.
        setError('No conversation loaded');
        return null;
      }
      setSending(true);
      setError(null);
      // Optimistic user message
      const optimisticUser: IMessage = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      setConversation((prev) =>
        prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
      );

      try {
        const res = await chatApi.send(content, conversation.id);
        // Replace optimistic + append assistant
        setConversation((prev) => {
          if (!prev) return prev;
          const withoutOptimistic = prev.messages.filter((m) => m.id !== optimisticUser.id);
          return {
            ...prev,
            messages: [...withoutOptimistic, res.userMessage, res.assistantMessage],
            title: prev.title === 'New chat' || !prev.title ? content.slice(0, 60) : prev.title,
          };
        });
        return res;
      } catch (e: any) {
        setError(e?.message ?? 'Failed to send');
        // Roll back optimistic user message
        setConversation((prev) =>
          prev
            ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticUser.id) }
            : prev,
        );
        return null;
      } finally {
        setSending(false);
      }
    },
    [conversation],
  );

  return { conversation, loading, sending, error, load, send, setConversation };
}
