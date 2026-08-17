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

function extractJson(raw: string): string | null {
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  // Fast path: the whole cleaned string parses directly.
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // fall through
  }
  // Fallback: the model added text before/after the JSON object -- grab the
  // first balanced {...} block instead of giving up.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = cleaned.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export interface GenerateResult {
  success: boolean;
  message: string;
  slug?: string;
}

export async function generateDailyPost(env: GenEnv): Promise<GenerateResult> {
  console.log("generateDailyPost: starting");

  if (!env.DB || !env.AI) {
    const message = `اتصال دیتابیس یا هوش مصنوعی برقرار نیست (DB: ${!!env.DB}, AI: ${!!env.AI}). باید binding مربوطه در wrangler.jsonc تنظیم و دیپلوی شده باشد.`;
    console.error("generateDailyPost:", message);
    return { success: false, message };
  }

  const pick = await pickTopic(env.DB);
  const brief = buildBrief(pick);
  console.log("generateDailyPost: topic picked ->", pick.kind === "course" ? pick.course.slug : pick.topic);

  let aiResponse: unknown;
  try {
    aiResponse = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: brief }
      ],
      max_tokens: 8192
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("generateDailyPost: Workers AI call failed:", detail);
    return { success: false, message: `فراخوانی Workers AI شکست خورد: ${detail}` };
  }

  const choice = (aiResponse as any)?.choices?.[0];
  const raw =
    choice?.message?.content ??
    (aiResponse as any)?.response ??
    (aiResponse as any)?.result?.response ??
    (typeof aiResponse === "string" ? aiResponse : "");

  if (!raw) {
    const finishReason = choice?.finish_reason ?? "نامشخص";
    const reasoningPreview = String(choice?.message?.reasoning ?? "").slice(0, 200);
    console.error("generateDailyPost: empty content. finish_reason:", finishReason, "reasoning preview:", reasoningPreview);
    return {
      success: false,
      message: `پاسخ هوش مصنوعی خالی بود (content=null). دلیل توقف: ${finishReason}${finishReason === "length" ? " -- یعنی توکن‌ها قبل از رسیدن به جواب نهایی تمام شد." : ""}. ابتدای reasoning: ${reasoningPreview || "(خالی)"}`
    };
  }

  const jsonText = extractJson(String(raw));
  if (!jsonText) {
    const detail = String(raw).slice(0, 400);
    console.error("generateDailyPost: could not extract JSON from AI response. Raw output (first 800 chars):", String(raw).slice(0, 800));
    return { success: false, message: `خروجی هوش مصنوعی JSON معتبر نبود. ابتدای خروجی: ${detail}` };
  }

  let parsed: ParsedPost;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("generateDailyPost: JSON.parse failed even after extraction:", detail);
    return { success: false, message: `خطای parse کردن JSON: ${detail}` };
  }
  if (!parsed?.title || !parsed?.content) {
    const detail = JSON.stringify(parsed).slice(0, 300);
    console.error("generateDailyPost: parsed JSON missing title/content:", detail);
    return { success: false, message: `پاسخ فاقد فیلد title یا content بود: ${detail}` };
  }

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const baseSlug = parsed.slug && /^[a-z0-9-]+$/.test(parsed.slug) ? parsed.slug : slugify(parsed.title);
  const slug = `${baseSlug}-${dateSuffix}`;

  const relatedCourseSlug = pick.kind === "course" ? pick.course.slug : null;
  const relatedCourseTitle = pick.kind === "course" ? pick.course.title : null;

  try {
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("generateDailyPost: D1 insert failed:", detail, "slug was:", slug);
    return { success: false, message: `ذخیره در دیتابیس شکست خورد: ${detail}` };
  }

  console.log(`generateDailyPost: created draft "${parsed.title}" (${slug})`);
  return { success: true, message: `پیش‌نویس «${parsed.title}» ساخته شد.`, slug };
}
