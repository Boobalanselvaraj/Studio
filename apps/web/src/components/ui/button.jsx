import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({ className, variant = 'primary', size = 'md', children, ...props }) {
  const base = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:pointer-events-none disabled:opacity-50 rounded';
  
  const variants = {
    primary: 'bg-brand-primary text-brand-primary-foreground hover:opacity-90 shadow-sm',
    secondary: 'bg-surface-2 text-foreground hover:bg-border',
    outline: 'border border-border bg-transparent hover:bg-surface-2 text-foreground',
    ghost: 'hover:bg-surface-2 text-foreground',
    danger: 'bg-status-danger text-white hover:opacity-90',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-11 px-6 text-base',
  };

  return (
    <button
      className={twMerge(clsx(base, variants[variant], sizes[size], className))}
      {...props}
    >
      {children}
    </button>
  );
}
