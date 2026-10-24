import { CategorySwatch } from "@/components/category-icon";
import { UsageBar } from "@/components/budget/usage-bar";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import type { CategoryUsage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One card per category: allocated, spent, remaining and % utilized. */
export function CategoryUtilization({ categories }: { categories: CategoryUsage[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {categories.map((usage) => (
        <li key={usage.category_id}>
          <UtilizationCard usage={usage} />
        </li>
      ))}
    </ul>
  );
}

function UtilizationCard({ usage }: { usage: CategoryUsage }) {
  const percent = usage.percent_used === null ? null : Number(usage.percent_used);
  const unbudgeted = Number(usage.allocated) === 0;
  const remaining = Number(usage.remaining);

  return (
    // A strip of the category's own color across the top ties the card to its category.
    <Card
      size="sm"
      className="h-full border-t-4 transition-shadow hover:shadow-md"
      style={{ borderTopColor: usage.color }}
    >
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <CategorySwatch icon={usage.icon} color={usage.color} />
            <span className="truncate">{usage.name}</span>
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {unbudgeted ? (
              <span className="text-sm font-normal text-muted-foreground">No budget</span>
            ) : (
              formatMoney(usage.allocated)
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
          <span className="text-rose-600 dark:text-rose-300">
            Spent: {formatMoney(usage.spent)}
          </span>
          {!unbudgeted && (
            <span
              className={cn(
                remaining < 0
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-sky-700 dark:text-sky-300",
              )}
            >
              {remaining < 0
                ? `Over by ${formatMoney(-remaining)}`
                : `Remaining: ${formatMoney(usage.remaining)}`}
            </span>
          )}
        </div>
        <UsageBar
          percent={unbudgeted ? null : percent}
          label={`${usage.name} budget used`}
          color={usage.color}
        />
        <p className="text-xs text-muted-foreground">
          {unbudgeted ? "Spent without a budget this month" : `${percent?.toFixed(1)}% utilized`}
        </p>
      </CardContent>
    </Card>
  );
}
