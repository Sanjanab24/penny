import type { ReactNode } from "react";

/** Hover tooltip shell. Text uses text tokens; a colored swatch beside it carries identity. */
export function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      <dl className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {row.color && <Swatch color={row.color} />}
              {row.label}
            </dt>
            <dd className="font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export type TooltipRow = { label: string; value: string; color?: string };

export function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={className ?? "inline-block size-2.5 shrink-0 rounded-full"}
      style={{ backgroundColor: color }}
    />
  );
}

/** Accessible fallback: the same numbers as a table, collapsed by default. */
export function TableView({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">
        View as table
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}

/** Axis/grid styling shared by the cartesian charts: recessive hairlines, muted ticks. */
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
export const GRID_STROKE = "var(--border)";

/**
 * Round axis ticks from 0 to just above `max`, stepping by 1, 2, 2.5 or 5 x 10^n
 * (e.g. max 24,990 -> 0, 10K, 20K, 30K), so the axis reads in clean numbers.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const ticks = [];
  for (let value = 0; value < max + step; value += step) ticks.push(value);
  return ticks;
}
