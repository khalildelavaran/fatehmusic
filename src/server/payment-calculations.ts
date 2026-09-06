export type PaymentMethod = "cash" | "pos" | "transfer" | "online";

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  const method = String(value ?? "").trim().toLowerCase();
  if (method === "pos" || method === "card" || method === "card_reader") return "pos";
  if (method === "transfer" || method === "bank" || method === "card_to_card") return "transfer";
  if (method === "online" || method === "gateway" || method === "internet") return "online";
  return "cash";
}

export interface PaymentApplication {
  accepted: boolean;
  balance: number;
  newPaid: number;
  newStatus: "pending" | "overdue" | "paid";
  error?: "already_paid" | "overpayment";
}

export function applyPayment(input: {
  invoiceAmount: number;
  alreadyPaid: number;
  paymentAmount: number;
  dueDate?: string | null;
  today: string;
}): PaymentApplication {
  const invoiceAmount = Math.max(Number(input.invoiceAmount || 0), 0);
  const alreadyPaid = Math.max(Number(input.alreadyPaid || 0), 0);
  const paymentAmount = Math.max(Number(input.paymentAmount || 0), 0);
  const balance = Math.max(invoiceAmount - alreadyPaid, 0);

  if (balance <= 0) {
    return { accepted: false, balance: 0, newPaid: alreadyPaid, newStatus: "paid", error: "already_paid" };
  }
  if (paymentAmount > balance) {
    return { accepted: false, balance, newPaid: alreadyPaid, newStatus: "pending", error: "overpayment" };
  }

  const newPaid = alreadyPaid + paymentAmount;
  const newBalance = Math.max(invoiceAmount - newPaid, 0);
  const newStatus = newBalance <= 0
    ? "paid"
    : input.dueDate && input.dueDate < input.today
      ? "overdue"
      : "pending";

  return { accepted: true, balance: newBalance, newPaid, newStatus };
}
