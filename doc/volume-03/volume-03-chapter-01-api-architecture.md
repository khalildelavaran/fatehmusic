<!-- File: docs/volume-03/chapter-01-api-architecture.md -->

# Volume 3 — Chapter 1

# API Architecture

## 1. Purpose

This chapter defines the enterprise API architecture for the AI-driven editorial platform. All APIs SHALL follow these standards.

## 2. Architectural Principles

- REST-first architecture
- Resource-oriented URIs
- Stateless requests
- JSON as default payload
- OpenAPI 3.1 as contract source
- Contract-first development
- Backward-compatible evolution
- Correlation ID on every request

## 3. URL Convention

```
/api/v1/articles
/api/v1/workflows
/api/v1/agents
/api/v1/images
```

## 4. HTTP Methods

| Method | Usage |
|---|---|
| GET | Read |
| POST | Create |
| PUT | Full replace |
| PATCH | Partial update |
| DELETE | Soft delete |

## 5. Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "correlationId": "uuid-v7"
}
```

## 6. Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "...",
    "details": {}
  },
  "correlationId": "uuid-v7"
}
```

## 7. Pagination

Cursor-based pagination is preferred.

## 8. Filtering

Use query parameters.

## 9. Sorting

sort=published_at,-title

## 10. Searching

q=<text>

## 11. Versioning

URI versioning: /api/v1/

## 12. Idempotency

POST endpoints that may retry SHALL support Idempotency-Key.

## 13. Observability

Every request includes:
- Correlation ID
- Request ID
- Execution time
- Audit log

## ADRs

### ADR-101
REST is the primary public API style.

### ADR-102
OpenAPI 3.1 is the single source of truth.

### ADR-103
Every request must include a Correlation ID.

### ADR-104
Cursor pagination is the default pagination strategy.

### ADR-105
APIs must remain backward compatible within the same major version.
