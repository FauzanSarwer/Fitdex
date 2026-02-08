import * as React from "react";
import { cn } from "@/lib/utils";

function SkeletonBase({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-white/10", className)}
      {...props}
    />
  );
}

const Skeleton = React.memo(SkeletonBase);
Skeleton.displayName = "Skeleton";

export { Skeleton };
