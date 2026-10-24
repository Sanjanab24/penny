"use client";

import { useState } from "react";
import {
  BookOpenTextIcon,
  BriefcaseIcon,
  CircleEllipsisIcon,
  GraduationCapIcon,
  HouseIcon,
  type LucideIcon,
  StoreIcon,
  SunsetIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Occupation, Profile, ProfileInput } from "@/lib/types";
import { cn } from "@/lib/utils";

export const OCCUPATIONS: { value: Occupation; label: string; hint: string; icon: LucideIcon }[] = [
  {
    value: "student_undergraduate",
    label: "Undergraduate student",
    hint: "Bachelor's, diploma",
    icon: GraduationCapIcon,
  },
  {
    value: "student_postgraduate",
    label: "Postgraduate student",
    hint: "Master's, PhD",
    icon: BookOpenTextIcon,
  },
  {
    value: "working_professional",
    label: "Working professional",
    hint: "Salaried job",
    icon: BriefcaseIcon,
  },
  { value: "self_employed", label: "Self-employed", hint: "Business, freelance", icon: StoreIcon },
  { value: "homemaker", label: "Homemaker", hint: "Running the home", icon: HouseIcon },
  { value: "retired", label: "Retired", hint: "Pension, savings", icon: SunsetIcon },
  { value: "other", label: "Other", hint: "Something else", icon: CircleEllipsisIcon },
];

export const occupationLabel = (value: Occupation | null) =>
  OCCUPATIONS.find((o) => o.value === value)?.label;

const MIN_AGE = 13;
const MAX_AGE = 100;

export function useProfileDraft(profile?: Profile) {
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [occupation, setOccupation] = useState<Occupation | null>(profile?.occupation ?? null);
  const ageNumber = Number(age);
  const ageError =
    age !== "" && (!/^\d+$/.test(age) || ageNumber < MIN_AGE || ageNumber > MAX_AGE)
      ? `Enter an age between ${MIN_AGE} and ${MAX_AGE}`
      : undefined;
  const input: ProfileInput = {
    ...(age !== "" && !ageError && { age: ageNumber }),
    ...(occupation && { occupation }),
  };
  return { age, setAge, occupation, setOccupation, ageError, input };
}

export function AgeField({
  value,
  onChange,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="age">Your age</Label>
      <Input
        id="age"
        inputMode="numeric"
        placeholder="e.g. 21"
        autoFocus={autoFocus}
        className="h-11 max-w-40 text-base"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        aria-invalid={!!error}
        aria-describedby={error ? "age-error" : undefined}
      />
      {error && (
        <p id="age-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Occupation as a grid of selectable cards (a radio group under the hood). */
export function OccupationPicker({
  value,
  onChange,
}: {
  value: Occupation | null;
  onChange: (value: Occupation) => void;
}) {
  return (
    <div role="radiogroup" aria-label="What do you do?" className="grid gap-2 sm:grid-cols-2">
      {OCCUPATIONS.map(({ value: option, label, hint, icon: Icon }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary/8 ring-1 ring-primary"
                : "hover:border-primary/40 hover:bg-accent/50",
            )}
          >
            <span
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                selected ? "bg-hero text-white" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
