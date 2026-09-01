import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--color-border)]/60 dark:bg-[var(--color-surface-2)]/80 ${className}`}
      {...props}
    />
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-20 h-3" />
          </div>
        </div>
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
      <Skeleton className="w-full h-12 rounded-xl" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="w-24 h-4" />
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="w-28 h-4" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <Skeleton className="w-20 h-8" />
      <Skeleton className="w-36 h-3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <Skeleton className="w-40 h-5" />
        <Skeleton className="w-24 h-8 rounded-lg" />
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="p-4 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <Skeleton
                key={cIdx}
                className={`h-4 ${
                  cIdx === 0
                    ? "w-1/4"
                    : cIdx === cols - 1
                    ? "w-20"
                    : "flex-1 hidden sm:block"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="w-36 h-4" />
          <Skeleton className="w-24 h-3" />
        </div>
      </div>
      <Skeleton className="w-16 h-7 rounded-lg" />
    </div>
  );
}
