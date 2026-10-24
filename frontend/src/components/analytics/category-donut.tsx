"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Swatch, TableView, TooltipBox } from "@/components/analytics/chart-parts";
import { formatMoney } from "@/lib/format";
import type { CategorySpend } from "@/lib/types";

// Past this many slices the smallest fold into one "Others" slice to keep the donut readable.
const MAX_SLICES = 7;
const OTHERS_COLOR = "#94a3b8";

type Slice = { key: string; name: string; color: string; amount: number; percent: number };

function toSlices(categories: CategorySpend[]): Slice[] {
  const slices = categories.map((c) => ({
    key: String(c.category_id),
    name: c.name,
    color: c.color,
    amount: Number(c.amount),
    percent: Number(c.percent),
  }));
  if (slices.length <= MAX_SLICES) return slices;
  const rest = slices.slice(MAX_SLICES - 1);
  return [
    ...slices.slice(0, MAX_SLICES - 1),
    {
      key: "others",
      name: `Others (${rest.length})`,
      color: OTHERS_COLOR,
      amount: rest.reduce((sum, s) => sum + s.amount, 0),
      percent: Math.round(rest.reduce((sum, s) => sum + s.percent, 0) * 10) / 10,
    },
  ];
}

/** Share of the month's spending per category, in each category's own color. */
export function CategoryDonut({
  categories,
  total,
}: {
  categories: CategorySpend[];
  total: string;
}) {
  const slices = toSlices(categories);

  return (
    <div>
      <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-60">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="amount"
                nameKey="name"
                innerRadius="64%"
                outerRadius="96%"
                startAngle={90}
                endAngle={-270}
                // A 2px surface-colored edge is the gap between touching slices.
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.key} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const slice = active ? (payload?.[0]?.payload as Slice | undefined) : undefined;
                  if (!slice) return null;
                  return (
                    <TooltipBox
                      title={slice.name}
                      rows={[
                        { label: "Spent", value: formatMoney(slice.amount), color: slice.color },
                        { label: "Share", value: `${slice.percent.toFixed(1)}%` },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-semibold">{formatMoney(total)}</span>
          </div>
        </div>

        {/* Legend: always present, names and values in text colors beside a swatch. */}
        <ul className="space-y-2 text-sm">
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2">
              <Swatch color={slice.color} />
              <span className="min-w-0 flex-1 truncate">{slice.name}</span>
              <span className="font-medium tabular-nums">{formatMoney(slice.amount)}</span>
              <span className="w-12 text-right text-muted-foreground tabular-nums">
                {slice.percent.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <TableView caption="Spending by category">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Category</th>
            <th className="py-1 text-right font-medium">Spent</th>
            <th className="py-1 text-right font-medium">Share</th>
            <th className="py-1 text-right font-medium">Expenses</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {categories.map((c) => (
            <tr key={c.category_id}>
              <td className="py-1">{c.name}</td>
              <td className="py-1 text-right">{formatMoney(c.amount)}</td>
              <td className="py-1 text-right">{c.percent}%</td>
              <td className="py-1 text-right">{c.expense_count}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}
