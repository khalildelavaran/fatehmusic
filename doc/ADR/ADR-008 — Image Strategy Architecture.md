# ADR-008 — Image Strategy Architecture

**Status:** Accepted

**Version:** 1.0

**Date:** 2026-07-16

**Owners:** Fateh Music Academy Architecture Team

**Related Documents**

- MASTER_ARCHITECTURE.md
- ADR-002 Astro Architecture
- ADR-003 Cloudflare Deployment
- ADR-004 SEO Engine
- ADR-005 Schema Engine
- DESIGN_SYSTEM.md

---

# 1. Summary

This Architecture Decision Record defines the enterprise image architecture for the Fateh Music Academy platform.

Images are treated as structured educational assets rather than decorative files.

Every image contributes simultaneously to

- User Experience
- Performance
- Accessibility
- SEO
- AI Understanding
- Knowledge Graph enrichment
- Brand consistency

Image management therefore becomes an architectural concern.

---

# 2. Context

Music education websites rely heavily on visual communication.

Examples include

- Instruments
- Instructors
- Classrooms
- Concerts
- Educational diagrams
- Student performances
- Gallery images
- Course banners

Without a centralized image strategy,

performance deteriorates,

SEO becomes inconsistent,

and visual quality declines over time.

---

# 3. Problem Statement

Uncontrolled image usage produces

- oversized files
- inconsistent dimensions
- layout shifts
- duplicate assets
- missing alt text
- poor SEO
- weak AI understanding
- inconsistent branding

The platform requires a unified image architecture.

---

# 4. Requirements

The Image Strategy must provide

Functional

- Image optimization
- Responsive delivery
- Metadata management
- Asset organization
- Version control

Architectural

- Repository integration
- SEO integration
- Schema integration
- Framework independence

Non-functional

- Performance
- Accessibility
- Maintainability
- Scalability
- AI readiness

---

# 5. Decision

The project adopts a centralized Image Strategy.

Images are treated as reusable content assets.

All image processing occurs during build.

Components never manipulate raw image files.

---

# 6. Architectural Position

```
Image Repository

↓

Image Metadata

↓

SEO Engine

↓

Schema Engine

↓

Astro Assets

↓

Cloudflare Edge

↓

Browser
```

Every image follows this pipeline.

---

# 7. Image Ownership

Every image belongs to exactly one entity.

Examples

```
Organization

Course

Instructor

Article

Gallery

Event

Instrument
```

Shared usage references the original image.

Duplicate files are prohibited.

---

# 8. Image Metadata

Every image includes

```
id

slug

title

description

alt

caption

copyright

author

createdAt

updatedAt

width

height

format

entityId

entityType
```

Metadata is mandatory.

---

# 9. Alt Text Strategy

Alt text must

Describe the educational content.

Example

Good

```
Instructor teaching classical guitar technique.
```

Poor

```
Image1
```

Keyword stuffing is prohibited.

---

# 10. Caption Strategy

Captions provide educational context.

Example

```
Beginner classical guitar class
at Fateh Music Academy.
```

Captions improve accessibility and semantic understanding.

---

# 11. Supported Formats

Preferred

```
AVIF
```

Fallback

```
WebP
```

Legacy

```
JPEG

PNG
```

Avoid GIF whenever possible.

SVG is preferred for icons and logos.

---

# 12. Astro Assets

All local images should use

```
astro:assets
```

Benefits

Automatic optimization

Responsive images

Dimension inference

Modern formats

Lazy loading support

---

# 13. Responsive Images

Every content image should expose

```
Small

Medium

Large

XL
```

Appropriate image selection occurs automatically.

---

# 14. Image Dimensions

Every image has explicit

Width

Height

Aspect Ratio

Missing dimensions are prohibited.

This prevents

Cumulative Layout Shift (CLS).

---

# 15. Lazy Loading

Default

```
loading="lazy"
```

Exceptions

Logo

Hero Image

Above-the-fold Instructor

Primary Banner

Critical images load eagerly.

---

# 16. Hero Images

Hero images require

Highest resolution

Optimized compression

Preloading

Responsive variants

SEO metadata

Hero images represent the page identity.

---

# 17. Course Images

Every course includes

Primary image

Open Graph image

Social preview

Schema image

Thumbnail

Future video thumbnail

One source serves all consumers.

---

# 18. Instructor Portraits

Portrait standards

Consistent lighting

Neutral background

Professional appearance

Consistent crop

Consistent dimensions

Uniform branding strengthens trust.

---

# 19. Gallery Strategy

Gallery images

should remain independent assets.

Gallery metadata includes

Location

Event

Date

Instructor

Related Course

AI systems gain additional context.

---

# 20. SEO Integration

Images contribute

Image Sitemap

Open Graph

Twitter Card

Canonical relationships

ImageObject Schema

Descriptive filenames

Every image is discoverable.

---

# 21. Schema Integration

Every major image supports

```
ImageObject
```

Properties include

```
contentUrl

caption

width

height

license

creator

representativeOfPage
```

Structured images strengthen the Knowledge Graph.

---

# 22. File Naming

Pattern

```
classical-guitar-course.webp

guitar-instructor-ahmad-rezaei.webp

piano-classroom-01.avif
```

Avoid

```
IMG_4829.jpg

photo2.png

new-image-final.jpg
```

Filenames are permanent.

---

# 23. Folder Structure

```
assets/

images/

organization/

courses/

instructors/

gallery/

articles/

events/

icons/

logos/
```

Folders follow domain boundaries.

---

# 24. Performance Budget

Maximum recommendations

Hero

≤250 KB

Course Image

≤150 KB

Portrait

≤120 KB

Thumbnail

≤50 KB

Icon

≤10 KB

Oversized assets fail review.

---

# 25. AI Optimization

Images include

Descriptive filenames

Alt text

Captions

ImageObject Schema

Related entities

Canonical references

AI systems should understand

what the image represents,

not merely display it.

---

# 26. Accessibility

Every informative image

requires

Alt text

Meaningful context

Keyboard compatibility where interactive

Decorative images use

```
alt=""
```

Accessibility remains mandatory.

---

# 27. Future Compatibility

Prepared for

Cloudflare Images

↓

AI Image Search

↓

Automatic AVIF Generation

↓

Image CDN

↓

Smart Cropping

↓

Face Detection

↓

Semantic Image Search

No architectural redesign required.

---

# 28. Alternatives Considered

### Raw HTML Images

Rejected

Reason

No optimization.

---

### External Image CDN Only

Rejected

Reason

Loss of architectural control.

---

### Manual Image Management

Rejected

Reason

Inconsistent quality.

---

### Runtime Optimization

Rejected

Reason

Build-time optimization is more efficient.

---

# 29. Consequences

Positive

✓ Faster pages

✓ Better SEO

✓ Better AI understanding

✓ Better accessibility

✓ Consistent branding

✓ Smaller bandwidth

✓ Easier maintenance

Negative

• Image preparation requires editorial discipline.

This trade-off is acceptable.

---

# 30. Compliance Rules

Every published image must

✓ Have metadata

✓ Have alt text

✓ Have dimensions

✓ Use optimized formats

✓ Pass performance budget

✓ Support responsive delivery

✓ Integrate with SEO

✓ Integrate with Schema

Architectural violations require correction before publication.

---

# 31. Final Decision

The Image Strategy is adopted as the permanent image architecture for the Fateh Music Academy platform.

Images are treated as structured educational assets that simultaneously support user experience, accessibility, performance, SEO, structured data and AI comprehension.

All future image workflows must comply with this architecture.

---

## Status

Accepted

Mandatory

Effective Immediately