"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CategorySelect } from "@/components/category-select";
import { FormField } from "@/components/form-field";
import { MONEY_PATTERN, MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { currentMonth } from "@/lib/month";
import { useSaveRecurring } from "@/lib/queries";
import { ordinal } from "@/lib/recurring";
import type { Category, RecurringPayment } from "@/lib/types";

const schema = z.object({
  description: z.string().trim().min(1, "Give it a name, e.g. Netflix").max(255, "Too long"),
  amount: z
    .string()
    .trim()
    .regex(MONEY_PATTERN, "Enter an amount like 649 or 119.50")
    .refine((value) => Number(value) > 0, "Amount must be more than 0"),
  category_id: z.string().min(1, "Pick a category"),
  day_of_month: z.string(),
  active: z.boolean(),
  charge_current_month: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Payment to edit; omit to add a new one. */
  item?: RecurringPayment;
  categories: Category[];
};

export function RecurringFormDialog({ open, onOpenChange, item, categories }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit recurring payment" : "Add recurring payment"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Changes apply to future charges. Past expenses stay as they are."
              : "A monthly autopay such as rent, Netflix or Spotify. It's added as an expense on its billing day."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts from fresh defaults. */}
        <RecurringForm item={item} categories={categories} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RecurringForm({
  item,
  categories,
  onDone,
}: {
  item?: RecurringPayment;
  categories: Category[];
  onDone: () => void;
}) {
  const save = useSaveRecurring();
  // The form only mounts in the browser (inside an open dialog), so reading the clock is safe.
  const today = new Date();
  const subscriptions = categories.find((c) => c.is_default && c.name === "Subscriptions");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: item?.description ?? "",
      amount: item?.amount ?? "",
      category_id: String(item?.category_id ?? subscriptions?.id ?? ""),
      day_of_month: String(item?.day_of_month ?? today.getDate()),
      active: item?.active ?? true,
      charge_current_month: true,
    },
  });

  // For a new payment whose billing day already passed this month, offer to record that charge.
  const day = Number(useWatch({ control, name: "day_of_month" }));
  const active = useWatch({ control, name: "active" });
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const thisMonthCharge = new Date(today.getFullYear(), today.getMonth(), Math.min(day, lastDay));
  const missedThisMonth = !item && active && thisMonthCharge.getDate() < today.getDate();

  const onSubmit = (values: FormValues) => {
    const input = {
      description: values.description,
      amount: values.amount,
      category_id: Number(values.category_id),
      day_of_month: Number(values.day_of_month),
      active: values.active,
      ...(!item && { charge_current_month: missedThisMonth && values.charge_current_month }),
    };
    save.mutate(
      { id: item?.id, input },
      {
        onSuccess: () => {
          toast.success(item ? "Recurring payment updated" : `${values.description} added`);
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <FormField label="Name" htmlFor="description" error={errors.description?.message}>
        <Input
          id="description"
          placeholder="e.g. Netflix"
          autoFocus
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
          {...register("description")}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount per month" htmlFor="amount" error={errors.amount?.message}>
          <MoneyInput
            id="amount"
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? "amount-error" : undefined}
            {...register("amount")}
          />
        </FormField>
        <FormField label="Billing day" htmlFor="day_of_month">
          <Controller
            control={control}
            name="day_of_month"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="day_of_month" className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {ordinal(d)} of every month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>
      {day > 28 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          In months without a {ordinal(day)}, it&apos;s charged on the last day instead.
        </p>
      )}
      <FormField label="Category" htmlFor="category" error={errors.category_id?.message}>
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <CategorySelect
              id="category"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              categories={categories}
              invalid={!!errors.category_id}
            />
          )}
        />
      </FormField>

      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="active" className="flex flex-col items-start gap-0.5">
              <span>Active</span>
              <span className="text-xs font-normal text-muted-foreground">
                Turn off to pause charges without deleting it.
              </span>
            </Label>
            <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
          </div>
        )}
      />

      {missedThisMonth && (
        <Controller
          control={control}
          name="charge_current_month"
          render={({ field }) => (
            <div className="flex items-start gap-2">
              <Checkbox
                id="charge_current_month"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="charge_current_month" className="font-normal leading-snug">
                It was already charged on{" "}
                {formatDate(
                  `${currentMonth(today)}-${String(thisMonthCharge.getDate()).padStart(2, "0")}`,
                )}
                . Add this month&apos;s payment as an expense too.
              </Label>
            </div>
          )}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : item ? "Save changes" : "Add payment"}
        </Button>
      </DialogFooter>
    </form>
  );
}
