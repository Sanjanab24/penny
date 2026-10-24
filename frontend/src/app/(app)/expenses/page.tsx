"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { CategorySwatch } from "@/components/category-icon";
import { DeleteExpenseDialog } from "@/components/expenses/delete-expense-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { InlineExpenseRow } from "@/components/expenses/inline-expense-row";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { formatMonth, monthRange, useCurrentMonth } from "@/lib/month";
import { useCategories, useExpenses } from "@/lib/queries";
import type { Category, Expense, ExpenseSort } from "@/lib/types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const ALL = "all";

const SORT_LABELS: Record<ExpenseSort, string> = {
  date_desc: "Newest first",
  date_asc: "Oldest first",
  amount_desc: "Highest amount",
  amount_asc: "Lowest amount",
};

type Filters = { q: string; category: string; from: string; to: string; sort: ExpenseSort };

/** Opens on the current month; older expenses show once the date range is widened. */
function defaultFilters(month: string): Filters {
  const { from, to } = monthRange(month);
  return { q: "", category: ALL, from, to, sort: "date_desc" };
}

export default function ExpensesPage() {
  const month = useCurrentMonth();
  if (!month) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  return <ExpensesView month={month} />;
}

function ExpensesView({ month }: { month: string }) {
  const initialFilters = defaultFilters(month);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  // Open state is kept apart from the target so dialogs keep their content while closing.
  const [formOpen, setFormOpen] = useState(false);
  // Expenses are edited in place in the table; the dialog is only for adding.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const openForm = () => setFormOpen(true);
  const openDelete = (expense: Expense) => {
    setDeleting(expense);
    setDeleteOpen(true);
  };

  const q = useDebouncedValue(filters.q.trim());
  const categories = useCategories();
  const expenses = useExpenses({
    page,
    page_size: PAGE_SIZE,
    sort: filters.sort,
    q: q || undefined,
    category_id: filters.category === ALL ? undefined : Number(filters.category),
    date_from: filters.from || undefined,
    date_to: filters.to || undefined,
  });

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );

  // Any filter change starts again from page 1.
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const hasFilters =
    filters.q !== "" ||
    filters.category !== ALL ||
    filters.from !== initialFilters.from ||
    filters.to !== initialFilters.to;
  const showingCurrentMonth =
    filters.from === initialFilters.from && filters.to === initialFilters.to;

  const data = expenses.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const dateRangeInvalid = filters.from !== "" && filters.to !== "" && filters.from > filters.to;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ReceiptTextIcon}
        title="Expenses"
        description={
          data
            ? `${showingCurrentMonth ? `${formatMonth(month)} · ` : ""}${data.total} ${data.total === 1 ? "expense" : "expenses"} · ${formatMoney(data.total_amount)} total`
            : " "
        }
        actions={
          <Button onClick={() => openForm()} disabled={!categories.data}>
            <PlusIcon /> Add expense
          </Button>
        }
      />

      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search descriptions"
              placeholder="Search descriptions"
              className="pl-8"
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
            />
          </div>
          <Select value={filters.category} onValueChange={(v) => updateFilter("category", v)}>
            <SelectTrigger aria-label="Filter by category" className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.data?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sort}
            onValueChange={(v) => updateFilter("sort", v as ExpenseSort)}
          >
            <SelectTrigger aria-label="Sort" className="w-full lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            aria-label="From date"
            className="lg:w-36"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => updateFilter("from", e.target.value)}
          />
          <Input
            type="date"
            aria-label="To date"
            className="lg:w-36"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => updateFilter("to", e.target.value)}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(initialFilters);
              setPage(1);
            }}
            disabled={!hasFilters}
          >
            <XIcon /> Clear
          </Button>
        </CardContent>
      </Card>

      {dateRangeInvalid ? (
        <Message>The &quot;from&quot; date must be on or before the &quot;to&quot; date.</Message>
      ) : expenses.isError ? (
        <Message>
          Couldn&apos;t load expenses: {expenses.error.message}{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => expenses.refetch()}>
            Try again
          </Button>
        </Message>
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Message>
          {hasFilters ? (
            "No expenses match these filters."
          ) : (
            <>
              No expenses in {formatMonth(month)} yet. Change the dates above to see past months, or{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => openForm()}>
                add one
              </Button>
              .
            </>
          )}
        </Message>
      ) : (
        <Card size="sm" className={cn("py-0", expenses.isPlaceholderData && "opacity-60")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-20 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((expense) =>
                expense.id === editingId && categories.data ? (
                  <InlineExpenseRow
                    key={expense.id}
                    expense={expense}
                    categories={categories.data}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    category={categoryById.get(expense.category_id)}
                    onEdit={() => setEditingId(expense.id)}
                    onDelete={() => openDelete(expense)}
                  />
                ),
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && pageCount > 1 && !dateRangeInvalid && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
          >
            <ChevronLeftIcon /> Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pageCount || expenses.isPlaceholderData}
          >
            Next <ChevronRightIcon />
          </Button>
        </nav>
      )}

      {categories.data && (
        <ExpenseFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          categories={categories.data}
        />
      )}
      <DeleteExpenseDialog expense={deleting} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function ExpenseRow({
  expense,
  category,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  category?: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
        {formatDate(expense.date)}
      </TableCell>
      <TableCell className="max-w-64 truncate">
        {expense.recurring_id !== null && (
          <RepeatIcon
            className="mr-1.5 inline size-3.5 text-muted-foreground"
            aria-label="Recurring payment"
          />
        )}
        {expense.description || <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        {category && (
          <span className="flex items-center gap-2">
            <CategorySwatch icon={category.icon} color={category.color} className="size-6" />
            <span className="hidden sm:inline">{category.name}</span>
          </span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatMoney(expense.amount)}
      </TableCell>
      <TableCell className="pr-4">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit expense" onClick={onEdit}>
            <PencilIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete expense" onClick={onDelete}>
            <Trash2Icon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="py-6 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
