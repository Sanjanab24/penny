"use client";

import { useEffect } from "react";

import { useSessionReady } from "@/lib/api";
import { useGenerateRecurring } from "@/lib/queries";

// Once per page load is enough: the server only adds charges that came due since the last run.
let synced = false;

/** Adds this month's due recurring charges as expenses whenever the app is opened. */
export function RecurringSync() {
  const ready = useSessionReady();
  const { mutate } = useGenerateRecurring();

  useEffect(() => {
    if (!ready || synced) return;
    synced = true;
    mutate(undefined, {
      // Not worth interrupting the user over; the next app load retries.
      onError: () => {
        synced = false;
      },
    });
  }, [ready, mutate]);

  return null;
}
