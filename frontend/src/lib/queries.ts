"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi, useSessionReady } from "@/lib/api";
import type {
  BudgetInput,
  BudgetSummary,
  Category,
  CategoryInput,
  Expense,
  ExpenseInput,
  ExpenseListParams,
  ExpensePage,
  MonthComparison,
  MonthSummary,
  Profile,
  ProfileInput,
  QuestionsRequest,
  QuestionsResponse,
  Recommendation,
  RecommendationRequest,
  RecurringInput,
  RecurringPage,
  RecurringPayment,
  Savings,
  Trends,
} from "@/lib/types";

export const queryKeys = {
  categories: ["categories"] as const,
  expenses: ["expenses"] as const,
  expenseList: (params: ExpenseListParams) => ["expenses", "list", params] as const,
  budgets: ["budgets"] as const,
  budget: (month: string) => ["budgets", month] as const,
  recurring: ["recurring"] as const,
  profile: ["profile"] as const,
  // Under "expenses" so every expense change refreshes the charts too.
  analytics: (kind: string, params: Record<string, string | number>) =>
    ["expenses", "analytics", kind, params] as const,
};

function toSearchParams(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export function useCategories() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api<Category[]>("/categories"),
    enabled: useSessionReady(),
  });
}

export function useExpenses(params: ExpenseListParams) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.expenseList(params),
    queryFn: () => api<ExpensePage>(`/expenses?${toSearchParams(params)}`),
    enabled: useSessionReady(),
    // Keep showing the current page while the next page or filter result loads.
    placeholderData: keepPreviousData,
  });
}

/** Month budget with per-category spent / remaining / % used. */
export function useBudget(month: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.budget(month ?? ""),
    queryFn: () => api<BudgetSummary>(`/budgets/${month}`),
    enabled: useSessionReady() && month !== null,
    placeholderData: keepPreviousData,
  });
}

export function useSaveBudget() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, input }: { month: string; input: BudgetInput }) =>
      api<BudgetSummary>(`/budgets/${month}`, { method: "PUT", body: input }),
    onSuccess: (summary) => queryClient.setQueryData(queryKeys.budget(summary.month), summary),
  });
}

/**
 * Expense and category changes move usage counts and budget spending, so every list that
 * derives from them is refreshed.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
    ]);
}

export function useSaveExpense() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: ExpenseInput }) =>
      id === undefined
        ? api<Expense>("/expenses", { method: "POST", body: input })
        : api<Expense>(`/expenses/${id}`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useSaveCategory() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: CategoryInput }) =>
      id === undefined
        ? api<Category>("/categories", { method: "POST", body: input })
        : api<Category>(`/categories/${id}`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: number; reassignTo?: number }) =>
      api<void>(`/categories/${id}?${toSearchParams({ reassign_to: reassignTo })}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
}

// Recurring payments are few per user, so the page loads them all in one request.
const RECURRING_PAGE_SIZE = 200;

export function useRecurring() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: () => api<RecurringPage>(`/recurring?page_size=${RECURRING_PAGE_SIZE}`),
    enabled: useSessionReady(),
  });
}

/** Saving can create charges right away (e.g. billing day is today), so everything refreshes. */
export function useSaveRecurring() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: Partial<RecurringInput> }) =>
      id === undefined
        ? api<RecurringPayment>("/recurring", { method: "POST", body: input })
        : api<RecurringPayment>(`/recurring/${id}`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurring() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/recurring/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/** Creates the expenses for recurring charges that came due; idempotent on the server. */
export function useGenerateRecurring() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: () => api<{ created: number }>("/recurring/generate", { method: "POST" }),
    onSuccess: ({ created }) => (created > 0 ? invalidate() : undefined),
  });
}

function useAnalytics<T>(kind: string, params: Record<string, string | number>, ready: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.analytics(kind, params),
    queryFn: () => api<T>(`/analytics/${kind}?${toSearchParams(params)}`),
    enabled: useSessionReady() && ready,
    placeholderData: keepPreviousData,
  });
}

export function useMonthSummary(month: string | null) {
  return useAnalytics<MonthSummary>("summary", { month: month ?? "" }, month !== null);
}

export function useTrends(end: string | null, months = 6) {
  return useAnalytics<Trends>("trends", { end: end ?? "", months }, end !== null);
}

/** Saved per month = budget - spending, for the months up to `end`. */
export function useSavings(end: string | null, months = 6) {
  return useAnalytics<Savings>("savings", { end: end ?? "", months }, end !== null);
}

export function useMonthComparison(month: string | null) {
  return useAnalytics<MonthComparison>("compare", { month: month ?? "" }, month !== null);
}

/** Asks for a budget suggestion. Nothing is saved; the caller shows it for review. */
export function useBudgetRecommendation() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: RecommendationRequest) =>
      api<Recommendation>("/ai/budget-recommendation", { method: "POST", body: input }),
  });
}

/** Follow-up questions about the user's upcoming events (asked before suggesting a budget). */
export function useBudgetQuestions() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: QuestionsRequest) =>
      api<QuestionsResponse>("/ai/budget-questions", { method: "POST", body: input }),
  });
}

export function useProfile() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => api<Profile>("/me/profile"),
    enabled: useSessionReady(),
    staleTime: Infinity, // only changes when the user saves it
  });
}

/** Saves age/occupation; an empty object skips onboarding without sharing anything. */
export function useSaveProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      api<Profile>("/me/profile", { method: "PUT", body: input }),
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile, profile),
  });
}
