// Article-writing step of the pipeline. Two clearly separated concerns:
//   1. Topic selection: pop the highest-scored row from content_topics
//      (status='approved'); if the queue is empty, fall back to a small
//      random pick so day-one deploys (before anyone has clicked
//      "تولید موضوعات جدید" yet) still produce something reasonable.
//   2. Article writing: Claude only, given a FIXED title -- it writes
//      the body, it does not get to invent or change the title, since
//      that would silently undo the scoring/dedup work from step 1.
//
// Provider history: this used DeepSeek initially (see ADR-011), switched
// to Anthropic's Claude after real-world DeepSeek account/billing
// friction made it unreliable -- see ADR-011's "Amendment" section.

import { courses } from "../../data/courses.js";
import { GENERAL_EVERGREEN_TOPICS } from "../../data/content-engine-seeds";
import { getNextApprovedTopic, getRecentlyUsedCourses, markTopicUsed } from "./db";
import { callClaudeArticle } from "./providers/anthropic";
import type { ContentTopicRow } from "./types";

interface ArticleEnv {
  DB: D1Database;
  ANTHROPIC_API_KEY?: string;
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

// Humanization guidance below is based on real research (Aug 2026) into
// what actually reads as AI-written -- NOT a guess. Two load-bearing
// findings behind this prompt (see ADR-011 amendment for sources):
//   1. Google does not penalize AI-written text as such; it penalizes
//      generic/thin/robotic content at scale (its March 2026 core update
//      explicitly targets "content that appears thin or robotic"). So
//      the goal here is genuinely better, more specific writing -- not
//      "tricking a detector."
//   2. Word-blacklists alone are known to be weak (models drift back to
//      them); what actually works is forcing concrete specificity and
//      varied rhythm, which is why most of the instructions below are
//      about *what to include*, not just *which words to avoid*.
const SYSTEM_PROMPT = `تو یک نویسنده‌ی محتوای حرفه‌ای فارسی‌زبان برای وبلاگ «آموزشگاه موسیقی فاتح» در شوشتر هستی. عنوان مقاله از قبل مشخص شده و دقیقاً همان‌طور که در بریف آمده باید حفظ شود -- آن را عوض نکن.

لحن و شخصیت:
- طوری بنویس که انگار یک مربی واقعی این آموزشگاه که سال‌ها شاگرد دیده، این متن رو نوشته -- نه یک دایره‌المعارف بی‌طرف و نه یک بروشور تبلیغاتی.
- یک نظر یا زاویه‌ی دید مشخص داشته باش (حتی یک جمله‌ی مخالف‌خوان یا یک نکته‌ی غیرمنتظره)، نه فقط جمع‌بندی خنثی از چیزهایی که همه می‌دونن.
- از اغراق، شعار تبلیغاتی، و از هر ادعای آماری یا افتخار ساختگی که در بریف نیامده، جداً پرهیز کن.

برای طبیعی و انسانی خوندن متن (این‌ها مهم‌تر از هر قانون دیگه‌ای هستن):
- طول جمله‌ها رو عمداً متغیر کن: چند جمله‌ی کوتاه و ضربتی کنار جمله‌های بلندتر و روون. تکرار یک ریتم ثابت در کل متن، اولین نشونه‌ی نوشته‌ی ماشینی به‌نظر رسیدنه.
- به‌جای جمله‌های کلی («یادگیری ساز فواید زیادی دارد»)، جزئیات مشخص و ملموس بیار -- یک سناریوی واقعی، یک مثال از یک نوع خاص شاگرد (نه لزوما آماری)، یک نکته‌ی فنی خاص همون ساز.
- ساختار مقاله رو مصنوعی و قرینه نساز (مثلاً همیشه ۳ مورد با طول یکسان). بعضی نکته‌ها رو کوتاه رد کن، روی یکی-دو تا بیشتر مکث کن.
- پاراگراف آخر رو به یک «جمع‌بندی» فرمولیک که کل متن رو خلاصه می‌کنه تبدیل نکن؛ به‌جاش با یک نکته‌ی عملی، یک دعوت طبیعی، یا یک فکر باز تمومش کن.
- از این کلیشه‌های رایج متن‌های تولیدشده با هوش مصنوعی در فارسی به‌طور خاص پرهیز کن: «در دنیای امروز»، «در این راستا»، «شایان ذکر است»، «نقش بسزایی ایفا می‌کند»، «بدون شک/بی‌تردید» به‌عنوان شروع جمله، و استفاده‌ی مکرر از «همچنین» به‌عنوان تنها ابزار اتصال جمله‌ها.
- به‌جای فعل‌ها و عبارات رسمی و پرطمطراق، فعل ساده و مستقیم رو ترجیح بده (مثلاً «کمک می‌کند» به‌جای «نقش بسزایی در ... ایفا می‌کند»).

محدودیت‌های محتوا:
- حداقل ۵ و حداکثر ۸ پاراگراف، پاراگراف‌ها با دو خط جدید (\\n\\n) از هم جدا بشن.
- هیچ آمار، جایزه، یا نقل‌قولی که در بریف نیومده اختراع نکن.`;

function buildBrief(topic: SelectedTopic): string {
  const lines = [`عنوان مقاله (ثابت، تغییر نده): «${topic.title}»`];
  if (topic.relatedCourseTitle) {
    lines.push(`این مقاله باید به دوره‌ی «${topic.relatedCourseTitle}» (اسلاگ: ${topic.relatedCourseSlug}) در آموزشگاه موسیقی فاتح در شوشتر مرتبط باشد.`);
  } else {
    lines.push("این مقاله موضوعی عمومی درباره‌ی آموزش موسیقی است، وبلاگ آموزشگاه موسیقی فاتح در شوشتر.");
  }
  if (topic.excerpt) lines.push(`توضیح کوتاه دوره: ${topic.excerpt}`);
  lines.push("submit_article رو با فیلدهای کامل صدا بزن.");
  return lines.join("\n");
}

export async function runDailyArticleGeneration(env: ArticleEnv): Promise<GenerateResult> {
  console.log("runDailyArticleGeneration: starting");

  if (!env.DB) {
    return { success: false, message: "اتصال دیتابیس برقرار نیست (DB binding یافت نشد)." };
  }
  if (!env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      message: "ANTHROPIC_API_KEY تنظیم نشده است. با دستور `wrangler secret put ANTHROPIC_API_KEY` آن را اضافه کنید."
    };
  }

  const topic = await selectTopic(env.DB);
  console.log("runDailyArticleGeneration: topic selected ->", topic.title, topic.topicRowId ? `(queue #${topic.topicRowId})` : "(fallback)");

  const result = await callClaudeArticle(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT, buildBrief(topic));
  if (!result.success) {
    console.error("runDailyArticleGeneration:", result.message);
    return { success: false, message: result.message };
  }
  const article = result.article;

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const baseSlug = /^[a-z0-9-]+$/.test(article.slug) ? article.slug : slugify(topic.title);
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
        article.excerpt,
        article.content,
        article.topic || topic.topicLabel,
        topic.relatedCourseSlug,
        topic.relatedCourseTitle,
        article.meta_title || topic.title,
        article.meta_description || article.excerpt
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
  return { success: true, message: `پیش‌نویس «${topic.title}» با Claude ساخته شد.`, slug };
}
