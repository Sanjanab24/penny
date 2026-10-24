"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useProfile } from "@/lib/queries";

/** Sends users who haven't finished (or skipped) onboarding to /onboarding. Renders nothing. */
export function OnboardingGate() {
  const router = useRouter();
  const profile = useProfile();
  const needsOnboarding = profile.data && !profile.data.onboarded;

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  return null;
}
