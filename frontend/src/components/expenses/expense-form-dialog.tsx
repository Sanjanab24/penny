"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CategorySelect } from "@/components/category-select";
import { FormField } from "@/components/form-field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/format";
import { useSaveExpense } from "@/lib/queries";
import type { Category, Expense } from "@/lib/types";

// Mirrors the backend: positive, at most 2 decimals, fits NUMERIC(12, 2).
const schema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 250.50")
    .refine((value) => Number(value) > 0, "Amount must be more than 0"),
  date: z.iso.date("Pick a date"),
  category_id: z.string().min(1, "Pick a category"),
  description: z.string().trim().max(255, "Keep it under 255 characters"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expense to edit; omit to add a new one. */
  expense?: Expense;
  categories: Category[];
};

export function ExpenseFormDialog({ open, onOpenChange, expense, categories }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            {expense ? "Update the details of this expense." : "Record something you spent."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each opening starts from fresh defaults. */}
        <ExpenseForm expense={expense} categories={categories} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({
  expense,
  categories,
  onDone,
}: {
  expense?: Expense;
  categories: Category[];
  onDone: () => void;
}) {
  const save = useSaveExpense();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: expense?.amount ?? "",
      date: expense?.date ?? todayISO(),
      category_id: expense ? String(expense.category_id) : "",
      description: expense?.description ?? "",
    },
  });

  const onSubmit = (values: FormOutput) =>
    save.mutate(
      { id: expense?.id, input: { ...values, category_id: Number(values.category_id) } },
      {
        onSuccess: () => {
          toast.success(expense ? "Expense updated" : "Expense added");
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount" htmlFor="amount" error={errors.amount?.message}>
          <MoneyInput
            id="amount"
            autoFocus
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? "amount-error" : undefined}
            {...register("amount")}
          />
        </FormField>
        <FormField label="Date" htmlFor="date" error={errors.date?.message}>
          <Input
            id="date"
            type="date"
            aria-invalid={!!errors.date}
            aria-describedby={errors.date ? "date-error" : undefined}
            {...register("date")}
          />
        </FormField>
      </div>
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
      <FormField label="Description" htmlFor="description" error={errors.description?.message}>
        <Textarea
          id="description"
          rows={2}
          placeholder="Optional, e.g. Lunch with team"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : expense ? "Save changes" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
