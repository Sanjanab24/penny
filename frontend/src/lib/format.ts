const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "INR";
// A fixed locale keeps server and browser output identical (no hydration mismatch) and gives
// Indian digit grouping for INR: ₹1,23,456.00.
const LOCALE = process.env.NEXT_PUBLIC_LOCALE || "en-IN";

const moneyFormat = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });

/** e.g. "₹" for INR; used as the prefix on amount inputs. */
export const CURRENCY_SYMBOL =
  moneyFormat.formatToParts(0).find((part) => part.type === "currency")?.value ?? CURRENCY;

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatMoney(amount: string | number) {
  return moneyFormat.format(Number(amount));
}

const compactMoneyFormat = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Short form for chart axes, e.g. ₹1.5K or ₹2L. */
export function formatMoneyCompact(amount: string | number) {
  return compactMoneyFormat.format(Number(amount));
}

/** Formats a YYYY-MM-DD date. Parsed as a local date: `new Date("2026-10-01")` would be UTC. */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}

/** Today's local date as YYYY-MM-DD. Call from event handlers or client-only UI, not render. */
export function todayISO() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
