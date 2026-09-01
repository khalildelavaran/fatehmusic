# ADR-015 — Official Holidays Do Not Automatically Cancel Classes

## Status
Accepted

## Decision
An official holiday is a calendar exception, not an automatic cancellation command.

The authoritative decision for a class is stored on `ClassSession.status`.

A holiday may therefore produce any of these outcomes:

- class runs normally;
- class is cancelled;
- class is moved to another date/time;
- a makeup session is scheduled.

## Rules

1. `CalendarException` records the calendar fact.
2. `ClassSession` records the operational decision.
3. Session generation must not silently convert a holiday into `CANCELLED`.
4. The daily dashboard must visibly warn the secretary when a session falls on a holiday.
5. A manager/secretary can explicitly keep the session scheduled.
6. If a session is cancelled, the cancellation reason may be `OFFICIAL_HOLIDAY`.
7. A makeup session is a new `ClassSession`; the original session remains part of the audit trail.

## Rationale
The academy may remain open for selected classes on official holidays. Therefore a global holiday calendar cannot be treated as a global closure rule.
