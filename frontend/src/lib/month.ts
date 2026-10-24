"use client";

import { useSyncExternalStore } from "react";

/** Months are "YYYY-MM" strings everywhere, matching the backend. */

const pad = (n: number) => String(n).padStart(2, "0");

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** shiftMonth("2026-01", -1) === "2025-12" */
export function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  return currentMonth(new Date(year, mon - 1 + delta, 1));
}

/** First and last day of the month as YYYY-MM-DD, e.g. 2026-02 -> 02-01 .. 02-28. */
export function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` };
}

const monthLabel = new Intl.DateTimeFormat(process.env.NEXT_PUBLIC_LOCALE || "en-IN", {
  month: "long",
  year: "numeric",
});

export function formatMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return monthLabel.format(new Date(year, mon - 1, 1));
}

const noopSubscribe = () => () => {};

/**
 * The browser's current month, or null while prerendering. Pages are prerendered at build
 * time, so reading the clock during render would bake in the build date; render a skeleton
 * until this returns a value.
 */
export function useCurrentMonth(): string | null {
  return useSyncExternalStore(noopSubscribe, currentMonth, () => null);
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True for a well-formed "YYYY-MM", e.g. from a URL parameter. */
export function isMonth(value: string | null | undefined): value is string {
  return !!value && MONTH_PATTERN.test(value);
}

const monthNameFormat = new Intl.DateTimeFormat(process.env.NEXT_PUBLIC_LOCALE || "en-IN", {
  month: "long",
});

/** "2026-11" -> "November" */
export function formatMonthName(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return monthNameFormat.format(new Date(year, mon - 1, 1));
}

function todayISO() {
  const now = new Date();
  return `${currentMonth(now)}-${pad(now.getDate())}`;
}

/** The browser's date as "YYYY-MM-DD", or null while prerendering (see useCurrentMonth). */
export function useTodayISO(): string | null {
  return useSyncExternalStore(noopSubscribe, todayISO, () => null);
}

/** Days after `isoDate` until its month ends: 0 on the last day. */
export function daysLeftInMonth(isoDate: string) {
  const [year, mon, day] = isoDate.split("-").map(Number);
  return new Date(year, mon, 0).getDate() - day;
}
