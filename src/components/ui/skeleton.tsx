import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function CourseGridSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((level) => (
        <div key={level}>
          <Skeleton className="h-12 w-full rounded-lg mb-2" />
          <div className="grid gap-2 pl-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaperGridSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((year) => (
        <div key={year} className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <div className="flex gap-3 mt-2">
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
