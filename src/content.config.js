import { defineCollection, z } from "astro:content";

/* -------------------------------------------------------------------------- */
/*                                  Courses                                   */
/* -------------------------------------------------------------------------- */

const courses = defineCollection({
  type: "content",

  schema: z.object({
    // Identity
    id: z.string(),
    slug: z.string(),

    // Basic Information
    title: z.string(),
    subtitle: z.string().optional(),

    excerpt: z.string(),

    description: z.string(),

    // Classification
    category: z.string(),

    instructors: z.array(z.string()).min(1),

    level: z.enum([
      "beginner",
      "elementary",
      "intermediate",
      "advanced",
      "professional",
    ]),

    ageGroup: z.enum([
      "child",
      "teen",
      "adult",
      "all",
    ]),

    // Course Details
    duration: z.string(),

    sessions: z.number().int().positive(),

    price: z.number().nonnegative(),

    currency: z.string().default("IRR"),

    // Images
    cover: z.string(),

    gallery: z.array(z.string()).default([]),

    // Features
    trialSession: z.boolean().default(false),

    certificate: z.object({
      available: z.boolean(),

      name: z.string(),

      issuer: z.string().default("Fateh Music Academy"),

      verification: z.object({
        enabled: z.boolean().default(false),

        qrCode: z.boolean().default(false),

        uniqueId: z.boolean().default(false),
      }),
    }),

    onlineAvailable: z.boolean().default(false),

    // Content
    requirements: z.array(z.string()).default([]),

    outcomes: z.array(z.string()).default([]),

    syllabus: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    ).default([]),

    faq: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    ).default([]),

    // Relationships
    relatedCourses: z.array(z.string()).default([]),

    tags: z.array(z.string()).default([]),

    // Status
    featured: z.boolean().default(false),

    published: z.boolean().default(true),

    order: z.number().default(999),

    // Dates
    createdAt: z.date(),

    updatedAt: z.date(),

    // SEO
    seo: z.object({
      title: z.string(),

      description: z.string(),

      keywords: z.array(z.string()).default([]),

      canonical: z.string().optional(),

      image: z.string().optional(),

      noindex: z.boolean().default(false),

      nofollow: z.boolean().default(false),
    }),
  }),
});

/* -------------------------------------------------------------------------- */

export const collections = {
  courses,
};