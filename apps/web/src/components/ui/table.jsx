import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Table({ className, children, ...props }) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={twMerge(clsx('w-full caption-bottom text-sm', className))} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }) {
  return <thead className={twMerge(clsx('[&_tr]:border-b border-border', className))} {...props}>{children}</thead>;
}

export function TableBody({ className, children, ...props }) {
  return <tbody className={twMerge(clsx('[&_tr:last-child]:border-0', className))} {...props}>{children}</tbody>;
}

export function TableRow({ className, children, ...props }) {
  return (
    <tr
      className={twMerge(clsx('border-b border-border transition-colors hover:bg-surface-2 data-[state=selected]:bg-muted', className))}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }) {
  return (
    <th
      className={twMerge(clsx('h-12 px-4 text-left align-middle font-medium text-muted', className))}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }) {
  return (
    <td className={twMerge(clsx('p-4 align-middle [&:has([role=checkbox])]:pr-0', className))} {...props}>
      {children}
    </td>
  );
}
