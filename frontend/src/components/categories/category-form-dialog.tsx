"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
  CategoryIcon,
  CategorySwatch,
} from "@/components/category-icon";
import { FormField } from "@/components/form-field";
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
import { Label } from "@/components/ui/label";
import { useSaveCategory } from "@/lib/queries";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(50, "Keep it under 50 characters"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
  icon: z.string().min(1, "Pick an icon"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Category to edit; omit to create one. */
  category?: Category;
  /** Called with the saved category, e.g. so a picker can select one created from inside it. */
  onSaved?: (category: Category) => void;
};

export function CategoryFormDialog({ open, onOpenChange, category, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Choose a name, color and icon.</DialogDescription>
        </DialogHeader>
        <CategoryForm category={category} onSaved={onSaved} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  onSaved,
  onDone,
}: {
  category?: Category;
  onSaved?: (category: Category) => void;
  onDone: () => void;
}) {
  const save = useSaveCategory();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      color: category?.color ?? CATEGORY_COLORS[5],
      icon: category?.icon ?? "tag",
    },
  });
  const [name, color, icon] = useWatch({ control, name: ["name", "color", "icon"] });

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: category?.id, input: values },
      {
        onSuccess: (saved) => {
          toast.success(category ? "Category updated" : `"${saved.name}" created`);
          onSaved?.(saved);
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <form
      // This dialog can open inside another form (e.g. the expense form). React events bubble
      // through portals, so stop the submit here or it would submit that form too.
      onSubmit={(e) => {
        e.stopPropagation();
        void handleSubmit(onSubmit)(e);
      }}
      className="grid gap-4"
      noValidate
    >
      <FormField label="Name" htmlFor="category-name" error={errors.name?.message}>
        <div className="flex items-center gap-2">
          <CategorySwatch icon={icon} color={color} className="size-8" />
          <Input
            id="category-name"
            placeholder="e.g. Pets"
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "category-name-error" : undefined}
            {...register("name")}
          />
        </div>
      </FormField>

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <div className="grid gap-1.5">
            <Label id="color-label">Color</Label>
            <div role="radiogroup" aria-labelledby="color-label" className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  role="radio"
                  aria-checked={field.value === swatch}
                  aria-label={swatch}
                  onClick={() => field.onChange(swatch)}
                  className="flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: swatch }}
                >
                  {field.value === swatch && <CheckIcon className="size-4 text-white" />}
                </button>
              ))}
              <label
                className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground"
                title="Custom color"
              >
                +
                <input
                  type="color"
                  aria-label="Custom color"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </label>
            </div>
          </div>
        )}
      />

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <div className="grid gap-1.5">
            <Label id="icon-label">Icon</Label>
            <div
              role="radiogroup"
              aria-labelledby="icon-label"
              className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto"
            >
              {CATEGORY_ICON_NAMES.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  role="radio"
                  aria-checked={field.value === iconName}
                  aria-label={iconName.replaceAll("-", " ")}
                  onClick={() => field.onChange(iconName)}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    field.value === iconName &&
                      "bg-muted text-foreground ring-1 ring-foreground/20",
                  )}
                >
                  <CategoryIcon icon={iconName} className="size-4" />
                </button>
              ))}
            </div>
          </div>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending || !name.trim()}>
          {save.isPending ? "Saving…" : category ? "Save changes" : "Create category"}
        </Button>
      </DialogFooter>
    </form>
  );
}
