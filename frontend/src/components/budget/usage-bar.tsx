import { cn } from "@/lib/utils";

/**
 * Horizontal progress bar for "% of budget used". Fills with `color` (e.g. the category's own
 * color), then turns amber at 90% and red past 100%.
 */
export function UsageBar({
  percent,
  label,
  color,
  className,
}: {
  percent: number | null;
  label: string;
  color?: string;
  className?: string;
}) {
  const value = percent ?? 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(value, 100)}
      aria-valuetext={percent === null ? "No budget" : `${value}% used`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          value > 100
            ? "bg-red-500"
            : value >= 90
              ? "bg-amber-500"
              : !color && "bg-sky-500 dark:bg-sky-400",
        )}
        style={{
          width: `${Math.min(value, 100)}%`,
          ...(color && value < 90 && { backgroundColor: color }),
        }}
      />
    </div>
  );
}
