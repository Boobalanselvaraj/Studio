import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Badge({ className, variant = 'default', children, ...props }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors';

  const variants = {
    default: 'bg-surface-2 text-foreground border border-border',
    primary: 'bg-brand-primary/15 text-brand-primary',
    success: 'bg-status-success/15 text-status-success',
    warning: 'bg-status-warning/15 text-status-warning',
    danger: 'bg-status-danger/15 text-status-danger',
    info: 'bg-status-info/15 text-status-info',
  };

  return (
    <div className={twMerge(clsx(base, variants[variant], className))} {...props}>
      {children}
    </div>
  );
}
