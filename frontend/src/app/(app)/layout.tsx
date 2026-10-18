import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Shell for every signed-in page (the proxy already enforces auth). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Pages are session-dependent, so they stream in after the static shell. */}
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>{children}</Suspense>
      </main>
    </>
  );
}
