import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "accent" | "warning" | "destructive";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "accent" && "text-accent",
              tone === "warning" && "text-amber-500",
              tone === "destructive" && "text-destructive",
              tone === "default" && "text-muted-foreground"
            )}
          />
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tnum">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
