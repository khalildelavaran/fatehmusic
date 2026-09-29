// src/pages/llms.txt.ts
//
// /llms.txt is generated at build time from the same course/instructor data the
// site renders, so the AI-facing index can never drift from the real pages.
// The prose lives in src/data/llms-base.txt; only the link lists are generated.
// Only names and canonical URLs are emitted -- no invented facts.

import type { APIRoute } from "astro";
import base from "../data/llms-base.txt?raw";
import { courses } from "../data/courses.js";
import { instructors } from "../data/instructors.js";
import { site } from "../data/site.js";

export const prerender = true;

type Linkable = { slug: string; active?: boolean; title?: string; name?: string };

function links(items: Linkable[], section: string, label: (item: Linkable) => string | undefined): string {
  return items
    .filter((item) => item.active !== false && item.slug && label(item))
    .map((item) => `- ${label(item)}: ${site.url}/${section}/${item.slug}`)
    .join("\n");
}

export const GET: APIRoute = () => {
  const body = base
    .replace("{{COURSE_LINKS}}", links(courses as Linkable[], "courses", (c) => c.title))
    .replace("{{INSTRUCTOR_LINKS}}", links(instructors as Linkable[], "instructors", (i) => i.name));

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });
};
