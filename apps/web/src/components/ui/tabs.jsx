import React, { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Tabs({ defaultValue, className, children }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  return (
    <div className={twMerge(clsx('w-full', className))}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { activeTab, setActiveTab });
      })}
    </div>
  );
}

export function TabsList({ className, children, activeTab, setActiveTab }) {
  return (
    <div className={twMerge(clsx('inline-flex h-10 items-center justify-center rounded bg-surface-2 p-1 text-muted', className))}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { activeTab, setActiveTab });
      })}
    </div>
  );
}

export function TabsTrigger({ value, activeTab, setActiveTab, className, children }) {
  const isActive = activeTab === value;
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          isActive ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
          className
        )
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, activeTab, className, children }) {
  if (activeTab !== value) return null;
  return <div className={twMerge(clsx('mt-4 focus-visible:outline-none', className))}>{children}</div>;
}
