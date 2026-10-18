import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

import { Skeleton } from "@/components/ui/skeleton";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      {/* Clerk's form reads the URL on the client, so it can't be part of the static shell. */}
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-sm" />}>
        <SignUp />
      </Suspense>
    </main>
  );
}
