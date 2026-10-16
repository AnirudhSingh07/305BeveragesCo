import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";

/**
 * Generic loading skeleton shown while any page in the app segment fetches its
 * server data (navigation between pages, filter/date-range changes, etc.).
 * Mirrors the common "header + KPI row + content card" shape used across the
 * dashboard, orders, menu, expenses and analytics screens. POS and the order
 * detail page have their own tailored skeletons.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      {/* Header: title + actions */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      {/* KPI / summary row */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </Card>
        ))}
      </div>

      {/* Content card (table / list placeholder) */}
      <Card className="space-y-4 p-5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-32 sm:block" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
