import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small spinning indicator. Use inside buttons or next to controls to show an
 * action is in flight. Defaults to the current text colour so it adapts to the
 * button variant it sits in.
 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />;
}

/**
 * Shimmering placeholder block used to assemble skeleton screens while a page's
 * server data is loading.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/**
 * Centered spinner that fills its container. Handy as a quick, generic loading
 * state when a tailored skeleton isn't worth the effort.
 */
export function Loader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
