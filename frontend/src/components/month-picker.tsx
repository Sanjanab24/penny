"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMonth, shiftMonth } from "@/lib/month";

type Props = {
  month: string;
  onChange: (month: string) => void;
  /** The real current month; shows a "This month" shortcut when viewing another one. */
  current: string;
};

export function MonthPicker({ month, onChange, current }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
        {formatMonth(month)}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRightIcon />
      </Button>
      {month !== current && (
        <Button variant="ghost" size="sm" onClick={() => onChange(current)}>
          This month
        </Button>
      )}
    </div>
  );
}
