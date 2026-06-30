import type { ReactNode } from 'react';
import { ChatStreamProvider } from '@/hooks/chat-stream-context';

export const dynamic = 'force-dynamic';

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <ChatStreamProvider>{children}</ChatStreamProvider>;
}
