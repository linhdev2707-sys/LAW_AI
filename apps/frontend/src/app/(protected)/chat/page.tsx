'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ChatShell } from '@/components/chat/chat-shell';
import { EmptyState } from '@/components/chat/empty-state';

export default function ChatIndexPage() {
  const router = useRouter();

  // On mount, if there are existing conversations, jump to the most recent one.
  // Otherwise show the empty state in place (user can click a suggestion to start).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/conversations`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        const list = json?.data as Array<{ id: string }> | undefined;
        if (cancelled) return;
        if (list && list.length > 0) {
          router.replace(`/chat/${list[0]!.id}`);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <ChatShell>
      <EmptyState />
    </ChatShell>
  );
}
