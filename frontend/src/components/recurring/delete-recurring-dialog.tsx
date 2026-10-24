"use client";

import { toast } from "sonner";

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
import { useDeleteRecurring } from "@/lib/queries";
import type { RecurringPayment } from "@/lib/types";

export function DeleteRecurringDialog({
  item,
  open,
  onOpenChange,
}: {
  item: RecurringPayment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const remove = useDeleteRecurring();

  const onConfirm = () => {
    if (!item) return;
    remove.mutate(item.id, {
      onSuccess: () => {
        toast.success(`${item.description} deleted`);
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {item?.description ?? "this payment"}?</AlertDialogTitle>
          <AlertDialogDescription>
            No more charges will be added. Expenses it already created stay in your history. To stop
            it temporarily, turn it off instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction, so the dialog stays open while deleting. */}
          <Button variant="destructive" onClick={onConfirm} disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
