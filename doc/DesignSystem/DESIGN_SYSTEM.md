# DESIGN_SYSTEM.md

**Version:** 1.0

**Status:** Approved

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

---

# 1. Purpose

This document defines the official Design System for the Fateh Music Academy platform.

The Design System is not merely a UI guideline.

It is the visual architecture of the platform.

It guarantees consistency across

- Website
- Future Student Portal
- Instructor Portal
- Administration Panel
- Progressive Web App
- Mobile Applications

Every visual element must conform to this specification.

---

# 2. Design Philosophy

The visual identity reflects

- Professional Music Education
- Trust
- Elegance
- Simplicity
- Performance
- Accessibility
- Timeless Design

The interface should never feel decorative.

Every visual decision must support usability.

---

# 3. Core Principles

The Design System follows

- Minimalism
- Content First
- Accessibility First
- Performance First
- Mobile First
- AI Friendly
- Component Driven

Visual consistency has higher priority than visual creativity.

---

# 4. Design Tokens

Every visual property originates from Design Tokens.

```
Colors

Typography

Spacing

Radius

Shadow

Opacity

Animation

Border

Breakpoints

Z-Index
```

Hardcoded values are prohibited.

---

# 5. Color System

The palette contains

```
Primary

Secondary

Accent

Success

Warning

Danger

Info

Neutral

Background

Surface

Border

Text
```

Each color includes

```
50

100

200

300

400

500

600

700

800

900
```

No arbitrary colors.

---

# 6. Typography

Typography hierarchy

```
Display

Heading 1

Heading 2

Heading 3

Heading 4

Heading 5

Heading 6

Body Large

Body

Body Small

Caption

Overline
```

Every size is predefined.

---

# 7. Font Strategy

Primary Font

```
Vazirmatn
```

Fallback

```
system-ui

Segoe UI

Tahoma

Arial

sans-serif
```

Future English typography

```
Inter
```

Typography remains centralized.

---

# 8. Spacing Scale

Official spacing

```
4

8

12

16

20

24

32

40

48

56

64

80

96

128
```

All spacing derives from this scale.

---

# 9. Border Radius

Standard values

```
0

4

8

12

16

24

32

9999
```

Rounded values remain consistent.

---

# 10. Shadow System

Levels

```
None

XS

SM

MD

LG

XL

2XL
```

No custom shadows.

---

# 11. Elevation

Hierarchy

```
Background

↓

Surface

↓

Card

↓

Dropdown

↓

Modal

↓

Tooltip
```

Every elevation level maps to predefined shadows.

---

# 12. Layout Grid

Desktop

```
12 Columns
```

Tablet

```
8 Columns
```

Mobile

```
4 Columns
```

Grid remains consistent across layouts.

---

# 13. Breakpoints

Official breakpoints

```
xs

sm

md

lg

xl

2xl
```

Example

```
480

768

1024

1280

1536

1920
```

Only official breakpoints may be used.

---

# 14. Containers

Container widths

```
Small

Medium

Large

XL

Full
```

Content width remains predictable.

---

# 15. Icons

Official icon system

```
Lucide
```

Requirements

- SVG only
- Consistent stroke
- Accessible
- Scalable

PNG icons are prohibited.

---

# 16. Buttons

Variants

```
Primary

Secondary

Outline

Ghost

Link

Danger

Success
```

Sizes

```
XS

SM

MD

LG

XL
```

Every button follows one specification.

---

# 17. Form Controls

Standard controls

```
Input

Textarea

Select

Checkbox

Radio

Toggle

Date Picker

Button
```

Shared styling across the platform.

---

# 18. Cards

Standard card types

```
Course

Instructor

Article

Gallery

Review

Feature

Statistics
```

Cards share

Spacing

Radius

Shadow

Hover behavior

---

# 19. Navigation

Navigation includes

```
Header

Main Navigation

Breadcrumb

Sidebar

Pagination

Footer Navigation
```

Interaction remains consistent.

---

# 20. Motion System

Animation durations

```
100 ms

150 ms

200 ms

300 ms

500 ms
```

Animations should

Support understanding,

not decoration.

---

# 21. Accessibility

The Design System requires

✓ WCAG 2.2 AA

✓ Visible Focus

✓ Keyboard Navigation

✓ Reduced Motion

✓ High Contrast

✓ Screen Reader Compatibility

Accessibility is non-negotiable.

---

# 22. Dark Mode

Supported themes

```
Light

Dark

System
```

Theme switching relies exclusively on Design Tokens.

No duplicate stylesheets.

---

# 23. RTL Support

The platform is RTL-first.

Requirements

```
Logical Properties

Inline Start

Inline End

Block Start

Block End
```

Avoid left/right-specific styling.

---

# 24. Responsive Strategy

Every component supports

```
Mobile

Tablet

Desktop

Wide Screen
```

No desktop-first layouts.

---

# 25. CSS Architecture

Preferred hierarchy

```
Design Tokens

↓

CSS Variables

↓

Global Styles

↓

Layout Styles

↓

Component Styles

↓

Utility Classes
```

Specificity should remain low.

---

# 26. Performance Guidelines

Avoid

- Large CSS bundles
- Deep selectors
- Unused styles
- Runtime styling

Prefer

- Scoped CSS
- CSS Variables
- Static extraction

---

# 27. Asset Standards

Images

```
AVIF

WebP
```

Icons

```
SVG
```

Logos

```
SVG
```

Fonts

```
WOFF2
```

No unoptimized assets.

---

# 28. AI & Future Compatibility

The Design System is prepared for

- Astro Components
- Web Components
- Mobile Applications
- Design Tokens Export
- Figma Variables
- Storybook
- AI-assisted UI generation

A single source of visual truth is maintained.

---

# 29. Governance

Changes to

Colors

Typography

Spacing

Grid

Breakpoints

Components

Tokens

require architectural review.

The Design System is a controlled specification.

---

# 30. Compliance Rules

Every Pull Request must satisfy

✓ Official color palette

✓ Official spacing scale

✓ Official typography

✓ Responsive layout

✓ Accessible interaction

✓ Component consistency

✓ Token usage

Hardcoded visual values are prohibited.

---

# 31. Future Evolution

Planned additions

```
Design Tokens JSON

Figma Token Sync

Storybook Documentation

Theme Generator

Brand Variants

Motion Library

Accessibility Audit Automation
```

The architecture supports these without redesign.

---

# 32. Final Statement

The Design System defines the permanent visual language of the Fateh Music Academy platform.

All interfaces, components and future products must derive their appearance from this system.

Consistency, accessibility, performance and maintainability take precedence over individual implementation preferences.

---

## Status

Approved

Mandatory

Effective Immediately