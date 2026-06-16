'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface ChatLinkProps {
  children: ReactNode;
  className?: string;
  returnTo?: string;
  asButton?: boolean;
}

export function ChatLink({
  children,
  className,
  returnTo = '/chat',
  asButton = false,
}: ChatLinkProps) {
  const { status } = useSession();
  const href =
    status === 'authenticated'
      ? returnTo
      : `/login?callbackUrl=${encodeURIComponent(returnTo)}`;

  if (asButton) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
