import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Tone of a stat's icon chip. Each one means the same thing everywhere: rose = money out,
 * emerald = saved / good, amber = committed (recurring), sky = what's left, violet = neutral info.
 * Written out in full so Tailwind keeps the classes.
 */
const TONES = {
  rose: "bg-rose-500/12 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  sky: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  violet: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  red: "bg-red-500/12 text-red-600 dark:bg-red-400/15 dark:text-red-300",
} as const;

export type StatTone = keyof typeof TONES;

/** A labelled number with a colored icon chip; the value itself stays in the text color. */
export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  tone: StatTone;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("h-full", className)}>
      <CardContent className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
            TONES[tone],
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="truncate text-xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
