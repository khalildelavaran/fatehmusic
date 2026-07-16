# CODING_STANDARDS.md

**Version:** 2.0

**Status:** Approved

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

---

# 1. Purpose

This document defines the official coding standards of the Fateh Music Academy platform.

Coding standards are architectural rules rather than stylistic preferences.

Their objectives are

- Readability
- Maintainability
- Predictability
- AI Collaboration
- Code Quality
- Long-Term Stability

Every source file in the project must comply with these standards.

---

# 2. Core Principles

The project follows

- Clean Code
- SOLID
- DRY
- KISS
- YAGNI
- Repository Pattern
- Domain Driven Design
- AI-First Development

Code should express business intent.

---

# 3. General Philosophy

Every file should answer one question only.

Every function should perform one task.

Every component should have one responsibility.

Every repository should own one domain.

---

# 4. Language

Source code

English only.

Business content

Persian or multilingual.

Comments

English only.

---

# 5. File Size

Recommended limits

```
Component

≤200 lines
```

```
Repository

≤350 lines
```

```
Utility

≤150 lines
```

```
Configuration

≤200 lines
```

Large files should be refactored.

---

# 6. Function Size

Ideal

```
10-25 lines
```

Maximum

```
40 lines
```

If longer,

extract private helper functions.

---

# 7. Function Responsibility

Every function should

Do one thing.

Return one result.

Have one purpose.

Avoid multi-purpose functions.

---

# 8. Function Naming

Functions begin with verbs.

Examples

```
getCourse()

buildSchema()

generateSeo()

resolveTeachers()

calculateReadingTime()

validateEntity()
```

Avoid

```
handle()

process()

run()

execute()

doWork()
```

---

# 9. Variables

Variable names

must explain intent.

Good

```
featuredCourses

publishedArticles

courseDuration

teacherName
```

Bad

```
data

list

obj

tmp

value

result
```

---

# 10. Boolean Variables

Always begin with

```
is

has

can

should

will
```

Examples

```
isPublished

hasGallery

canRegister

shouldIndex
```

---

# 11. Constants

Use

UPPER_SNAKE_CASE

```
SITE_URL

DEFAULT_LANGUAGE

MAX_IMAGE_WIDTH

CACHE_DURATION
```

Magic numbers are prohibited.

---

# 12. Objects

Prefer

```
const
```

instead of

```
let
```

Objects should remain immutable whenever possible.

---

# 13. Destructuring

Preferred

```javascript
const {

title,

slug,

seo

} = course;
```

Avoid repetitive property access.

---

# 14. Optional Chaining

Preferred

```javascript
course?.seo?.title
```

Avoid defensive nested conditions.

---

# 15. Nullish Coalescing

Preferred

```javascript
seo.title ?? course.title
```

instead of

```javascript
seo.title || course.title
```

where appropriate.

---

# 16. Arrow Functions

Use

Arrow Functions

for callbacks and utilities.

Use named functions for business logic.

---

# 17. Early Return

Preferred

```javascript
if (!course)

return null;
```

Avoid deep nesting.

---

# 18. Nesting

Maximum

```
3 Levels
```

If nesting exceeds three levels,

extract a function.

---

# 19. Conditionals

Prefer

```javascript
if (isPublished)
```

Avoid

```javascript
if (isPublished === true)
```

Conditions should read naturally.

---

# 20. Switch Statements

Use

```
switch
```

only for

well-defined enums.

Otherwise

prefer lookup objects.

---

# 21. Loops

Preferred order

```
map()

filter()

reduce()

find()

some()

every()
```

Avoid manual loops unless performance requires them.

---

# 22. Async Code

Future standard

```
async

await
```

Never use nested Promise chains.

---

# 23. Error Handling

Business code

throws domain errors.

Never

```
console.log(error)
```

as final error handling.

Use

```
EntityNotFound

ValidationError

RepositoryError
```

---

# 24. Imports

Order

```
Node

↓

Third-party

↓

Configuration

↓

Repositories

↓

Services

↓

Utilities

↓

Components

↓

Styles
```

One blank line between groups.

---

# 25. Export Strategy

Prefer

Named Exports

```javascript
export function

export const
```

Avoid unnecessary default exports.

---

# 26. Comments

Comments explain

Why,

not

What.

Good

```javascript
// Repository guarantees unique slugs.
```

Bad

```javascript
// Increment i.
```

Readable code requires fewer comments.

---

# 27. Documentation

Every public function requires

```
Purpose

Parameters

Returns

Throws
```

Prefer JSDoc.

Example

```javascript
/**
 * Returns a course by slug.
 *
 * @param {string} slug
 *
 * @returns {Course}
 */
```

---

# 28. Components

Components should

Receive Props

Render HTML

Emit Events

Nothing more.

No repositories.

No SEO generation.

No Schema generation.

---

# 29. Repositories

Repositories should

Validate

Resolve

Normalize

Return Business Entities

No HTML.

No Astro.

No CSS.

---

# 30. Utilities

Utilities must remain

Pure Functions.

No side effects.

No global state.

---

# 31. Configuration

Configurations must contain

Static values only.

No executable business logic.

---

# 32. Logging

Allowed

```
console.error()

console.warn()
```

Temporary

```
console.log()
```

must never reach production.

---

# 33. Formatting

Indentation

```
2 Spaces
```

Maximum line length

```
100 characters
```

One statement per line.

Consistent spacing is mandatory.

---

# 34. Naming

Variables

camelCase

Functions

camelCase

Classes

PascalCase

Components

PascalCase

Constants

UPPER_SNAKE_CASE

Folders

lowercase

Routes

kebab-case

---

# 35. CSS Rules

Use

CSS Variables

Avoid

Hardcoded Colors

Inline Styles

!important

Deep Selectors

---

# 36. Performance

Avoid

Unnecessary allocations

Repeated computations

Duplicate rendering

Heavy hydration

Prefer

Static Rendering

Memoization where justified

Build-time computation

---

# 37. Security

Never

Trust external input.

Always

Validate

Normalize

Escape

Sanitize

No secrets inside repositories.

---

# 38. Accessibility

Generated HTML must

Use semantic elements

Provide labels

Provide alt text

Support keyboard navigation

Meet WCAG 2.2 AA.

---

# 39. Git Rules

One logical change

per commit.

Commit messages

```
feat:

fix:

docs:

refactor:

perf:

test:

chore:
```

Follow Conventional Commits.

---

# 40. Pull Request Checklist

Every PR must satisfy

✓ Lint passes

✓ Build passes

✓ No console.log

✓ No dead code

✓ Repository rules respected

✓ Component rules respected

✓ SEO unaffected

✓ Schema unaffected

✓ Accessibility preserved

✓ Documentation updated if required

---

# 41. Code Review Principles

Reviewers verify

Architecture

Naming

Readability

Performance

Accessibility

SEO impact

Security

Business correctness

Code style alone is insufficient.

---

# 42. AI Collaboration Guidelines

Code should be understandable by

Humans

AI Assistants

Static Analysis

Future Contributors

Avoid clever code.

Prefer explicit code.

Business intent must remain obvious.

---

# 43. Refactoring Policy

Refactor whenever

Function grows too large

Responsibilities multiply

Duplication appears

Naming becomes unclear

Complexity increases

Refactoring is encouraged before adding new features.

---

# 44. Definition of Done

A feature is complete only when

✓ Architecture respected

✓ Tests pass

✓ Documentation updated

✓ SEO validated

✓ Schema validated

✓ Accessibility verified

✓ Performance maintained

✓ Naming follows standards

✓ No technical debt introduced

---

# 45. Final Statement

These coding standards establish the official engineering practices for the Fateh Music Academy platform.

All source code must prioritize clarity, architectural consistency and long-term maintainability over individual coding preferences.

The codebase is intended to remain understandable by developers, AI assistants and future maintainers for many years without requiring architectural reinterpretation.

---

## Status

Approved

Mandatory

Effective Immediately