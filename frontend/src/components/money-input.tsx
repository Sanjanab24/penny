import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Text input for an amount, with the currency symbol (₹) shown inside on the left. */
export function MoneyInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >
        {CURRENCY_SYMBOL}
      </span>
      <Input inputMode="decimal" placeholder="0.00" className={cn("pl-7", className)} {...props} />
    </div>
  );
}

/** A plain decimal with up to 2 places and no separators, e.g. "1500" or "249.50". */
export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Amount string -> integer paise, so sums are exact (0.1 + 0.2 style float errors avoided). */
export function toPaise(value: string | undefined) {
  if (!value || !MONEY_PATTERN.test(value)) return 0;
  return Math.round(Number(value) * 100);
}

export function fromPaise(paise: number) {
  return (paise / 100).toFixed(2);
}
