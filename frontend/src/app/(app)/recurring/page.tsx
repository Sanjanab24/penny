"use client";

import { useMemo, useState } from "react";
import { PencilIcon, PlusIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { CategorySwatch } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import { DeleteRecurringDialog } from "@/components/recurring/delete-recurring-dialog";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatMoney } from "@/lib/format";
import { useCategories, useRecurring, useSaveRecurring } from "@/lib/queries";
import { ordinal } from "@/lib/recurring";
import type { Category, RecurringPayment } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function RecurringPage() {
  const recurring = useRecurring();
  const categories = useCategories();
  // Open state is kept apart from the target so dialogs keep their content while closing.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringPayment>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<RecurringPayment | null>(null);

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const openForm = (item?: RecurringPayment) => {
    setEditing(item);
    setFormOpen(true);
  };

  const data = recurring.data;
  const activeCount = data?.items.filter((i) => i.active).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={RepeatIcon}
        title="Recurring payments"
        description="Autopays like rent, Netflix or Spotify. Each is added as an expense on its billing day."
        actions={
          <Button onClick={() => openForm()} disabled={!categories.data}>
            <PlusIcon /> Add recurring
          </Button>
        }
      />

      {recurring.isError ? (
        <Message>
          Couldn&apos;t load recurring payments: {recurring.error.message}{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => recurring.refetch()}>
            Try again
          </Button>
        </Message>
      ) : !data || !categories.data ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <RepeatIcon className="size-8 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">No recurring payments yet</p>
              <p className="text-sm text-muted-foreground">
                Add subscriptions and bills that charge you every month.
              </p>
            </div>
            <Button onClick={() => openForm()}>
              <PlusIcon /> Add your first one
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card size="sm">
            <CardContent className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Committed every month</span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatMoney(data.monthly_total)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {activeCount} active of {data.total}
                </span>
              </span>
            </CardContent>
          </Card>
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={item.id}>
                <RecurringRow
                  item={item}
                  category={categoryById.get(item.category_id)}
                  onEdit={() => openForm(item)}
                  onDelete={() => {
                    setDeleting(item);
                    setDeleteOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {categories.data && (
        <RecurringFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          item={editing}
          categories={categories.data}
        />
      )}
      <DeleteRecurringDialog item={deleting} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

function RecurringRow({
  item,
  category,
  onEdit,
  onDelete,
}: {
  item: RecurringPayment;
  category?: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const save = useSaveRecurring();
  const toggle = (active: boolean) =>
    save.mutate(
      { id: item.id, input: { active } },
      {
        onSuccess: () =>
          toast.success(active ? `${item.description} turned on` : `${item.description} paused`),
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <Card size="sm" className={cn(!item.active && "opacity-70")}>
      <CardContent className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        {category && <CategorySwatch icon={category.icon} color={category.color} />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-medium">
            {item.description}
            {!item.active && <Badge variant="secondary">Paused</Badge>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {category?.name} · {ordinal(item.day_of_month)} of every month
            {item.next_charge_date && ` · Next ${formatDate(item.next_charge_date)}`}
          </p>
        </div>
        <span className="font-semibold tabular-nums">{formatMoney(item.amount)}</span>
        <div className="flex items-center gap-1">
          <Switch
            checked={item.active}
            onCheckedChange={toggle}
            disabled={save.isPending}
            aria-label={`${item.description} ${item.active ? "on" : "off"}`}
            className="mr-2"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${item.description}`}
            onClick={onEdit}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${item.description}`}
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
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
