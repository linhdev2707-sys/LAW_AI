import type { ReactNode } from 'react';
import { ChatStreamProvider } from '@/hooks/chat-stream-context';

/**
 * Shared layout for `/chat` and `/chat/[id]`.
 *
 * Mounts the ChatStreamProvider so the SSE connection + optimistic
 * messages survive client-side navigation between the two routes.
 * Without this, sending the first message on `/chat` would cause a
 * `router.replace('/chat/<id>')` that unmounts the original hook
 * instance, dropping the in-flight stream and optimistic UI.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatStreamProvider>{children}</ChatStreamProvider>;
}
