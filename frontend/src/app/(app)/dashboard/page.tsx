"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi, useSessionReady } from "@/lib/api";

type Health = { status: "ok" | "degraded"; database: "ok" | "unavailable" };
type Me = { id: number; external_auth_id: string; created_at: string };

/** Phase 1 placeholder: proves the frontend -> FastAPI -> Postgres chain and Clerk auth work. */
export default function DashboardPage() {
  const api = useApi();
  const health = useQuery({ queryKey: ["health"], queryFn: () => api<Health>("/health") });
  const sessionReady = useSessionReady();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), enabled: sessionReady });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Backend health</CardTitle>
            <CardDescription>GET /api/v1/health</CardDescription>
          </CardHeader>
          <CardContent>
            {health.isPending ? (
              <Skeleton className="h-6 w-32" />
            ) : health.isError ? (
              <StatusBadge ok={false} label={health.error.message} />
            ) : (
              <StatusBadge
                ok={health.data.status === "ok"}
                label={`API ${health.data.status}, database ${health.data.database}`}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Authenticated user</CardTitle>
            <CardDescription>GET /api/v1/me (protected)</CardDescription>
          </CardHeader>
          <CardContent>
            {me.isPending ? (
              <Skeleton className="h-6 w-48" />
            ) : me.isError ? (
              <StatusBadge ok={false} label={me.error.message} />
            ) : (
              <div className="space-y-1 text-sm">
                <StatusBadge ok label="Token verified by FastAPI" />
                <p className="text-muted-foreground">
                  Local user #{me.data.id} · <code>{me.data.external_auth_id}</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2Icon : XCircleIcon;
  return (
    <Badge variant={ok ? "secondary" : "destructive"} className="gap-1">
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Badge>
  );
}
