# IMAGE_ENGINE_SPECIFICATION.md

**Version:** 2.0

**Status:** Approved

**Architecture Level:** Enterprise

**Project:** Fateh Music Academy

---

# 1. Purpose

This document defines the architecture of the centralized Image Engine.

The Image Engine is responsible for every image used throughout the Fateh Music Academy platform.

Images are treated as structured assets rather than static files.

The engine guarantees

- Performance
- SEO
- Accessibility
- Responsive Delivery
- AI Readability
- Maintainability

---

# 2. Vision

Every image published on the website should

- Load as fast as possible
- Have semantic meaning
- Improve SEO
- Support Google Images
- Support AI Search
- Support Schema.org
- Scale to future CDN providers

Images are considered first-class business assets.

---

# 3. Architectural Position

```
Image Assets

↓

Image Engine

↓

SEO Engine

↓

Schema Engine

↓

Components

↓

Astro

↓

Cloudflare CDN
```

Images never bypass the Image Engine.

---

# 4. Responsibilities

The Image Engine owns

✓ Image Metadata

✓ Responsive Images

✓ Alt Text

✓ Image Selection

✓ Image Optimization

✓ Lazy Loading

✓ Preloading

✓ Width Calculation

✓ Height Calculation

✓ Image Formats

✓ AI Metadata

✓ Image URLs

---

# 5. Non Responsibilities

Image Engine never

Render HTML

Generate Components

Generate SEO

Generate Schema

Manage Routing

Store Business Data

Edit Images

---

# 6. Supported Formats

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

Never use

```
BMP

TIFF

GIF
```

Except where animation is required.

---

# 7. Folder Structure

```
assets/

images/

organization/

courses/

teachers/

gallery/

blog/

events/

music-styles/

instruments/

seo/

icons/

logos/
```

Folders represent business domains.

---

# 8. Image Metadata

Every image contains

```
id

filename

title

alt

caption

width

height

format

copyright

license

author

entityId

entityType
```

Metadata is mandatory.

---

# 9. Alt Text Strategy

Priority

```
Custom Alt

↓

Generated Alt

↓

Entity Title
```

Rules

- Descriptive
- Context-aware
- Human-readable
- Unique where practical

Keyword stuffing is prohibited.

---

# 10. Naming Convention

File names

```
lowercase

kebab-case
```

Examples

```
classical-guitar-course.avif

guitar-teacher-fatemeh-ahmadi.webp

music-theory-book.jpg
```

No spaces.

No Persian filenames.

---

# 11. Responsive Images

Standard widths

```
320

480

640

768

960

1200

1600

1920
```

The browser selects the appropriate source.

---

# 12. Aspect Ratios

Supported

```
1:1

4:3

3:2

16:9

21:9
```

Avoid arbitrary cropping.

---

# 13. Image Sizes

Categories

```
Thumbnail

Card

Gallery

Hero

Banner

Social Preview

Full Resolution
```

Each category has predefined dimensions.

---

# 14. Optimization Pipeline

```
Original

↓

Resize

↓

Compress

↓

AVIF

↓

WebP

↓

Validation

↓

Deployment
```

The pipeline is fully automated.

---

# 15. Lazy Loading

Default

```html
loading="lazy"
```

Exceptions

Hero Image

Logo

LCP Image

These use eager loading.

---

# 16. Preloading

Only

Largest Contentful Paint (LCP)

image may be preloaded.

Avoid unnecessary preloads.

---

# 17. Priority Rules

Priority order

```
Hero

↓

Course Cover

↓

Instructor

↓

Gallery

↓

Article

↓

Decorative
```

Critical images load first.

---

# 18. Decorative Images

Decorative images

must use

```
alt=""
```

They should not be indexed.

---

# 19. Schema Integration

Every representative image generates

```
ImageObject
```

Fields

```
URL

Width

Height

Caption

RepresentativeOfPage

License
```

---

# 20. SEO Integration

SEO Engine receives

```
Representative Image

↓

Open Graph

↓

Twitter Card

↓

Meta Image
```

Images are selected centrally.

---

# 21. AI Metadata

Every image supports

```
Entity Type

Topic

Category

Keywords

Relationships
```

Prepared for future AI indexing.

---

# 22. CDN Strategy

Current

```
Cloudflare
```

Future

```
Cloudflare Images

Image Resizing

R2

External CDN
```

No architectural changes required.

---

# 23. Validation

Every image must satisfy

✓ Width

✓ Height

✓ Alt Text

✓ Valid Format

✓ Metadata

✓ File Name

✓ Compression

Validation failures stop deployment.

---

# 24. Performance Targets

Hero image

```
<200 KB
```

Cards

```
<100 KB
```

Thumbnails

```
<50 KB
```

Icons

```
<10 KB
```

Images should be as small as possible without visible quality loss.

---

# 25. Accessibility

Every meaningful image

requires

✓ Alt Text

✓ Correct Contrast (if text overlays)

✓ Keyboard accessibility where interactive

Images must not convey essential information by visuals alone.

---

# 26. Security

Never expose

Original editing files

PSD

AI

RAW

Private metadata

GPS EXIF

Sensitive information

Only optimized public assets are deployed.

---

# 27. Testing

Required tests

✓ Responsive images

✓ Alt text

✓ File size

✓ Broken links

✓ LCP optimization

✓ Lazy loading

✓ ImageObject Schema

Coverage is mandatory for critical assets.

---

# 28. Future Compatibility

Prepared for

```
Cloudflare Images

↓

Automatic Cropping

↓

Face Detection

↓

AI Image Tagging

↓

Vector Search

↓

Visual Search

↓

Image Embeddings
```

No redesign required.

---

# 29. Governance

Changes affecting

Formats

Optimization

Responsive widths

Metadata

CDN strategy

require architectural approval.

---

# 30. Compliance Rules

Every published image must

✓ Be optimized

✓ Have metadata

✓ Have alt text

✓ Generate ImageObject

✓ Support responsive delivery

✓ Pass validation

✓ Be associated with a business entity

No image may bypass the Image Engine.

---

# 31. Final Statement

The Image Engine is the centralized image management subsystem of the Fateh Music Academy platform.

It ensures that every published image is performant, accessible, semantically meaningful and optimized for users, search engines and AI systems while remaining independent of rendering technologies.

---

## Status

Approved

Mandatory

Effective Immediately