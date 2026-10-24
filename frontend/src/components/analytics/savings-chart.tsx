"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
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
import type { SavingsPoint } from "@/lib/types";

const SAVED_COLOR = "var(--chart-1)";
// Status "critical": reserved for a bad state, and always paired with the word "Overspent".
const OVERSPENT_COLOR = "#d03b3b";

const SHORT_MONTH = new Intl.DateTimeFormat(process.env.NEXT_PUBLIC_LOCALE || "en-IN", {
  month: "short",
});

function shortMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return SHORT_MONTH.format(new Date(year, mon - 1, 1));
}

type Row = SavingsPoint & { value: number | null };

/** Saved per month (budget - spending) as one series; overspent months go below zero. */
export function SavingsChart({ points }: { points: SavingsPoint[] }) {
  const rows: Row[] = points.map((p) => ({
    ...p,
    value: p.saved === null ? null : Number(p.saved),
  }));
  const values = rows.flatMap((r) => (r.value === null ? [] : [r.value]));
  const hasNegative = values.some((v) => v < 0);
  // Round ticks for the usual all-positive case; let Recharts pick when there are losses.
  const ticks = hasNegative ? undefined : niceTicks(Math.max(0, ...values));

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey="month"
              tickFormatter={shortMonth}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_STROKE }}
            />
            <YAxis
              ticks={ticks}
              domain={ticks ? [0, ticks.at(-1) ?? 0] : ["auto", "auto"]}
              tickFormatter={formatMoneyCompact}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            {hasNegative && <ReferenceLine y={0} stroke="var(--muted-foreground)" />}
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
                if (!row) return null;
                const soFar = row.status === "in_progress" ? " (so far)" : "";
                return (
                  <TooltipBox
                    title={`${formatMonth(row.month)}${soFar}`}
                    rows={
                      row.value === null
                        ? [
                            { label: "Budget", value: "Not set" },
                            { label: "Spent", value: formatMoney(row.spent) },
                          ]
                        : [
                            {
                              label: row.value < 0 ? "Overspent" : "Saved",
                              value: formatMoney(Math.abs(row.value)),
                              color: row.value < 0 ? OVERSPENT_COLOR : SAVED_COLOR,
                            },
                            { label: "Budget", value: formatMoney(row.budget ?? 0) },
                            { label: "Spent", value: formatMoney(row.spent) },
                          ]
                    }
                  />
                );
              }}
            />
            <Bar
              dataKey="value"
              maxBarSize={24} // Rounded at the data end, square at zero; Recharts flips this for negative bars.
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell
                  key={row.month}
                  fill={(row.value ?? 0) < 0 ? OVERSPENT_COLOR : SAVED_COLOR}
                  // This month isn't over, so its bar is drawn lighter ("so far").
                  fillOpacity={row.status === "complete" ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <TableView caption="Savings per month">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">Month</th>
            <th className="py-1 text-right font-medium">Budget</th>
            <th className="py-1 text-right font-medium">Spent</th>
            <th className="py-1 text-right font-medium">Saved</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {points.map((p) => (
            <tr key={p.month}>
              <td className="py-1">
                {formatMonth(p.month)}
                {p.status === "in_progress" && " (so far)"}
              </td>
              <td className="py-1 text-right">{p.budget ? formatMoney(p.budget) : "Not set"}</td>
              <td className="py-1 text-right">{formatMoney(p.spent)}</td>
              <td className="py-1 text-right">
                {p.saved === null
                  ? "—"
                  : Number(p.saved) < 0
                    ? `Overspent ${formatMoney(Math.abs(Number(p.saved)))}`
                    : formatMoney(p.saved)}
                {p.savings_rate !== null && ` (${p.savings_rate}%)`}
              </td>
            </tr>
          ))}
        </tbody>
      </TableView>
    </div>
  );
}
