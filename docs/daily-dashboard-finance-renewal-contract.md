# Daily Dashboard — Finance & Renewal Boundaries

## Purpose

The daily dashboard must let the registrar understand a student's financial state and take the correct action without conflating payment, debt, term completion, and renewal.

## Finance source of truth

`calculateFinance` in `src/server/finance-calculations.ts` remains the canonical calculator for invoice amount, paid amount, balance, due date, and financial status.

The daily dashboard API exposes canonical finance fields on each enrollment-session student record:

- `invoiceId`
- `invoiceAmount`
- `paidAmount`
- `balance`
- `tuitionDueDate`
- `financialStatus`

Temporary UI compatibility aliases may exist, but new UI code should use the canonical names above.

## Session-card finance display

The session card should show, in compact form:

1. financial status
2. invoice total
3. paid amount
4. outstanding balance
5. due date when an invoice exists
6. payment action when a positive balance exists

The UI must not recalculate overdue/partial/paid state independently.

## Action boundaries

### Payment

Payment means recording money against an existing invoice. It changes the financial ledger and must not implicitly create or renew a term.

### End of term

End of term is a scheduling/enrollment lifecycle concept. It answers whether the current enrollment period has reached its end, independently of whether money is fully paid.

### Renewal

Renewal creates or activates the next enrollment term according to the enrollment-term business rules. It must not be implemented as a side effect of registering a payment.

### Make-up session

A make-up session compensates for an attendance/cancellation exception. It is operational scheduling and must remain separate from both payment and renewal.

## Renewal eligibility

The dashboard may surface a renewal candidate when the enrollment is approaching or has reached its defined end condition. A monthly billing mode alone is not sufficient evidence of term renewal unless the business rule explicitly defines it that way.

The exact renewal rule should be centralized server-side and return an explicit reason/category so the UI can explain why action is suggested.

## Recommended UI sequence

For a student card:

`وضعیت مالی → مبلغ/پرداخت/مانده → سررسید → ثبت پرداخت`

and separately:

`وضعیت ترم → دلیل نیاز به تمدید → تمدید ترم`

This keeps receptionist actions predictable and prevents a payment action from being mistaken for a renewal action.

## Next implementation step

Implement the canonical finance fields in the session-card rendering and surface `tuitionDueDate`. Then refactor renewal presentation to consume an explicit server-side renewal reason rather than inferring renewal solely from billing mode or remaining sessions.
