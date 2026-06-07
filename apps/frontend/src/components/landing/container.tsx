import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-container-max px-margin-mobile md:px-margin-desktop', className)}
      {...props}
    />
  );
}
