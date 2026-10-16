import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/loader";

/** Loading skeleton for the POS screen: product grid + cart panel. */
export default function Loading() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]" role="status" aria-busy="true" aria-label="Loading point of sale">
      {/* Menu / products */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="h-fit space-y-4 p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-9 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}
