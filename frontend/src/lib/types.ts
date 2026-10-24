/** Shapes returned by the FastAPI backend. Money is a decimal string ("12.50") to keep precision. */

export type Category = {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  expense_count: number;
};

export type CategoryInput = { name: string; color: string; icon: string };

export type Expense = {
  id: number;
  amount: string;
  category_id: number;
  date: string; // YYYY-MM-DD
  description: string;
  recurring_id: number | null;
  created_at: string;
};

export type ExpenseInput = {
  amount: string;
  category_id: number;
  date: string;
  description: string;
};

export type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type ExpensePage = Page<Expense> & { total_amount: string };

export type ExpenseSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export type ExpenseListParams = {
  page: number;
  page_size: number;
  sort: ExpenseSort;
  q?: string;
  category_id?: number;
  date_from?: string;
  date_to?: string;
};

export type CategoryUsage = {
  category_id: number;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  allocated: string;
  spent: string;
  recurring: string; // active recurring payments in this category
  remaining: string; // negative when over budget
  percent_used: string | null; // null when nothing is allocated
  over_budget: boolean;
};

export type BudgetSummary = {
  month: string; // YYYY-MM
  has_budget: boolean;
  total_amount: string;
  allocated_total: string;
  recurring_total: string;
  unallocated: string;
  spent_total: string;
  remaining: string;
  percent_used: string | null;
  categories: CategoryUsage[];
};

export type BudgetInput = {
  total_amount: string;
  allocations: { category_id: number; amount: string }[];
};

export type RecurringPayment = {
  id: number;
  description: string;
  amount: string;
  category_id: number;
  day_of_month: number; // 1-31; shorter months charge on their last day
  active: boolean;
  next_charge_date: string | null; // YYYY-MM-DD; null while paused
  created_at: string;
};

export type RecurringInput = {
  description: string;
  amount: string;
  category_id: number;
  day_of_month: number;
  active?: boolean;
  /** Create only: also record this month's charge if the billing day already passed. */
  charge_current_month?: boolean;
};

export type RecurringPage = Page<RecurringPayment> & { monthly_total: string };

type CategoryRef = { category_id: number; name: string; color: string; icon: string };

export type CategorySpend = CategoryRef & {
  amount: string;
  percent: string; // share of the month's total
  expense_count: number;
};

export type MonthSummary = {
  month: string;
  total: string;
  expense_count: number;
  daily_average: string;
  categories: CategorySpend[]; // largest first
};

export type TrendPoint = { month: string; total: string; budget: string | null };
export type Trends = { points: TrendPoint[]; average: string };

export type CategoryChange = CategoryRef & { current: string; previous: string; change: string };

export type MonthComparison = {
  month: string;
  previous_month: string;
  total: string;
  previous_total: string;
  change: string;
  change_percent: string | null; // null when the previous month had no spending
  categories: CategoryChange[];
};

export type FollowUpQuestion = {
  id: string;
  text: string;
  kind: "number" | "text" | "choice";
  options: string[];
};

export type EventQuestions = {
  event: string;
  suggested_category_id: number | null;
  questions: FollowUpQuestion[];
};

export type QuestionsRequest = {
  month: string;
  available_funds: string;
  upcoming_events: string[];
};
export type QuestionsResponse = { source: "ai" | "fallback"; events: EventQuestions[] };

/** What the user said about one event. A budget with a category is set aside first. */
export type EventPlan = {
  event: string;
  budget?: string;
  category_id?: number;
  answers: { question: string; answer: string }[];
};

export type RecommendationRequest = {
  month: string;
  available_funds: string;
  upcoming_events: string[];
  event_plans?: EventPlan[];
  /** "Try another suggestion": what the user saw last, beyond recurring and event budgets. */
  previous_suggestion?: { category_id: number; amount: string }[];
};

export type RecommendedAllocation = {
  category_id: number;
  name: string;
  color: string;
  icon: string;
  amount: string; // recurring payments and event budgets included
  recurring: string;
  reserved: string; // set aside for events the user gave a budget for
  reason: string;
};

export type Recommendation = {
  month: string;
  source: "ai" | "fallback";
  fallback_reason: string | null;
  available_funds: string;
  recurring_total: string;
  reserved_total: string;
  based_on: string | null; // e.g. "your spending in October so far"
  allocations: RecommendedAllocation[];
  summary: string;
};

export type SavingsPoint = {
  month: string;
  status: "complete" | "in_progress" | "future";
  budget: string | null; // null: no budget was set, so savings can't be worked out
  spent: string;
  saved: string | null; // budget - spent; negative means overspent
  savings_rate: string | null; // % of the budget
};

export type Savings = {
  points: SavingsPoint[]; // oldest first
  last_month: SavingsPoint;
  months_counted: number; // complete months that had a budget
  total_saved: string;
  average_saved: string | null;
  average_rate: string | null;
};

export type Occupation =
  | "student_undergraduate"
  | "student_postgraduate"
  | "working_professional"
  | "self_employed"
  | "homemaker"
  | "retired"
  | "other";

export type Profile = {
  age: number | null;
  occupation: Occupation | null;
  onboarded: boolean; // false until onboarding is finished or skipped
};

export type ProfileInput = { age?: number; occupation?: Occupation };
