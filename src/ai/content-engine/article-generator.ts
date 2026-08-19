// Replaces the old ai-post-generator.ts. Two clearly separated steps:
//   1. Topic selection: pop the highest-scored row from content_topics
//      (status='approved'); if the queue is empty, fall back to a small
//      random pick so day-one deploys (before anyone has clicked
//      "تولید موضوعات جدید" yet) still produce something reasonable.
//   2. Article writing: DeepSeek only, given a FIXED title -- it writes
//      the body, it does not get to invent or change the title, since
//      that would silently undo the scoring/dedup work from step 1.
//
// See doc/ADR/ADR-011 — Content Intelligence Engine.md.

import { courses } from "../../data/courses.js";
import { GENERAL_EVERGREEN_TOPICS } from "../../data/content-engine-seeds";
import { getNextApprovedTopic, getRecentlyUsedCourses, markTopicUsed } from "./db";
import { callDeepSeekJson } from "./providers/deepseek";
import type { ContentTopicRow } from "./types";

interface ArticleEnv {
  DB: D1Database;
  DEEPSEEK_API_KEY?: string;
}

export interface GenerateResult {
  success: boolean;
  message: string;
  slug?: string;
}

interface CourseLike {
  slug: string;
  title: string;
  active: boolean;
  content?: { excerpt?: string };
}

interface SelectedTopic {
  topicRowId: number | null; // null when it came from the legacy fallback, not the queue
  title: string;
  relatedCourseSlug: string | null;
  relatedCourseTitle: string | null;
  excerpt: string;
  topicLabel: string;
}

function slugify(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return base || `post-${Date.now()}`;
}

async function pickFallbackTopic(db: D1Database): Promise<SelectedTopic> {
  const recentSlugs = await getRecentlyUsedCourses(db, 10);
  const activeCourses = (courses as CourseLike[]).filter((c) => c.active);

  if (activeCourses.length > 0 && Math.random() >= 0.2) {
    const candidates = activeCourses.filter((c) => !recentSlugs.has(c.slug));
    const pool = candidates.length > 0 ? candidates : activeCourses;
    const course = pool[Math.floor(Math.random() * pool.length)];
    return {
      topicRowId: null,
      title: course.title,
      relatedCourseSlug: course.slug,
      relatedCourseTitle: course.title,
      excerpt: course.content?.excerpt ?? "",
      topicLabel: course.title
    };
  }

  const topic = GENERAL_EVERGREEN_TOPICS[Math.floor(Math.random() * GENERAL_EVERGREEN_TOPICS.length)];
  return { topicRowId: null, title: topic, relatedCourseSlug: null, relatedCourseTitle: null, excerpt: "", topicLabel: "عمومی" };
}

async function selectTopic(db: D1Database): Promise<SelectedTopic> {
  const queued: ContentTopicRow | null = await getNextApprovedTopic(db);
  if (queued) {
    return {
      topicRowId: queued.id,
      title: queued.title,
      relatedCourseSlug: queued.related_course_slug,
      relatedCourseTitle: queued.related_course_title,
      excerpt: "",
      topicLabel: queued.category ?? queued.related_course_title ?? "عمومی"
    };
  }
  return pickFallbackTopic(db);
}

const SYSTEM_PROMPT = `تو یک نویسنده‌ی محتوای حرفه‌ای فارسی‌زبان برای وبلاگ «آموزشگاه موسیقی فاتح» در شوشتر هستی. لحن تو گرم، صمیمی، معتبر و مشوق است و برای والدین و هنرجویان بالقوه می‌نویسی؛ از اغراق و شعار تبلیغاتی و از ادعاهای آماری یا افتخارات ساختگی که در بریف نیامده پرهیز کن.

عنوان مقاله از قبل مشخص شده و دقیقاً همان‌طور که در بریف آمده باید حفظ شود -- آن را عوض نکن.

خروجی را فقط و فقط به‌صورت یک آبجکت JSON معتبر بازگردان -- بدون هیچ متن اضافه، توضیح، یا Markdown fence قبل یا بعدش -- دقیقاً با این فیلدها:
{
  "slug": "english-url-slug-with-hyphens-only",
  "excerpt": "خلاصه‌ی دو تا سه جمله‌ای فارسی",
  "content": "متن کامل مقاله به فارسی، حداقل ۵ پاراگراف، پاراگراف‌ها با دو خط جدید (\\n\\n) از هم جدا شوند",
  "topic": "دسته‌بندی کوتاه فارسی (مثلا: آموزش گیتار)",
  "meta_title": "عنوان سئو، زیر ۶۰ کاراکتر",
  "meta_description": "توضیح متای سئو، زیر ۱۵۵ کاراکتر"
}`;

function buildBrief(topic: SelectedTopic): string {
  const lines = [`عنوان مقاله (ثابت، تغییر نده): «${topic.title}»`];
  if (topic.relatedCourseTitle) {
    lines.push(`این مقاله باید به دوره‌ی «${topic.relatedCourseTitle}» (اسلاگ: ${topic.relatedCourseSlug}) در آموزشگاه موسیقی فاتح در شوشتر مرتبط باشد.`);
  } else {
    lines.push("این مقاله موضوعی عمومی درباره‌ی آموزش موسیقی است، وبلاگ آموزشگاه موسیقی فاتح در شوشتر.");
  }
  if (topic.excerpt) lines.push(`توضیح کوتاه دوره: ${topic.excerpt}`);
  return lines.join("\n");
}

interface ParsedArticle {
  slug?: string;
  excerpt?: string;
  content: string;
  topic?: string;
  meta_title?: string;
  meta_description?: string;
}

export async function runDailyArticleGeneration(env: ArticleEnv): Promise<GenerateResult> {
  console.log("runDailyArticleGeneration: starting");

  if (!env.DB) {
    return { success: false, message: "اتصال دیتابیس برقرار نیست (DB binding یافت نشد)." };
  }
  if (!env.DEEPSEEK_API_KEY) {
    return {
      success: false,
      message: "DEEPSEEK_API_KEY تنظیم نشده است. با دستور `wrangler secret put DEEPSEEK_API_KEY` آن را اضافه کنید."
    };
  }

  const topic = await selectTopic(env.DB);
  console.log("runDailyArticleGeneration: topic selected ->", topic.title, topic.topicRowId ? `(queue #${topic.topicRowId})` : "(fallback)");

  const result = await callDeepSeekJson(env.DEEPSEEK_API_KEY, SYSTEM_PROMPT, buildBrief(topic));
  if (!result.success) {
    console.error("runDailyArticleGeneration:", result.message);
    return { success: false, message: result.message };
  }

  let parsed: ParsedArticle;
  try {
    parsed = JSON.parse(result.content);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { success: false, message: `خطای parse کردن JSON: ${detail}` };
  }
  if (!parsed?.content) {
    return { success: false, message: `پاسخ فاقد فیلد content بود: ${JSON.stringify(parsed).slice(0, 300)}` };
  }

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const baseSlug = parsed.slug && /^[a-z0-9-]+$/.test(parsed.slug) ? parsed.slug : slugify(topic.title);
  const slug = `${baseSlug}-${dateSuffix}`;

  let insertedId: number;
  try {
    const insertResult = await env.DB.prepare(
      `INSERT INTO blog_posts (slug, title, excerpt, content, topic, related_course_slug, related_course_title, status, meta_title, meta_description, is_ai_generated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1)`
    )
      .bind(
        slug,
        topic.title,
        parsed.excerpt ?? "",
        parsed.content,
        parsed.topic ?? topic.topicLabel,
        topic.relatedCourseSlug,
        topic.relatedCourseTitle,
        parsed.meta_title ?? topic.title,
        parsed.meta_description ?? parsed.excerpt ?? ""
      )
      .run();
    insertedId = Number(insertResult.meta.last_row_id);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { success: false, message: `ذخیره در دیتابیس شکست خورد: ${detail}` };
  }

  if (topic.topicRowId) {
    await markTopicUsed(env.DB, topic.topicRowId, insertedId).catch((err) =>
      console.error("runDailyArticleGeneration: failed to mark topic used (non-fatal):", err)
    );
  }

  console.log(`runDailyArticleGeneration: created draft "${topic.title}" (${slug})`);
  return { success: true, message: `پیش‌نویس «${topic.title}» با DeepSeek ساخته شد.`, slug };
}
