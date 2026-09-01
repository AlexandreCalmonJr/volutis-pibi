import { useState, useEffect, useRef, type ReactNode } from "react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void> | void;
  pullThreshold?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  pullThreshold = 75,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only initiate pull when at the very top of the page
      if (window.scrollY <= 2) {
        touchStartRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartRef.current;

      if (diff > 0 && window.scrollY <= 2) {
        // Apply friction curve (logarithmic resistance)
        const resistance = Math.min(diff * 0.45, pullThreshold * 1.5);
        setPullDistance(resistance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullDistance >= pullThreshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(pullThreshold * 0.8);
        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            window.location.reload();
          }
        } catch {
          // Fallback
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh, pullThreshold]);

  const progress = Math.min(pullDistance / pullThreshold, 1);

  return (
    <div className="relative">
      {/* Pull indicator spinner */}
      <div
        className="fixed top-2 inset-x-0 z-40 flex justify-center pointer-events-none transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance}px)`,
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
        }}
      >
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl flex items-center justify-center text-violet-600">
          {isRefreshing ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 transition-transform duration-100"
              style={{ transform: `rotate(${progress * 180}deg)` }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
        </div>
      </div>

      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.3}px)` : "none",
          transition: isPullingRef.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
