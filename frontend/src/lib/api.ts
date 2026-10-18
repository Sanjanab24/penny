"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Mirrors the backend error envelope: {"error": {"code", "message", "details"}}. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function parseError(res: Response): Promise<ApiError> {
  try {
    const { error } = await res.json();
    return new ApiError(res.status, error.code, error.message, error.details);
  } catch {
    return new ApiError(res.status, "http_error", res.statusText || "Request failed");
  }
}

/**
 * True once Clerk has an active session, i.e. `useApi` calls will carry a token. Pass it as
 * `enabled` on protected queries: right after sign-up the session can still be settling, and
 * `getToken()` returns null until it is active.
 */
export function useSessionReady() {
  return useAuth().isSignedIn === true;
}

/**
 * Returns a typed fetcher for the FastAPI backend that attaches the Clerk session token.
 * Usage: `const api = useApi(); useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") })`
 */
export function useApi() {
  const { getToken } = useAuth();

  return useCallback(
    async <T,>(path: string, { body, headers, ...init }: RequestOptions = {}): Promise<T> => {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v1${path}`, {
        ...init,
        headers: {
          ...(body !== undefined && { "Content-Type": "application/json" }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw await parseError(res);
      return (res.status === 204 ? undefined : await res.json()) as T;
    },
    [getToken],
  );
}
