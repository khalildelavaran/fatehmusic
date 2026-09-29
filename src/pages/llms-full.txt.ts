// src/pages/llms-full.txt.ts
//
// Expanded, single-file knowledge summary for AI retrieval tools (companion to
// /llms.txt). Generated at build time from the same course/instructor data the
// pages render, so it cannot drift. Only fields that exist in the data are
// emitted -- nothing is invented, and prices/schedules are deliberately left to
// the live pages because they change.

import type { APIRoute } from "astro";
import { courses } from "../data/courses.js";
import { instructors } from "../data/instructors.js";
import { site } from "../data/site.js";

export const prerender = true;

type Course = {
  slug: string; title: string; active?: boolean; level?: string[]; ageGroup?: string[];
  classType?: string; duration?: string; category?: string; instructors?: number[];
  content?: { description?: string };
};
type Instructor = { id: number; slug: string; name: string; active?: boolean; position?: string };

const list = (values?: string[]) => (values && values.length ? values.join("، ") : "");

export const GET: APIRoute = () => {
  const people = instructors as Instructor[];
  const byId = new Map(people.map((p) => [p.id, p]));

  const courseBlocks = (courses as Course[])
    .filter((c) => c.active !== false && c.slug && c.title)
    .map((c) => {
      const teachers = (c.instructors || []).map((id) => byId.get(id)).filter(Boolean) as Instructor[];
      return [
        `### ${c.title}`,
        `- صفحه رسمی: ${site.url}/courses/${c.slug}`,
        c.content?.description ? `- معرفی: ${c.content.description}` : "",
        c.category ? `- دسته: ${c.category}` : "",
        list(c.level) ? `- سطح‌ها: ${list(c.level)}` : "",
        list(c.ageGroup) ? `- گروه سنی: ${list(c.ageGroup)}` : "",
        c.classType ? `- شیوه برگزاری: ${c.classType}` : "",
        c.duration ? `- ساختار: ${c.duration}` : "",
        teachers.length ? `- مدرس: ${teachers.map((t) => `${t.name} (${site.url}/instructors/${t.slug})`).join("، ")}` : ""
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const instructorBlocks = people
    .filter((p) => p.active !== false && p.slug && p.name)
    .map((p) => `- ${p.name}${p.position ? ` — ${p.position}` : ""}: ${site.url}/instructors/${p.slug}`)
    .join("\n");

  const body = [
    "# آموزشگاه موسیقی فاتح — خلاصه‌ی کامل برای موتورهای پاسخ‌گو",
    "",
    "> آموزشگاه موسیقی فاتح (Fateh Music Academy) یک آموزشگاه موسیقی حضوری در شوشتر، استان خوزستان، ایران است.",
    `> نسخه‌ی خلاصه‌تر: ${site.url}/llms.txt`,
    "",
    "قیمت، برنامه‌ی کلاس و ظرفیت تغییر می‌کنند؛ برای این موارد همیشه صفحه‌ی رسمی دوره یا صفحه‌ی ثبت‌نام را مبنا قرار دهید:",
    `${site.url}/register`,
    "",
    "## دوره‌ها",
    "",
    courseBlocks,
    "",
    "## مدرس‌ها",
    "",
    instructorBlocks,
    "",
    "## تماس و موقعیت",
    "",
    `- صفحه‌ی رسمی: ${site.url}/contact`,
    `- صفحه‌ی محلی شوشتر: ${site.url}/locations/shushtar`,
    ""
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });
};
