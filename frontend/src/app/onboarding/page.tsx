"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { AgeField, OccupationPicker, useProfileDraft } from "@/components/profile/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useSaveProfile } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shown once after sign-up (the app layout redirects here until it's finished or skipped). */
export default function OnboardingPage() {
  const router = useRouter();
  const profile = useProfile();

  // Already done (e.g. a second tab, or the back button): nothing to ask.
  useEffect(() => {
    if (profile.data?.onboarded) router.replace("/dashboard");
  }, [profile.data, router]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      {profile.data && !profile.data.onboarded ? (
        <OnboardingFlow profile={profile.data} onDone={() => router.replace("/dashboard")} />
      ) : (
        <Skeleton className="h-[28rem] w-full max-w-lg rounded-2xl" />
      )}
    </main>
  );
}

function OnboardingFlow({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const { user } = useUser();
  const save = useSaveProfile();
  const [step, setStep] = useState<0 | 1>(0);
  const draft = useProfileDraft(profile);

  const finish = (skip: boolean) =>
    save.mutate(skip ? {} : draft.input, {
      onSuccess: () => {
        if (!skip) toast.success("Thanks! Your suggestions will now fit you better.");
        onDone();
      },
      onError: (error) => toast.error(error.message),
    });

  return (
    <Card className="w-full max-w-lg rounded-2xl">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <span className="bg-hero inline-flex size-11 items-center justify-center rounded-xl text-white shadow-md shadow-primary/25">
            <WalletIcon className="size-5" aria-hidden />
          </span>
          <ol className="flex gap-1.5" aria-label={`Step ${step + 1} of 2`}>
            {[0, 1].map((i) => (
              <li
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "bg-hero w-8" : i < step ? "w-4 bg-primary/60" : "w-4 bg-muted",
                )}
              />
            ))}
          </ol>
        </div>

        {step === 0 ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.ageError) setStep(1);
            }}
            noValidate
          >
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome{user?.firstName ? `, ${user.firstName}` : ""}!
              </h1>
              <p className="text-sm text-muted-foreground">
                I&apos;m Penny, your AI money buddy. Two quick questions so my budget suggestions
                fit your life. You can change these any time from your profile.
              </p>
            </div>
            <AgeField value={draft.age} onChange={draft.setAge} error={draft.ageError} autoFocus />
            <Footer
              onSkip={() => finish(true)}
              busy={save.isPending}
              primary={
                <Button type="submit" disabled={!!draft.ageError}>
                  Next <ArrowRightIcon />
                </Button>
              }
            />
          </form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">What do you do?</h1>
              <p className="text-sm text-muted-foreground">
                A student and a working professional usually budget very differently.
              </p>
            </div>
            <OccupationPicker value={draft.occupation} onChange={draft.setOccupation} />
            <Footer
              onSkip={() => finish(true)}
              busy={save.isPending}
              back={() => setStep(0)}
              primary={
                <Button onClick={() => finish(false)} disabled={save.isPending}>
                  <SparklesIcon /> {save.isPending ? "Saving…" : "Get started"}
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Footer({
  primary,
  onSkip,
  back,
  busy,
}: {
  primary: React.ReactNode;
  onSkip: () => void;
  back?: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
      <div className="flex items-center gap-1">
        {back && (
          <Button type="button" variant="ghost" onClick={back} disabled={busy}>
            <ArrowLeftIcon /> Back
          </Button>
        )}
        <Button
          type="button"
          variant="link"
          className="text-muted-foreground"
          onClick={onSkip}
          disabled={busy}
        >
          Skip for now
        </Button>
      </div>
      {primary}
    </div>
  );
}
