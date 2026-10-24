"use client";

import type { ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";

import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/api";

let browserQueryClient: QueryClient | undefined;

/**
 * App-wide reactions to errors any request can hit. Each uses a fixed toast id, so ten failing
 * widgets show one message, not ten. Other errors stay with the page that made the request.
 */
function handleGlobalError(error: unknown) {
  if (!(error instanceof ApiError) || typeof window === "undefined") return;
  if (error.status === 401) {
    toast.error("Your session expired. Please sign in again.", {
      id: "session-expired",
      duration: Infinity,
      action: {
        label: "Sign in",
        // A full page load on purpose: it drops everything cached for the expired session.
        onClick: () => window.location.assign(new URL("/sign-in", window.location.origin)),
      },
    });
  } else if (error.code === "network_error") {
    toast.error(error.message, { id: "network-error" });
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleGlobalError }),
    mutationCache: new MutationCache({ onError: handleGlobalError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry once for network problems and server errors; auth/validation errors won't heal.
        retry: (failureCount, error) =>
          failureCount < 1 &&
          (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
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
