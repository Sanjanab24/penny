"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS_TICK,
  GRID_STROKE,
  niceTicks,
  TableView,
  TooltipBox,
} from "@/components/analytics/chart-parts";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { formatMonth } from "@/lib/month";
import type { TrendPoint } from "@/lib/types";

const SHORT_MONTH = new Intl.DateTimeFormat(process.env.NEXT_PUBLIC_LOCALE || "en-IN", {
  month: "short",
});

function shortMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return SHORT_MONTH.format(new Date(year, mon - 1, 1));
}

type Row = { month: string; total: number; budget: number | null };

/** Monthly spending as one line (single series: the card title names it, so no legend). */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const rows: Row[] = points.map((p) => ({
    month: p.month,
    total: Number(p.total),
    budget: p.budget === null ? null : Number(p.budget),
  }));
  const ticks = niceTicks(Math.max(...rows.map((r) => r.total)));

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="month"
              tickFormatter={shortMonth}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
              padding={{ left: 16, right: 16 }}
            />
            <YAxis
              ticks={ticks}
              domain={[0, ticks.at(-1) ?? 0]}
              tickFormatter={formatMoneyCompact}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                return (
                  <TooltipBox
                    title={formatMonth(row.month)}
                    rows={[
                      { label: "Spent", value: formatMoney(row.total), color: "var(--chart-1)" },
                      {
                        label: "Budget",
                        value: row.budget === null ? "Not set" : formatMoney(row.budget),
                      },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="linear"
              dataKey="total"
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="var(--chart-1)"
              fillOpacity={0.1}
              // Markers carry a 2px surface ring so they stay legible on the line.
              dot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <TableView caption="Spending per month">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Month</th>
            <th className="py-1 text-right font-medium">Spent</th>
            <th className="py-1 text-right font-medium">Budget</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {points.map((p) => (
            <tr key={p.month}>
              <td className="py-1">{formatMonth(p.month)}</td>
              <td className="py-1 text-right">{formatMoney(p.total)}</td>
              <td className="py-1 text-right">{p.budget ? formatMoney(p.budget) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}
