import React from 'react';

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-2 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard({ children, className = '' }) {
  return (
    <div className={`panel p-5 border border-border rounded-xl space-y-3 ${className}`}>
      {children}
    </div>
  );
}

// Pre-built skeleton shapes
export function SkeletonProviderCard() {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-7 w-full rounded-lg" />
        <Skeleton className="h-7 w-full rounded-lg" />
        <Skeleton className="h-7 w-full rounded-lg" />
      </div>
      <div className="flex gap-2 pt-2 border-t border-border">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg ml-auto" />
      </div>
    </SkeletonCard>
  );
}

export function SkeletonCameraCard() {
  return (
    <SkeletonCard>
      <div className="flex justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-7 w-full rounded-lg" />
        <Skeleton className="h-7 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
    </SkeletonCard>
  );
}

export function SkeletonAlbumCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-border bg-surface">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
