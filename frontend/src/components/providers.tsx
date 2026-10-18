"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying auth/validation errors never helps; retry network/5xx once.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 1,
      },
    },
  });
}

function getQueryClient() {
  // Isolate server renders; reuse a single client in the browser.
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={getQueryClient()}>
        {children}
        <Toaster richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
