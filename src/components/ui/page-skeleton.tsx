/**
 * Generic page-level skeleton shown while any route loader is pending.
 * Used as the router's defaultPendingComponent so undecorated routes
 * never show a blank screen.
 */
import { Skeleton } from "./skeleton";

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-8 space-y-6 animate-pulse">
      {/* Simulated page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      {/* Simulated table / card rows */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
