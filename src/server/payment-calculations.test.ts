import { describe, expect, it } from "vitest";
import { applyPayment, normalizePaymentMethod } from "./payment-calculations";

describe("normalizePaymentMethod", () => {
  it("normalizes POS aliases", () => {
    expect(normalizePaymentMethod("card")).toBe("pos");
    expect(normalizePaymentMethod("card_reader")).toBe("pos");
  });

  it("normalizes transfer, online and cash", () => {
    expect(normalizePaymentMethod("card_to_card")).toBe("transfer");
    expect(normalizePaymentMethod("gateway")).toBe("online");
    expect(normalizePaymentMethod("cash")).toBe("cash");
  });
});

describe("applyPayment", () => {
  it("accepts a partial payment and keeps the invoice pending", () => {
    const result = applyPayment({
      invoiceAmount: 8_000_000,
      alreadyPaid: 0,
      paymentAmount: 2_000_000,
      dueDate: "2026-09-10",
      today: "2026-09-06",
    });

    expect(result.accepted).toBe(true);
    expect(result.newPaid).toBe(2_000_000);
    expect(result.balance).toBe(6_000_000);
    expect(result.newStatus).toBe("pending");
  });

  it("marks an invoice paid when the final payment closes the balance", () => {
    const result = applyPayment({
      invoiceAmount: 8_000_000,
      alreadyPaid: 6_000_000,
      paymentAmount: 2_000_000,
      dueDate: "2026-09-01",
      today: "2026-09-06",
    });

    expect(result.accepted).toBe(true);
    expect(result.newPaid).toBe(8_000_000);
    expect(result.balance).toBe(0);
    expect(result.newStatus).toBe("paid");
  });

  it("marks a remaining balance overdue after the due date", () => {
    const result = applyPayment({
      invoiceAmount: 8_000_000,
      alreadyPaid: 2_000_000,
      paymentAmount: 1_000_000,
      dueDate: "2026-09-05",
      today: "2026-09-06",
    });

    expect(result.accepted).toBe(true);
    expect(result.balance).toBe(5_000_000);
    expect(result.newStatus).toBe("overdue");
  });

  it("rejects an overpayment", () => {
    const result = applyPayment({
      invoiceAmount: 8_000_000,
      alreadyPaid: 7_000_000,
      paymentAmount: 2_000_000,
      dueDate: "2026-09-10",
      today: "2026-09-06",
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toBe("overpayment");
    expect(result.newPaid).toBe(7_000_000);
    expect(result.balance).toBe(1_000_000);
  });

  it("rejects a payment when the invoice is already fully paid", () => {
    const result = applyPayment({
      invoiceAmount: 8_000_000,
      alreadyPaid: 8_000_000,
      paymentAmount: 1_000_000,
      today: "2026-09-06",
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toBe("already_paid");
    expect(result.newStatus).toBe("paid");
  });
});
