"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { CategorySelect } from "@/components/category-select";
import { MONEY_PATTERN, MoneyInput, toPaise } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { useSaveExpense } from "@/lib/queries";
import type { Category, Expense } from "@/lib/types";

const MAX_DESCRIPTION = 255;

/**
 * A table row edited in place: date, description, category and amount become inputs.
 * Enter saves, Escape cancels. Only the fields that changed are sent.
 */
export function InlineExpenseRow({
  expense,
  categories,
  onDone,
}: {
  expense: Expense;
  categories: Category[];
  onDone: () => void;
}) {
  const save = useSaveExpense();
  const [date, setDate] = useState(expense.date);
  const [description, setDescription] = useState(expense.description);
  const [categoryId, setCategoryId] = useState(String(expense.category_id));
  const [amount, setAmount] = useState(expense.amount);

  const amountError =
    !MONEY_PATTERN.test(amount) || toPaise(amount) <= 0 ? "Enter an amount above 0" : undefined;
  const dateError = date ? undefined : "Pick a date";
  const invalid = !!amountError || !!dateError || description.trim().length > MAX_DESCRIPTION;

  const submit = () => {
    if (invalid || save.isPending) return;
    save.mutate(
      {
        id: expense.id,
        input: {
          date,
          description: description.trim(),
          category_id: Number(categoryId),
          amount,
        },
      },
      {
        onSuccess: () => {
          toast.success("Expense updated");
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  // Enter saves and Escape cancels from any input in the row (not while a dropdown is open:
  // the category select handles its own keys).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onDone();
    } else if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <TableRow className="bg-primary/5 hover:bg-primary/5" onKeyDown={onKeyDown}>
      <TableCell className="pl-4">
        <Input
          type="date"
          aria-label="Date"
          className="h-8 w-36"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!dateError}
          autoFocus
        />
      </TableCell>
      <TableCell>
        <Input
          aria-label="Description"
          className="h-8 min-w-40"
          placeholder="Optional"
          maxLength={MAX_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </TableCell>
      <TableCell className="min-w-44">
        <CategorySelect
          id={`expense-${expense.id}-category`}
          value={categoryId}
          onChange={setCategoryId}
          categories={categories}
        />
      </TableCell>
      <TableCell>
        <MoneyInput
          aria-label="Amount"
          className="h-8 w-32 text-right"
          value={amount}
          onChange={(e) => setAmount(e.target.value.trim())}
          aria-invalid={!!amountError}
          title={amountError}
        />
      </TableCell>
      <TableCell className="pr-4">
        <div className="flex justify-end gap-1">
          <Button
            size="icon-sm"
            aria-label="Save changes"
            title="Save (Enter)"
            onClick={submit}
            disabled={invalid || save.isPending}
          >
            <CheckIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Cancel editing"
            title="Cancel (Esc)"
            onClick={onDone}
            disabled={save.isPending}
          >
            <XIcon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
