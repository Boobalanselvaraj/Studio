import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={twMerge(
        clsx(
          'flex h-10 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50',
          className
        )
      )}
      {...props}
    />
  );
}
