import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ className, children, ...props }) {
  return (
    <div
      className={twMerge(clsx('bg-surface text-foreground rounded-lg border border-border p-6 shadow-sm', className))}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return <div className={twMerge(clsx('flex flex-col space-y-1.5 mb-4', className))} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }) {
  return <h3 className={twMerge(clsx('text-lg font-semibold leading-none tracking-tight', className))} {...props}>{children}</h3>;
}

export function CardDescription({ className, children, ...props }) {
  return <p className={twMerge(clsx('text-sm text-muted', className))} {...props}>{children}</p>;
}

export function CardContent({ className, children, ...props }) {
  return <div className={twMerge(clsx('', className))} {...props}>{children}</div>;
}
