import { cn } from "@/lib/utils";
import { getStatusColor } from "@/lib/statusColors";
import type { Status } from "@/types/booking";

export function StatusBadge({ status }: { status: Status }) {
  const info = getStatusColor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        info.bg,
        info.text,
        info.border,
      )}
    >
      {info.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: "Urgent" | "Normal" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        priority === "Urgent"
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {priority}
    </span>
  );
}
