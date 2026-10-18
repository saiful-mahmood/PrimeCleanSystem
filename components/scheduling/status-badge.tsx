import { cn } from "@/lib/utils";
import { statusMeta, type JobStatus } from "@/lib/scheduling/shared";

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        meta.color,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
