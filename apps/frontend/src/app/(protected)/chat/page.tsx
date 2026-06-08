'use client';

import { useState } from 'react';
import { ChatShell } from '@/components/chat/chat-shell';
import { EmptyState } from '@/components/chat/empty-state';
import { chatApi } from '@/lib/chat';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * The chat index page intentionally does NOT auto-redirect to the most
 * recent conversation. It always renders the empty state, so the user
 * lands in a calm, predictable place after login and can pick a
 * conversation from the sidebar — or start a new one by clicking a
 * suggestion.
 */
export default function ChatIndexPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleSelect(prompt: string) {
    if (creating) return;
    setCreating(true);
    try {
      const conv = await chatApi.create();
      router.push(`/chat/${conv.id}?q=${encodeURIComponent(prompt)}`);
    } catch (err) {
      toast.error('Không thể tạo cuộc trò chuyện', {
        description: err instanceof Error ? err.message : 'Vui lòng thử lại',
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <ChatShell>
      <EmptyState onSelect={handleSelect} />
    </ChatShell>
  );
}
