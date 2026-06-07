'use client';

import { MaterialIcon } from './material-icon';

export function NewsletterForm() {
  return (
    <form
      className="mt-2 flex overflow-hidden rounded-full border border-brand-outline-variant/30 bg-brand-surface-container focus-within:border-brand-tertiary/60"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder="Email address"
        className="w-full bg-transparent px-5 py-3 text-sm text-brand-on-surface placeholder:text-brand-on-surface-variant/60 focus:outline-none"
        aria-label="Email address"
      />
      <button
        type="submit"
        className="flex items-center justify-center bg-brand-primary/15 px-5 py-3 text-brand-on-surface transition-colors hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-tertiary hover:text-white"
        aria-label="Subscribe"
      >
        <MaterialIcon name="send" className="text-[20px]" />
      </button>
    </form>
  );
}
