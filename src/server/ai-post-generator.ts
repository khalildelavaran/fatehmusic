import { courses } from "../data/courses.js";

interface GenEnv {
  DB: D1Database;
  AI: Ai;
}

// Shown roughly 1 in 5 times instead of a specific course, for variety.
const GENERAL_TOPICS = [
  "چطور بفهمیم بچه‌مان برای شروع آموزش موسیقی آماده است",
  "تفاوت آموزش حضوری و آنلاین موسیقی و اینکه کدام مناسب‌تر است",
  "نقش موسیقی در تقویت تمرکز، حافظه و اعتماد‌به‌نفس کودکان",
  "چگونه اولین ساز موسیقی مناسب خودمان را انتخاب کنیم",
  "چرا تمرین منظم و کم، مهم‌تر از استعداد ذاتی است",
  "چند اشتباه رایج هنرجویان تازه‌کار موسیقی و راه رفع آن‌ها"
];

// Cloudflare Workers AI enforces this cap on PBKDF2-unrelated things too in
// some edge runtimes, but the real constraint here is just keeping requests
// well inside the free daily Neuron allowance -- one call a day is trivial.
const MODEL = "@cf/zai-org/glm-4.7-flash";

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

type CourseTopic = { kind: "course"; course: (typeof courses)[number] };
type GeneralTopic = { kind: "general"; topic: string };

async function pickTopic(db: D1Database): Promise<CourseTopic | GeneralTopic> {
  const recent = await db
    .prepare("SELECT related_course_slug FROM blog_posts ORDER BY created_at DESC LIMIT 10")
    .all<{ related_course_slug: string | null }>();
  const recentSlugs = new Set(recent.results.map((r) => r.related_course_slug).filter(Boolean));

  const activeCourses = courses.filter((c) => c.active);

  if (activeCourses.length > 0 && Math.random() >= 0.2) {
    const candidates = activeCourses.filter((c) => !recentSlugs.has(c.slug));
    const pool = candidates.length > 0 ? candidates : activeCourses;
    return { kind: "course", course: pool[Math.floor(Math.random() * pool.length)] };
  }

  return { kind: "general", topic: GENERAL_TOPICS[Math.floor(Math.random() * GENERAL_TOPICS.length)] };
}

function buildBrief(pick: CourseTopic | GeneralTopic): string {
  if (pick.kind === "course") {
    const excerpt = (pick.course as any)?.content?.excerpt ?? "";
    return `موضوع مقاله درباره‌ی دوره‌ی «${pick.course.title}» (اسلاگ دوره: ${pick.course.slug}) در آموزشگاه موسیقی فاتح، واقع در شوشتر است. توضیح کوتاه دوره: ${excerpt}`;
  }
  return `موضوع مقاله عمومی درباره‌ی آموزش موسیقی است: «${pick.topic}». مقاله برای وبلاگ آموزشگاه موسیقی فاتح در شوشتر نوشته می‌شود.`;
}

const SYSTEM_PROMPT = `تو یک نویسنده‌ی محتوای حرفه‌ای فارسی‌زبان برای وبلاگ «آموزشگاه موسیقی فاتح» در شوشتر هستی. لحن تو گرم، صمیمی، معتبر و مشوق است و برای والدین و هنرجویان بالقوه می‌نویسی؛ از اغراق و شعار تبلیغاتی خالی پرهیز کن.

خروجی را فقط و فقط به‌صورت یک آبجکت JSON معتبر بازگردان -- بدون هیچ متن اضافه، توضیح، یا Markdown fence قبل یا بعدش -- دقیقاً با این فیلدها:
{
  "title": "عنوان جذاب و کوتاه فارسی",
  "slug": "english-url-slug-with-hyphens-only",
  "excerpt": "خلاصه‌ی دو تا سه جمله‌ای فارسی",
  "content": "متن کامل مقاله به فارسی، حداقل ۵ پاراگراف، پاراگراف‌ها با دو خط جدید (\\n\\n) از هم جدا شوند",
  "topic": "دسته‌بندی کوتاه فارسی (مثلا: آموزش گیتار)",
  "meta_title": "عنوان سئو، زیر ۶۰ کاراکتر",
  "meta_description": "توضیح متای سئو، زیر ۱۵۵ کاراکتر"
}`;

interface ParsedPost {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  topic?: string;
  meta_title?: string;
  meta_description?: string;
}

export async function generateDailyPost(env: GenEnv): Promise<void> {
  if (!env.DB || !env.AI) {
    console.error("generateDailyPost: DB or AI binding missing");
    return;
  }

  const pick = await pickTopic(env.DB);
  const brief = buildBrief(pick);

  let aiResponse: unknown;
  try {
    aiResponse = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brief }
      ],
      max_tokens: 2048
    });
  } catch (err) {
    console.error("generateDailyPost: Workers AI call failed:", err);
    return;
  }

  const raw =
    (aiResponse as any)?.response ??
    (aiResponse as any)?.result?.response ??
    (typeof aiResponse === "string" ? aiResponse : "");
  const cleaned = String(raw).replace(/```json|```/g, "").trim();

  let parsed: ParsedPost;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("generateDailyPost: could not parse AI response as JSON:", cleaned.slice(0, 300));
    return;
  }
  if (!parsed?.title || !parsed?.content) {
    console.error("generateDailyPost: AI response missing title/content");
    return;
  }

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const baseSlug = parsed.slug && /^[a-z0-9-]+$/.test(parsed.slug) ? parsed.slug : slugify(parsed.title);
  const slug = `${baseSlug}-${dateSuffix}`;

  const relatedCourseSlug = pick.kind === "course" ? pick.course.slug : null;
  const relatedCourseTitle = pick.kind === "course" ? pick.course.title : null;

  await env.DB.prepare(
    `INSERT INTO blog_posts (slug, title, excerpt, content, topic, related_course_slug, related_course_title, status, meta_title, meta_description, is_ai_generated)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1)`
  )
    .bind(
      slug,
      parsed.title,
      parsed.excerpt ?? "",
      parsed.content,
      parsed.topic ?? (pick.kind === "course" ? pick.course.title : "عمومی"),
      relatedCourseSlug,
      relatedCourseTitle,
      parsed.meta_title ?? parsed.title,
      parsed.meta_description ?? parsed.excerpt ?? ""
    )
    .run();

  console.log(`generateDailyPost: created draft "${parsed.title}" (${slug})`);
}
