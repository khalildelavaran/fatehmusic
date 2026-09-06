import { describe, expect, it } from "vitest";
import { calculateFinance, calculateInstructorShare } from "./finance-calculations";

describe("calculateFinance", () => {
  it("calculates an 8-session term and one consumed session", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 0,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 1,
      today: "2026-09-06",
    });

    expect(finance.sessionValue).toBe(1_000_000);
    expect(finance.amountDueToDate).toBe(1_000_000);
    expect(finance.balance).toBe(8_000_000);
    expect(finance.balanceToDate).toBe(1_000_000);
    expect(finance.unpaidSessions).toBe(1);
    expect(finance.financialStatus).toBe("pending");
  });

  it("treats present and absent sessions as consumed when the caller supplies them", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 0,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 2,
    });

    expect(finance.amountDueToDate).toBe(2_000_000);
  });

  it("keeps a student-leave session out of consumed sessions when the caller does not count it", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 0,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 1,
    });

    expect(finance.amountDueToDate).toBe(1_000_000);
  });

  it("calculates invoice balance and due-to-date balance after a partial payment", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 500_000,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 1,
    });

    expect(finance.balance).toBe(7_500_000);
    expect(finance.balanceToDate).toBe(500_000);
    expect(finance.unpaidSessions).toBe(1);
    expect(finance.financialStatus).toBe("partial");
  });

  it("makes due-to-date balance zero when the consumed session has been fully paid", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 1_000_000,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 1,
    });

    expect(finance.balance).toBe(7_000_000);
    expect(finance.balanceToDate).toBe(0);
    expect(finance.unpaidSessions).toBe(0);
  });

  it("does not create instructor debt when the full term tuition was paid upfront", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 8_000_000,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 1,
    });

    expect(finance.balance).toBe(0);
    expect(finance.balanceToDate).toBe(0);
    expect(finance.financialStatus).toBe("paid");
  });

  it("reports one unpaid session after seven consumed sessions with seven sessions paid", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 7_000_000,
      billingType: "session_based",
      plannedSessions: 8,
      consumedSessions: 7,
    });

    expect(8 - 7).toBe(1);
    expect(finance.amountDueToDate).toBe(7_000_000);
    expect(finance.balance).toBe(1_000_000);
    expect(finance.balanceToDate).toBe(0);
    expect(finance.unpaidSessions).toBe(0);
  });

  it("uses the full invoice for monthly billing and does not calculate unpaid sessions", () => {
    const finance = calculateFinance({
      invoiceAmount: 8_000_000,
      paidAmount: 2_000_000,
      billingType: "monthly",
      plannedSessions: 8,
      consumedSessions: 2,
    });

    expect(finance.sessionValue).toBe(0);
    expect(finance.amountDueToDate).toBe(8_000_000);
    expect(finance.balance).toBe(6_000_000);
    expect(finance.balanceToDate).toBe(6_000_000);
    expect(finance.unpaidSessions).toBeNull();
  });

  it("marks an unpaid invoice overdue", () => {
    const finance = calculateFinance({
      invoiceAmount: 1_000_000,
      paidAmount: 0,
      dueDate: "2026-09-05",
      today: "2026-09-06",
    });

    expect(finance.overdue).toBe(true);
    expect(finance.nearDue).toBe(false);
    expect(finance.financialStatus).toBe("overdue");
  });

  it("marks an unpaid invoice due within seven days as near due", () => {
    const finance = calculateFinance({
      invoiceAmount: 1_000_000,
      paidAmount: 0,
      dueDate: "2026-09-10",
      today: "2026-09-06",
    });

    expect(finance.dueDays).toBe(4);
    expect(finance.nearDue).toBe(true);
    expect(finance.financialStatus).toBe("pending");
  });
});

describe("calculateInstructorShare", () => {
  it("calculates the instructor percentage", () => {
    expect(calculateInstructorShare(1_000_000, 50)).toBe(500_000);
  });

  it("caps percentages above 100", () => {
    expect(calculateInstructorShare(1_000_000, 120)).toBe(1_000_000);
  });

  it("clamps negative percentages to zero", () => {
    expect(calculateInstructorShare(1_000_000, -10)).toBe(0);
  });
});
