# Daily Dashboard — Finance Due Date Contract

## Purpose

The daily dashboard must expose the invoice due date alongside the financial status on the session/student card. This gives the registrar the minimum context needed to distinguish an unpaid invoice that is still within its due window from an overdue invoice.

## Source of truth

`calculateFinance()` remains the financial source of truth. The dashboard API exposes the calculated values without recomputing them in the browser.

Relevant fields:

- `invoiceAmount`: total invoice amount
- `paidAmount`: total recorded payments
- `balance`: remaining invoice balance
- `financialStatus`: `paid`, `partial`, `pending`, `overdue`, or `none`
- `tuitionDueDate`: invoice due date when one exists
- `overdue`: whether an unpaid balance is past the due date
- `nearDue`: whether an unpaid balance is within the configured near-due window
- `dueDays`: signed number of days until/past the due date when available

## UI rule

When an invoice exists, the session card should show a compact `سررسید` row near the amount/paid/balance values.

- Paid invoices may still show their historical due date, but it must not be styled as overdue.
- An unpaid invoice due today is `nearDue`, not `overdue`.
- An unpaid invoice whose due date has passed is `overdue` and should receive the dashboard's existing warning treatment.
- If no due date exists, do not invent one; omit the due-date value or show `بدون سررسید` according to the established UI convention.

## Modal parity

The quick-payment modal must expose the same due-date information as the inline session card so the operator does not lose financial context when opening the payment workflow.

## Boundary tests

The finance calculation test suite covers:

1. unpaid invoice due today → near due, not overdue;
2. fully paid invoice with a past due date → neither overdue nor near due.

This keeps the UI contract anchored to deterministic domain calculations rather than browser-side date logic.
