export type FinanceStatus = "none" | "pending" | "partial" | "paid" | "overdue";

export interface FinanceCalculationInput {
  invoiceAmount: number;
  paidAmount: number;
  dueDate?: string | null;
  today?: string;
  billingType?: string | null;
  plannedSessions?: number | null;
  consumedSessions?: number;
}

export interface FinanceCalculation {
  invoiceAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  overdue: boolean;
  dueDays: number | null;
  nearDue: boolean;
  financialStatus: FinanceStatus;
  isSessionBased: boolean;
  sessionValue: number;
  amountDueToDate: number;
  unpaidSessions: number | null;
}

const DAY_MS = 86400000;

export function calculateFinance(input: FinanceCalculationInput): FinanceCalculation {
  const invoiceAmount = Math.max(Number(input.invoiceAmount || 0), 0);
  const paidAmount = Math.max(Number(input.paidAmount || 0), 0);
  const balance = Math.max(invoiceAmount - paidAmount, 0);
  const dueDate = input.dueDate ?? null;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const dueDays = dueDate
    ? Math.ceil((new Date(`${dueDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS)
    : null;
  const overdue = !!dueDate && dueDate < today && balance > 0;
  const nearDue = dueDays !== null && dueDays >= 0 && dueDays <= 7 && balance > 0;

  const isSessionBased = input.billingType === "session_based";
  const plannedSessions = Number(input.plannedSessions ?? 0);
  const consumedSessions = Math.max(Number(input.consumedSessions ?? 0), 0);
  const sessionValue = isSessionBased && plannedSessions > 0 ? invoiceAmount / plannedSessions : 0;
  const amountDueToDate = isSessionBased && sessionValue > 0
    ? Math.min(invoiceAmount, consumedSessions * sessionValue)
    : invoiceAmount;
  const unpaidSessions = isSessionBased && sessionValue > 0
    ? Math.min(plannedSessions, Math.ceil(Math.max(amountDueToDate - paidAmount, 0) / sessionValue))
    : null;

  const financialStatus: FinanceStatus = invoiceAmount <= 0 && paidAmount <= 0
    ? "none"
    : balance <= 0
      ? "paid"
      : overdue
        ? "overdue"
        : paidAmount > 0
          ? "partial"
          : "pending";

  return {
    invoiceAmount,
    paidAmount,
    balance,
    dueDate,
    overdue,
    dueDays,
    nearDue,
    financialStatus,
    isSessionBased,
    sessionValue,
    amountDueToDate,
    unpaidSessions,
  };
}

export function calculateInstructorShare(sessionValue: number, payPercentage: number): number {
  const value = Math.max(Number(sessionValue || 0), 0);
  const percentage = Math.min(100, Math.max(0, Number(payPercentage || 0)));
  return value * percentage / 100;
}
