"use client";

import { useState } from "react";
import { toast } from "sonner";

import { CategorySwatch } from "@/components/category-icon";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { useDeleteCategory } from "@/lib/queries";
import type { Category } from "@/lib/types";

type Props = {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
};

export function DeleteCategoryDialog({ category, open, onOpenChange, categories }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {/* Keyed so the reassign choice resets for each category. */}
        {category && (
          <DeleteCategoryForm
            key={category.id}
            category={category}
            categories={categories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteCategoryForm({
  category,
  categories,
  onDone,
}: {
  category: Category;
  categories: Category[];
  onDone: () => void;
}) {
  const remove = useDeleteCategory();
  // Expenses are known up front; recurring items and budgets are reported by the server (409).
  const [usedElsewhere, setUsedElsewhere] = useState(false);
  const [target, setTarget] = useState("");
  const needsTarget = category.expense_count > 0 || usedElsewhere;
  const targets = categories.filter((c) => c.id !== category.id);

  const onConfirm = () =>
    remove.mutate(
      { id: category.id, reassignTo: needsTarget ? Number(target) : undefined },
      {
        onSuccess: () => {
          toast.success(`Deleted "${category.name}"`);
          onDone();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === "category_in_use") {
            setUsedElsewhere(true);
          } else {
            toast.error(error.message);
          }
        },
      },
    );

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete &quot;{category.name}&quot;?</AlertDialogTitle>
        <AlertDialogDescription>
          {category.expense_count > 0
            ? `${category.expense_count} ${category.expense_count === 1 ? "expense uses" : "expenses use"} this category. Choose where to move ${category.expense_count === 1 ? "it" : "them"}.`
            : usedElsewhere
              ? "Recurring expenses or budgets use this category. Choose where to move them."
              : "This can't be undone."}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {needsTarget && (
        <div className="grid gap-1.5">
          <Label htmlFor="reassign-target">Move to</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="reassign-target" className="w-full">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <CategorySwatch icon={c.icon} color={c.color} className="size-5 [&_svg]:size-3" />
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={remove.isPending || (needsTarget && !target)}
        >
          {remove.isPending ? "Deleting…" : needsTarget ? "Move and delete" : "Delete"}
        </Button>
      </AlertDialogFooter>
    </>
  );
}
