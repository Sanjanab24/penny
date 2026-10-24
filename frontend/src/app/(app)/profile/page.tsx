"use client";

import { UserRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { AgeField, OccupationPicker, useProfileDraft } from "@/components/profile/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useSaveProfile } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const profile = useProfile();
  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserRoundIcon}
        title="Profile"
        description="Used to tailor AI budget suggestions. Both answers are optional."
      />
      {profile.isError ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load your profile: {profile.error.message}
        </p>
      ) : profile.data ? (
        // Keyed so the form restarts from the saved values after a save.
        <ProfileForm key={JSON.stringify(profile.data)} profile={profile.data} />
      ) : (
        <Skeleton className="h-96 w-full max-w-2xl" />
      )}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const draft = useProfileDraft(profile);
  const changed =
    (draft.input.age ?? null) !== profile.age ||
    (draft.input.occupation ?? null) !== profile.occupation;

  return (
    <form
      className="max-w-2xl"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.ageError) return;
        save.mutate(draft.input, {
          onSuccess: () => toast.success("Profile saved"),
          onError: (error) => toast.error(error.message),
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>
            Shared with the AI only as &quot;age&quot; and &quot;occupation&quot;, never your name
            or email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AgeField value={draft.age} onChange={draft.setAge} error={draft.ageError} />
          <div className="grid gap-2">
            <p className="text-sm font-medium">What do you do?</p>
            <OccupationPicker value={draft.occupation} onChange={draft.setOccupation} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {(profile.age !== null || profile.occupation !== null) && (
              <Button
                type="button"
                variant="ghost"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({}, { onSuccess: () => toast.success("Profile cleared") })
                }
              >
                Clear my answers
              </Button>
            )}
            <Button type="submit" disabled={!changed || !!draft.ageError || save.isPending}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
