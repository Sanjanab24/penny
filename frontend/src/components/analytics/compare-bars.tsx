"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  AXIS_TICK,
  GRID_STROKE,
  niceTicks,
  Swatch,
  TableView,
  TooltipBox,
} from "@/components/analytics/chart-parts";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { formatMonth } from "@/lib/month";
import type { MonthComparison } from "@/lib/types";

const MAX_CATEGORIES = 8;
const ROW_HEIGHT = 44;
// Fixed series slots: this month is always blue, the previous month always orange.
const CURRENT_COLOR = "var(--chart-1)";
const PREVIOUS_COLOR = "var(--chart-2)";

type Row = { name: string; current: number; previous: number };

/** This month vs the previous one, per category, as paired horizontal bars. */
export function CompareBars({ comparison }: { comparison: MonthComparison }) {
  const rows: Row[] = comparison.categories.slice(0, MAX_CATEGORIES).map((c) => ({
    name: c.name,
    current: Number(c.current),
    previous: Number(c.previous),
  }));
  const currentLabel = formatMonth(comparison.month);
  const previousLabel = formatMonth(comparison.previous_month);
  const hidden = comparison.categories.length - rows.length;
  const ticks = niceTicks(Math.max(...rows.flatMap((r) => [r.current, r.previous])));

  return (
    <div>
      {/* Legend above the plot: two series, so identity never relies on color alone. */}
      <ul className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Swatch color={CURRENT_COLOR} className="inline-block h-2.5 w-4 rounded-sm" />
          {currentLabel}
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch color={PREVIOUS_COLOR} className="inline-block h-2.5 w-4 rounded-sm" />
          {previousLabel}
        </li>
      </ul>
      <div className="w-full" style={{ height: rows.length * ROW_HEIGHT + 32 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="22%"
          >
            <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
            <XAxis
              type="number"
              ticks={ticks}
              domain={[0, ticks.at(-1) ?? 0]}
              tickFormatter={formatMoneyCompact}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              width={104}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                const change = row.current - row.previous;
                return (
                  <TooltipBox
                    title={row.name}
                    rows={[
                      {
                        label: currentLabel,
                        value: formatMoney(row.current),
                        color: CURRENT_COLOR,
                      },
                      {
                        label: previousLabel,
                        value: formatMoney(row.previous),
                        color: PREVIOUS_COLOR,
                      },
                      {
                        label: "Change",
                        value: `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatMoney(Math.abs(change))}`,
                      },
                    ]}
                  />
                );
              }}
            />
            {/* Thin bars with a 4px rounded end, square at the baseline. */}
            <Bar
              dataKey="current"
              name={currentLabel}
              fill={CURRENT_COLOR}
              barSize={12}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="previous"
              name={previousLabel}
              fill={PREVIOUS_COLOR}
              barSize={12}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hidden > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Showing the top {rows.length} categories; {hidden} more in the table.
        </p>
      )}

      <TableView caption={`${currentLabel} compared with ${previousLabel}`}>
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Category</th>
            <th className="py-1 text-right font-medium">{currentLabel}</th>
            <th className="py-1 text-right font-medium">{previousLabel}</th>
            <th className="py-1 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {comparison.categories.map((c) => (
            <tr key={c.category_id}>
              <td className="py-1">{c.name}</td>
              <td className="py-1 text-right">{formatMoney(c.current)}</td>
              <td className="py-1 text-right">{formatMoney(c.previous)}</td>
              <td className="py-1 text-right">
                {Number(c.change) > 0 ? "+" : ""}
                {formatMoney(c.change)}
              </td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}
