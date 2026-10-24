"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategorySwatch } from "@/components/category-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/types";

// Not a real category id: picking it opens the "new category" dialog instead.
const CREATE = "__create__";

/**
 * Category dropdown with each category's icon and color. `value` is the id as a string.
 * Ends with "+ Create category", so users never have to leave the form to add one.
 */
export function CategorySelect({
  id,
  value,
  onChange,
  onBlur,
  categories,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  categories: Category[];
  invalid?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  // Shown straight away, before the refreshed category list arrives from the server.
  const [created, setCreated] = useState<Category[]>([]);
  const options = [...categories, ...created.filter((c) => !categories.some((x) => x.id === c.id))];

  return (
    <>
      <Select
        value={value}
        onValueChange={(next) => (next === CREATE ? setCreating(true) : onChange(next))}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onBlur={onBlur}
        >
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          {options.map((category) => (
            <SelectItem key={category.id} value={String(category.id)}>
              <CategorySwatch
                icon={category.icon}
                color={category.color}
                className="size-5 [&_svg]:size-3"
              />
              {category.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CREATE} className="font-medium text-primary">
            <PlusIcon className="text-primary" /> Create category
          </SelectItem>
        </SelectContent>
      </Select>
      <CategoryFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(category) => {
          setCreated((current) => [...current, category]);
          onChange(String(category.id));
        }}
      />
    </>
  );
}
