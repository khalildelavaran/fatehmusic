# ADR-003 — Cloudflare Deployment Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-001 Repository Pattern
- ADR-002 Astro Architecture
- DEPLOYMENT_RUNBOOK.md
- SECURITY_RUNBOOK.md

---

# 1. Summary

This Architecture Decision Record defines Cloudflare as the official deployment platform for the Fateh Music Academy website.

Cloudflare was selected because it aligns with the project's core objectives:

- Global edge delivery
- Extremely low latency
- Enterprise-grade security
- Excellent SEO performance
- Native Astro support
- High availability
- Future AI scalability

Cloudflare is considered an infrastructure platform rather than merely a hosting provider.

---

# 2. Context

The website is intended to become a long-term educational platform with

- thousands of pages
- extensive structured data
- AI-readable content
- global accessibility
- minimal operational overhead

The infrastructure therefore must prioritize

Performance

Security

Scalability

Reliability

Automation

---

# 3. Problem Statement

Traditional shared hosting introduces

- slow response times
- inconsistent caching
- limited scalability
- manual deployments
- weaker security
- higher operational complexity

These limitations conflict with the project's long-term architecture.

---

# 4. Requirements

Infrastructure must provide

Functional

- Static hosting
- Continuous deployment
- HTTPS
- Custom domains
- Build automation

Non-functional

- Global CDN
- Edge caching
- DDoS protection
- Low latency
- High availability
- Fast rollback

Future

- Edge Functions
- KV Storage
- Vector Database
- Durable Objects
- AI Gateway

---

# 5. Decision

Cloudflare becomes the official deployment platform.

All production deployments originate from Git.

Manual production uploads are prohibited.

Deployment is automated.

---

# 6. Infrastructure Overview

```
Developer

↓

Git

↓

GitHub

↓

Cloudflare Build

↓

Astro Build

↓

Edge Network

↓

Visitors
```

Production artifacts are immutable.

---

# 7. Source of Truth

Git Repository is the only source of truth.

Production never contains

manual edits.

Every change must exist inside Git history.

---

# 8. Deployment Strategy

Development

↓

Feature Branch

↓

Pull Request

↓

Review

↓

Merge

↓

Automatic Build

↓

Production

No FTP deployment.

No manual file replacement.

---

# 9. Build Process

```
GitHub

↓

Install Dependencies

↓

Astro Build

↓

Static Assets

↓

Validation

↓

Deployment

↓

Edge Cache
```

The build must be deterministic.

---

# 10. Branch Strategy

```
main

Production

develop

Integration

feature/*

Features

hotfix/*

Critical Fixes

release/*

Optional
```

Only **main** deploys to production.

---

# 11. Environment Separation

Production

```
production
```

Preview

```
preview
```

Development

```
localhost
```

Each environment maintains independent configuration.

---

# 12. Configuration Management

Public configuration

```
Site URL

Brand

Language

Theme
```

Private configuration

```
API Keys

Secrets

Tokens

Analytics IDs

Future CMS Keys
```

Private configuration never enters Git.

---

# 13. Environment Variables

Managed exclusively through Cloudflare.

Examples

```
PUBLIC_SITE_URL

PUBLIC_BRAND_NAME

CONTACT_EMAIL

GOOGLE_SITE_VERIFICATION

BING_SITE_VERIFICATION

TURNSTILE_SITE_KEY

TURNSTILE_SECRET

FUTURE_API_KEY
```

Secrets remain encrypted.

---

# 14. DNS Architecture

Cloudflare DNS is authoritative.

Responsibilities

- Domain management
- SSL
- Proxy
- Caching
- Security

DNS changes require architectural review.

---

# 15. SSL Policy

Mandatory

TLS 1.3

Always HTTPS

HSTS

Automatic Renewal

Redirect HTTP → HTTPS

No insecure endpoints.

---

# 16. Edge Cache Strategy

Static assets

Long Cache

HTML

Smart Cache

Images

Edge Optimized

Fonts

Long Cache

Repository data is compiled into static HTML.

---

# 17. Cache Invalidation

Deployment

↓

Automatic Purge

↓

Edge Refresh

↓

Visitors Receive Latest Version

Manual purge is exceptional.

---

# 18. Asset Optimization

Cloudflare delivers

Compression

Brotli

HTTP/3

TLS Optimization

Global CDN

Image Delivery (Future)

No custom optimization layer required.

---

# 19. Security Layer

Cloudflare provides

WAF

↓

DDoS Protection

↓

Rate Limiting

↓

Bot Detection

↓

TLS

↓

Firewall Rules

Application security remains separate.

---

# 20. Performance Targets

Target metrics

TTFB

<200 ms

Global Cache Hit

>95%

Lighthouse

100

Core Web Vitals

Excellent

These values guide infrastructure decisions.

---

# 21. Rollback Strategy

Every deployment is immutable.

Rollback process

```
Select Previous Deployment

↓

Redeploy

↓

Cache Refresh

↓

Production Restored
```

Rollback should complete within minutes.

---

# 22. Monitoring

Monitor

Deployment Success

Build Duration

Cache Ratio

Bandwidth

Requests

Errors

Availability

Analytics

Future alerting integrates with operational dashboards.

---

# 23. Logging

Production logs should include

Build events

Deployment history

Runtime errors

Security events

Performance metrics

Sensitive information must never be logged.

---

# 24. Disaster Recovery

Recovery assets

Git Repository

↓

Cloudflare Configuration

↓

Environment Variables

↓

Documentation

↓

Domain

↓

Backups (Future)

Recovery target

Less than one hour.

---

# 25. Future Services

Architecture is prepared for

Cloudflare Workers

↓

Cloudflare KV

↓

R2 Storage

↓

Vectorize

↓

Queues

↓

Durable Objects

↓

AI Gateway

↓

Images

↓

Analytics Engine

These services integrate without changing the architecture.

---

# 26. Alternatives Considered

### GitHub Pages

Rejected

No integrated edge platform.

---

### Netlify

Rejected

Excellent platform, but Cloudflare provides stronger edge infrastructure and future AI services.

---

### Vercel

Rejected

Outstanding for SSR applications, but Cloudflare better aligns with the project's static-first and edge-first strategy.

---

### Traditional VPS

Rejected

Higher operational overhead and infrastructure maintenance.

---

### Shared Hosting

Rejected

Insufficient scalability, automation and security.

---

# 27. Consequences

Positive

✓ Global edge delivery

✓ Enterprise-grade security

✓ Automatic deployments

✓ Excellent SEO performance

✓ Low operational cost

✓ Future AI infrastructure

✓ Native Astro support

Negative

• Platform-specific deployment knowledge is required.

• Environment variables must be managed carefully.

These trade-offs are acceptable.

---

# 28. Compliance Rules

Every production deployment must satisfy

✓ Build succeeds

✓ Tests pass

✓ SEO validation passes

✓ Schema validation passes

✓ No security regressions

✓ No performance regressions

✓ Version documented

Deployment is blocked if mandatory checks fail.

---

# 29. Final Decision

Cloudflare is adopted as the permanent deployment platform for the Fateh Music Academy website.

Its global edge architecture, security capabilities and future AI infrastructure align with the long-term vision of building an enterprise-grade educational knowledge platform.

Infrastructure decisions should continue to prioritize automation, reproducibility and edge-native delivery.

---

## Status

Accepted

Mandatory

Effective Immediately