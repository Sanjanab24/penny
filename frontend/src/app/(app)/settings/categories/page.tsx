"use client";

import { useState } from "react";
import { LockIcon, PencilIcon, PlusIcon, TagsIcon, Trash2Icon } from "lucide-react";

import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { DeleteCategoryDialog } from "@/components/categories/delete-category-dialog";
import { CategorySwatch } from "@/components/category-icon";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/lib/queries";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const categories = useCategories();
  // Open state is kept apart from the target so dialogs keep their content while closing.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const openForm = (category?: Category) => {
    setEditing(category);
    setFormOpen(true);
  };

  const custom = categories.data?.filter((c) => !c.is_default) ?? [];
  const defaults = categories.data?.filter((c) => c.is_default) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TagsIcon}
        title="Categories"
        description="Use the defaults or add your own to group expenses."
        actions={
          <Button onClick={() => openForm()}>
            <PlusIcon /> New category
          </Button>
        }
      />

      {categories.isError ? (
        <Card size="sm">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Couldn&apos;t load categories: {categories.error.message}{" "}
            <Button variant="link" className="h-auto p-0" onClick={() => categories.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !categories.data ? (
        <CategoryGridSkeleton />
      ) : (
        <>
          <section aria-labelledby="custom-heading" className="space-y-3">
            <h2 id="custom-heading" className="text-sm font-medium text-muted-foreground">
              Your categories
            </h2>
            {custom.length === 0 ? (
              <Card size="sm">
                <CardContent className="py-4 text-center text-sm text-muted-foreground">
                  You haven&apos;t added any yet.{" "}
                  <Button variant="link" className="h-auto p-0" onClick={() => openForm()}>
                    Create one
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <CategoryGrid>
                {custom.map((category) => (
                  <CategoryCard key={category.id} category={category}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => openForm(category)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => {
                        setDeleting(category);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </CategoryCard>
                ))}
              </CategoryGrid>
            )}
          </section>

          <section aria-labelledby="default-heading" className="space-y-3">
            <h2 id="default-heading" className="text-sm font-medium text-muted-foreground">
              Default categories
            </h2>
            <CategoryGrid>
              {defaults.map((category) => (
                <CategoryCard key={category.id} category={category}>
                  <LockIcon
                    className="mr-1.5 size-3.5 text-muted-foreground"
                    aria-label="Built-in, can't be changed"
                  />
                </CategoryCard>
              ))}
            </CategoryGrid>
          </section>
        </>
      )}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editing} />
      <DeleteCategoryDialog
        category={deleting}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        categories={categories.data ?? []}
      />
    </div>
  );
}

function CategoryGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}

function CategoryCard({ category, children }: { category: Category; children: React.ReactNode }) {
  return (
    <li>
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          <CategorySwatch icon={category.icon} color={category.color} className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{category.name}</p>
            <p className="text-xs text-muted-foreground">
              {category.expense_count} {category.expense_count === 1 ? "expense" : "expenses"}
            </p>
          </div>
          <div className="flex items-center gap-1">{children}</div>
        </CardContent>
      </Card>
    </li>
  );
}

function CategoryGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
