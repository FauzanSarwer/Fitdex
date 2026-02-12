
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — loading placeholder for async UI.
 *
 * Usage: <Skeleton className="h-8 w-32" />
 */
function SkeletonBase({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-white/10", className)}
      role="status"
      aria-label="Loading"
      tabIndex={0}
      {...props}
    />
  );
}

const Skeleton = React.memo(SkeletonBase);
Skeleton.displayName = "Skeleton";

export { Skeleton };
