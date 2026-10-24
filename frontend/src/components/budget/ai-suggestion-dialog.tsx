"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  InfoIcon,
  MessageCircleQuestionIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";

import { CategorySwatch } from "@/components/category-icon";
import { CategorySelect } from "@/components/category-select";
import { FormField } from "@/components/form-field";
import { fromPaise, MONEY_PATTERN, MoneyInput, toPaise } from "@/components/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { formatMonth } from "@/lib/month";
import { useBudgetQuestions, useBudgetRecommendation } from "@/lib/queries";
import type {
  Category,
  EventPlan,
  EventQuestions,
  FollowUpQuestion,
  QuestionsResponse,
  Recommendation,
  RecommendationRequest,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_EVENTS = 10;
const MAX_EVENT_LENGTH = 300;
const MAX_ANSWER_LENGTH = 300;

export type AppliedSuggestion = { total: string; allocations: Record<number, string> };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  /** The total currently typed in the budget form, used as the starting funds. */
  initialFunds: string;
  categories: Category[];
  onApply: (suggestion: AppliedSuggestion) => void;
};

export function AiSuggestionDialog({ open, onOpenChange, onApply, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {/* Mounted only while open, so each opening starts fresh. */}
        <SuggestionFlow
          {...rest}
          onApply={(s) => {
            onApply(s);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** One event's answers while the user fills in the questions step. */
type PlanDraft = { budget: string; categoryId: string; answers: Record<string, string> };

/**
 * Plan -> (questions about events) -> review. The questions step only appears when the user
 * lists events; they can skip it. Nothing here saves anything: "Apply" fills the budget form.
 */
function SuggestionFlow({
  month,
  initialFunds,
  categories,
  onApply,
  onCancel,
}: Omit<Props, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const questions = useBudgetQuestions();
  const recommend = useBudgetRecommendation();
  const [step, setStep] = useState<"plan" | "questions" | "review">("plan");
  const [funds, setFunds] = useState(MONEY_PATTERN.test(initialFunds) ? initialFunds : "");
  const [eventsText, setEventsText] = useState("");
  const [asked, setAsked] = useState<QuestionsResponse | null>(null);
  const [drafts, setDrafts] = useState<PlanDraft[]>([]);
  const [lastRequest, setLastRequest] = useState<RecommendationRequest | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);

  const events = eventsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const fundsError =
    funds !== "" && !MONEY_PATTERN.test(funds) ? "Enter an amount like 50000" : undefined;
  const eventsError =
    events.length > MAX_EVENTS
      ? `Up to ${MAX_EVENTS} events`
      : events.some((e) => e.length > MAX_EVENT_LENGTH)
        ? `Keep each event under ${MAX_EVENT_LENGTH} characters`
        : undefined;
  const busy = questions.isPending || recommend.isPending;
  const error = questions.error ?? recommend.error;

  const requestSuggestion = (request: RecommendationRequest) => {
    setLastRequest(request);
    recommend.mutate(request, {
      onSuccess: (data) => {
        setResult(data);
        setStep("review");
      },
    });
  };

  const submitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!funds || fundsError || eventsError) return;
    if (events.length === 0) {
      requestSuggestion({ month, available_funds: funds, upcoming_events: [] });
      return;
    }
    questions.mutate(
      { month, available_funds: funds, upcoming_events: events },
      {
        onSuccess: (data) => {
          setAsked(data);
          setDrafts(
            data.events.map((ev) => ({
              budget: "",
              categoryId: ev.suggested_category_id ? String(ev.suggested_category_id) : "",
              answers: {},
            })),
          );
          setStep("questions");
        },
      },
    );
  };

  const submitAnswers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asked) return;
    const plans: EventPlan[] = asked.events.map((ev, i) => {
      const draft = drafts[i];
      const budget =
        MONEY_PATTERN.test(draft.budget) && toPaise(draft.budget) > 0 ? draft.budget : undefined;
      return {
        event: ev.event,
        budget,
        category_id: budget && draft.categoryId ? Number(draft.categoryId) : undefined,
        answers: ev.questions
          .map((q) => ({ question: q.text, answer: (draft.answers[q.id] ?? "").trim() }))
          .filter((a) => a.answer !== ""),
      };
    });
    requestSuggestion({ month, available_funds: funds, upcoming_events: [], event_plans: plans });
  };

  if (step === "review" && result) {
    return (
      <Review
        key={JSON.stringify(result)}
        result={result}
        regenerating={recommend.isPending}
        error={recommend.error?.message}
        onTryAnother={() =>
          lastRequest &&
          requestSuggestion({
            ...lastRequest,
            // Only the flexible part: recurring payments and event budgets stay fixed.
            previous_suggestion: result.allocations.map((a) => ({
              category_id: a.category_id,
              amount: fromPaise(toPaise(a.amount) - toPaise(a.recurring) - toPaise(a.reserved)),
            })),
          })
        }
        onBack={() => setStep(asked ? "questions" : "plan")}
        onApply={onApply}
      />
    );
  }

  if (step === "questions" && asked) {
    return (
      <QuestionsStep
        asked={asked}
        drafts={drafts}
        setDrafts={setDrafts}
        funds={funds}
        categories={categories}
        busy={busy}
        error={error?.message}
        onSubmit={submitAnswers}
        onSkip={() => requestSuggestion({ month, available_funds: funds, upcoming_events: events })}
        onBack={() => setStep("plan")}
      />
    );
  }

  return (
    <form onSubmit={submitPlan} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" aria-hidden /> AI budget suggestion
        </DialogTitle>
        <DialogDescription>
          Plans {formatMonth(month)} from your past spending and recurring payments. Only totals per
          category are shared with the AI, never your expense descriptions.
        </DialogDescription>
      </DialogHeader>

      <FormField label="Funds available this month" htmlFor="ai-funds" error={fundsError}>
        <MoneyInput
          id="ai-funds"
          autoFocus
          value={funds}
          onChange={(e) => setFunds(e.target.value.trim())}
          aria-invalid={!!fundsError}
          aria-describedby={fundsError ? "ai-funds-error" : undefined}
        />
      </FormField>

      <FormField label="Upcoming events (optional)" htmlFor="ai-events" error={eventsError}>
        <Textarea
          id="ai-events"
          rows={3}
          placeholder={"One per line, e.g.\nMy birthday party\nTrip with friends to Goa"}
          value={eventsText}
          onChange={(e) => setEventsText(e.target.value)}
          aria-invalid={!!eventsError}
          aria-describedby={eventsError ? "ai-events-error" : "ai-events-hint"}
        />
        {!eventsError && (
          <p id="ai-events-hint" className="text-xs text-muted-foreground">
            You&apos;ll get a few quick questions about each event, like how much you plan to spend.
          </p>
        )}
      </FormField>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!funds || !!fundsError || !!eventsError || busy}>
          {events.length > 0 ? <MessageCircleQuestionIcon /> : <SparklesIcon />}
          {busy ? "Thinking…" : events.length > 0 ? "Next: a few questions" : "Get suggestion"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function QuestionsStep({
  asked,
  drafts,
  setDrafts,
  funds,
  categories,
  busy,
  error,
  onSubmit,
  onSkip,
  onBack,
}: {
  asked: QuestionsResponse;
  drafts: PlanDraft[];
  setDrafts: React.Dispatch<React.SetStateAction<PlanDraft[]>>;
  funds: string;
  categories: Category[];
  busy: boolean;
  error?: string;
  onSubmit: (e: React.FormEvent) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const update = (index: number, change: Partial<PlanDraft>) =>
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...change } : d)));

  const budgetErrors = drafts.map((d) =>
    d.budget !== "" && !MONEY_PATTERN.test(d.budget) ? "Enter an amount like 5000" : undefined,
  );
  const missingCategory = drafts.some((d) => toPaise(d.budget) > 0 && !d.categoryId);
  const eventTotal = drafts.reduce((sum, d) => sum + toPaise(d.budget), 0);
  const overFunds = eventTotal > toPaise(funds);
  const blocked = busy || budgetErrors.some(Boolean) || missingCategory || overFunds;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          A few questions
          {asked.source === "fallback" && (
            <Badge variant="secondary" className="gap-1">
              <InfoIcon aria-hidden /> Basic questions
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          Your answers shape the plan. A budget you give for an event is set aside first; leave it
          empty and the AI estimates from your other answers. Every question is optional.
        </DialogDescription>
      </DialogHeader>

      {asked.events.map((ev, i) => (
        <EventCard
          key={i}
          index={i}
          event={ev}
          draft={drafts[i]}
          budgetError={budgetErrors[i]}
          categories={categories}
          onChange={(change) => update(i, change)}
        />
      ))}

      {overFunds && (
        <p className="text-sm text-destructive" role="alert">
          Event budgets add up to {formatMoney(fromPaise(eventTotal))}, more than your{" "}
          {formatMoney(funds)}.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeftIcon /> Back
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>
            Skip questions
          </Button>
          <Button type="submit" disabled={blocked}>
            <SparklesIcon />
            {busy ? "Planning…" : "Get suggestion"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function EventCard({
  index,
  event,
  draft,
  budgetError,
  categories,
  onChange,
}: {
  index: number;
  event: EventQuestions;
  draft: PlanDraft;
  budgetError?: string;
  categories: Category[];
  onChange: (change: Partial<PlanDraft>) => void;
}) {
  const budgetId = `event-${index}-budget`;
  const categoryId = `event-${index}-category`;
  const needsCategory = toPaise(draft.budget) > 0 && !draft.categoryId;
  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{event.event}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={`How much do you plan to spend?`} htmlFor={budgetId} error={budgetError}>
          <MoneyInput
            id={budgetId}
            placeholder="Not sure yet"
            value={draft.budget}
            onChange={(e) => onChange({ budget: e.target.value.trim() })}
            aria-invalid={!!budgetError}
            aria-describedby={budgetError ? `${budgetId}-error` : undefined}
          />
        </FormField>
        <FormField
          label="Which category is it from?"
          htmlFor={categoryId}
          error={needsCategory ? "Pick a category for this budget" : undefined}
        >
          <CategorySelect
            id={categoryId}
            value={draft.categoryId}
            onChange={(value) => onChange({ categoryId: value })}
            categories={categories}
            invalid={needsCategory}
          />
        </FormField>
      </div>
      {event.questions.map((q) => (
        <QuestionField
          key={q.id}
          question={q}
          value={draft.answers[q.id] ?? ""}
          onChange={(value) => onChange({ answers: { ...draft.answers, [q.id]: value } })}
        />
      ))}
    </fieldset>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: FollowUpQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `question-${question.id}`;
  return (
    <FormField label={question.text} htmlFor={id}>
      {question.kind === "choice" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Choose one (optional)" />
          </SelectTrigger>
          <SelectContent>
            {question.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          inputMode={question.kind === "number" ? "numeric" : undefined}
          maxLength={MAX_ANSWER_LENGTH}
          placeholder={question.kind === "number" ? "e.g. 10" : "Optional"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}

function Review({
  result,
  regenerating,
  error,
  onTryAnother,
  onBack,
  onApply,
}: {
  result: Recommendation;
  regenerating: boolean;
  error?: string;
  onTryAnother: () => void;
  onBack: () => void;
  onApply: (suggestion: AppliedSuggestion) => void;
}) {
  // Every amount stays editable before it goes into the budget form.
  const [amounts, setAmounts] = useState<Record<number, string>>(() =>
    Object.fromEntries(result.allocations.map((a) => [a.category_id, a.amount])),
  );
  const fundsPaise = toPaise(result.available_funds);
  const totalPaise = Object.values(amounts).reduce((sum, v) => sum + toPaise(v), 0);
  const invalid = Object.values(amounts).some((v) => v !== "" && !MONEY_PATTERN.test(v));
  const overBy = totalPaise - fundsPaise;

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Suggested budget
          {result.source === "ai" ? (
            <Badge className="gap-1">
              <SparklesIcon aria-hidden /> AI suggestion
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <InfoIcon aria-hidden /> Rule-based suggestion
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          {formatMoney(result.available_funds)} for {formatMonth(result.month)}. Edit any amount,
          try another suggestion, or apply it to your budget form.
        </DialogDescription>
      </DialogHeader>

      {result.fallback_reason && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {result.fallback_reason}, so this uses your spending history instead.
        </p>
      )}
      {result.summary && <p className="text-sm leading-relaxed">{result.summary}</p>}
      <p className="-mt-2 text-xs text-muted-foreground">
        {result.based_on
          ? `Based on ${result.based_on}, not counting recurring payments.`
          : "No spending history yet, so this uses general proportions."}
        {Number(result.reserved_total) > 0 &&
          ` ${formatMoney(result.reserved_total)} is set aside for your event budgets.`}
      </p>

      <ul className={cn("divide-y rounded-lg border", regenerating && "opacity-60")}>
        {result.allocations.map((a) => {
          const id = `ai-amount-${a.category_id}`;
          // Recurring payments and event budgets are commitments; warn when cut below them.
          const committed = toPaise(a.recurring) + toPaise(a.reserved);
          const belowCommitted = toPaise(amounts[a.category_id]) < committed;
          return (
            <li key={a.category_id} className="grid grid-cols-[1fr_8.5rem] items-start gap-3 p-3">
              <div className="min-w-0">
                <Label htmlFor={id} className="flex items-center gap-2 font-medium">
                  <CategorySwatch icon={a.icon} color={a.color} className="size-6" />
                  <span className="truncate">{a.name}</span>
                </Label>
                {a.reason && (
                  <p className="mt-1 pl-8 text-xs leading-snug text-muted-foreground">{a.reason}</p>
                )}
              </div>
              <div className="space-y-1">
                <MoneyInput
                  id={id}
                  value={amounts[a.category_id] ?? ""}
                  onChange={(e) =>
                    setAmounts((current) => ({
                      ...current,
                      [a.category_id]: e.target.value.trim(),
                    }))
                  }
                  aria-invalid={belowCommitted}
                />
                {belowCommitted && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Below the {formatMoney(fromPaise(committed))} already committed
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-sm tabular-nums" aria-live="polite">
        Total <strong>{formatMoney(fromPaise(totalPaise))}</strong> of{" "}
        {formatMoney(result.available_funds)}
        {" · "}
        <span
          className={cn(
            overBy > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground",
          )}
        >
          {overBy > 0
            ? `Over by ${formatMoney(fromPaise(overBy))}`
            : `${formatMoney(fromPaise(-overBy))} unallocated`}
        </span>
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={regenerating}>
          <ArrowLeftIcon /> Change answers
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onTryAnother} disabled={regenerating}>
            <RefreshCwIcon className={cn(regenerating && "animate-spin")} />
            {regenerating ? "Thinking…" : "Try another suggestion"}
          </Button>
          <Button
            type="button"
            disabled={invalid || overBy > 0 || regenerating}
            onClick={() => onApply({ total: result.available_funds, allocations: amounts })}
          >
            Apply to budget
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
