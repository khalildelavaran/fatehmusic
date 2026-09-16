# Daily Dashboard — Finance Due-Date UI Checklist

## Session card

The finance box should expose the invoice due date without recalculating finance in the browser.

Required source fields from `daily-dashboard.api.ts`:

- `tuitionDueDate`
- `overdue`
- `nearDue`
- `financialStatus`
- `invoiceTotal`
- `amountPaid`
- `balanceDue`

## Display rules

- Paid invoice: show the due date as informational; do not show an overdue/near-due warning.
- Due today: show the due date and the `nearDue` state; it is not overdue.
- Due within seven days: show the due date and the `nearDue` state.
- Past due with outstanding balance: show the due date and the `overdue` state.
- No invoice or no due date: do not invent a date.

## Architecture rule

The client must consume the finance state returned by the server. It must not reproduce the date arithmetic used by `calculateFinance`.

The same presentation contract applies to the inline session-card finance box and the Quick Payment modal.

## Next implementation step

Add a compact due-date row to both finance renderers and style only the presentation states (`normal`, `near-due`, `overdue`). Keep payment and renewal mutations unchanged.
