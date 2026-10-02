import { cn } from "@/lib/utils";
import { PRIORITY_META, type PriorityLevel } from "@/lib/priority";

export function PriorityDot({ level, className }: { level: PriorityLevel; className?: string }) {
  const meta = PRIORITY_META[level];
  return (
    <span
      role="img"
      aria-label={meta.label}
      title={meta.label}
      className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", meta.dot, className)}
    />
  );
}
