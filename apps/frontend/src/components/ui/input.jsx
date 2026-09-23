import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Common custom-branded Input component.
 * Adopts custom brand colors for focus rings, hover borders, and selection carats.
 */
export const Input = forwardRef(function Input(
  {
    className,
    type = 'text',
    error,
    disabled = false,
    ...props
  },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      className={twMerge(
        clsx(
          'ui-common-input flex h-10 w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-foreground transition-all duration-150 ease-in-out placeholder:text-muted',
          'hover:border-[var(--brand-primary-border,#3b82f673)]',
          'focus:border-[var(--brand-primary,#3b82f6)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary-focus,rgba(59,130,246,0.22))]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-2',
          error && 'border-status-danger focus:border-status-danger focus:ring-status-danger/20',
          className
        )
      )}
      style={{
        caretColor: 'var(--brand-primary)',
        accentColor: 'var(--brand-primary)',
      }}
      {...props}
    />
  );
});

export default Input;
