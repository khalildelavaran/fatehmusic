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
import { claimNextApprovedTopic, getExistingTitleIndex, getRecentlyUsedCourses, releaseGeneratingTopic } from "./db";
import { callClaudeArticle } from "./providers/anthropic";
import { createSeoAction } from "../../seo/v2/seo-action-store.js";
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
  scoreTotal: number | null;
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
  const [recentSlugs, existingIndex] = await Promise.all([
    getRecentlyUsedCourses(db, 10),
    getExistingTitleIndex(db)
  ]);
  const activeCourses = (courses as CourseLike[]).filter((c) => c.active);
  const unusedCourses = activeCourses.filter((course) => !existingIndex.normalizedKeys.has(course.title) && !existingIndex.titles.includes(course.title));

  if (unusedCourses.length > 0 && Math.random() >= 0.2) {
    const recentUnused = unusedCourses.filter((c) => !recentSlugs.has(c.slug));
    const pool = recentUnused.length > 0 ? recentUnused : unusedCourses;
    const course = pool[Math.floor(Math.random() * pool.length)];
    return {
      topicRowId: null,
      title: course.title,
      relatedCourseSlug: course.slug,
      relatedCourseTitle: course.title,
      excerpt: course.content?.excerpt ?? "",
      topicLabel: course.title,
      scoreTotal: null
    };
  }

  const unusedEvergreen = GENERAL_EVERGREEN_TOPICS.filter(
    (topic) => !existingIndex.normalizedKeys.has(topic) && !existingIndex.titles.includes(topic)
  );
  const topicPool = unusedEvergreen.length > 0 ? unusedEvergreen : GENERAL_EVERGREEN_TOPICS;
  const topic = topicPool[Math.floor(Math.random() * topicPool.length)];
  return { topicRowId: null, title: topic, relatedCourseSlug: null, relatedCourseTitle: null, excerpt: "", topicLabel: "عمومی", scoreTotal: null };
}

async function selectTopic(db: D1Database): Promise<SelectedTopic> {
  const queued: ContentTopicRow | null = await claimNextApprovedTopic(db);
  if (queued) {
    return {
      topicRowId: queued.id,
      title: queued.title,
      relatedCourseSlug: queued.related_course_slug,
      relatedCourseTitle: queued.related_course_title,
      excerpt: "",
      topicLabel: queued.category ?? queued.related_course_title ?? "عمومی",
      scoreTotal: queued.score_total
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

function validateGeneratedArticle(article: { content?: string; excerpt?: string; meta_title?: string; meta_description?: string; slug?: string }): string | null {
  const rawContent = String(article.content || "").replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r").trim();
  const content = rawContent.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
  const excerpt = String(article.excerpt || "").trim();
  const metaTitle = String(article.meta_title || "").trim();
  const metaDescription = String(article.meta_description || "").trim();
  const paragraphCount = rawContent.split(/\\n\\s*\\n/g).map((part) => part.trim()).filter(Boolean).length;
  const headingCount = (rawContent.match(/^(#{1,4})\\s+.+$/gm) || []).length + (rawContent.match(/<h[1-4]\\b[^>]*>/gi) || []).length;
  const normalizedMetaTitle = metaTitle.toLocaleLowerCase("fa");
  const normalizedExcerpt = excerpt.toLocaleLowerCase("fa");
  const placeholderPattern = /(todo|lorem ipsum|tbd|نام مدرس|نام آموزشگاه|مثال ساختگی)/i;

  if (content.length < 1200) return "متن تولیدشده کمتر از ۱۲۰۰ نویسه است.";
  if (paragraphCount < 5) return "مقاله باید حداقل ۵ پاراگراف مستقل داشته باشد.";
  if (headingCount < 2) return "مقاله باید حداقل ۲ تیتر ساختاری داشته باشد.";
  if (excerpt.length < 60) return "خلاصه مقاله کمتر از ۶۰ نویسه است.";
  if (!metaTitle || metaTitle.length > 70) return "meta_title خارج از محدوده کیفیت است.";
  if (metaDescription.length < 80 || metaDescription.length > 180) return "meta_description خارج از محدوده ۸۰ تا ۱۸۰ نویسه است.";
  if (!String(article.slug || "").trim()) return "slug تولید نشده است.";
  if (placeholderPattern.test(rawContent) || placeholderPattern.test(excerpt) || placeholderPattern.test(metaDescription)) return "متن شامل placeholder یا محتوای ساختگی است.";
  if (normalizedMetaTitle && normalizedExcerpt && normalizedMetaTitle === normalizedExcerpt) return "meta_title نباید دقیقاً برابر excerpt باشد.";
  return null;
}

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
  const claimedTopicId = topic.topicRowId;
  const releaseClaim = async () => {
    if (!claimedTopicId) return;
    await releaseGeneratingTopic(env.DB, claimedTopicId).catch((error) =>
      console.error("runDailyArticleGeneration: failed to release topic claim:", error)
    );
  };

  console.log("runDailyArticleGeneration: topic selected ->", topic.title, topic.topicRowId ? `(queue #${topic.topicRowId})` : "(fallback)");

  try {
    const result = await callClaudeArticle(env.ANTHROPIC_API_KEY, SYSTEM_PROMPT, buildBrief(topic));
    if (!result.success) {
      await releaseClaim();
      console.error("runDailyArticleGeneration:", result.message);
      return { success: false, message: result.message };
    }

    const article = result.article;
    const qualityError = validateGeneratedArticle(article);
    if (qualityError) {
      await releaseClaim();
      return { success: false, message: "اعتبارسنجی کیفیت مقاله شکست خورد: " + qualityError };
    }

    const dateSuffix = new Date().toISOString().slice(0, 10);
    const baseSlug = /^[a-z0-9-]+$/.test(article.slug) ? article.slug : slugify(topic.title);
    const baseSlugWithDate = baseSlug + "-" + dateSuffix;
    let slug = baseSlugWithDate;

    for (let suffix = 2; suffix <= 20; suffix += 1) {
      const existing = await env.DB.prepare("SELECT 1 AS found FROM blog_posts WHERE slug = ? LIMIT 1").bind(slug).first<{ found: number }>();
      if (!existing) break;
      slug = baseSlugWithDate + "-" + suffix;
    }

    const slugCollision = await env.DB.prepare("SELECT 1 AS found FROM blog_posts WHERE slug = ? LIMIT 1").bind(slug).first<{ found: number }>();
    if (slugCollision) {
      await releaseClaim();
      return { success: false, message: "اسلاگ یکتا برای مقاله پیدا نشد؛ تولید متوقف شد تا محتوای تکراری ساخته نشود." };
    }

    const insertStatement = env.DB.prepare(
      `INSERT INTO blog_posts (slug, title, excerpt, content, topic, related_course_slug, related_course_title, status, meta_title, meta_description, is_ai_generated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1)`
    ).bind(
      slug,
      topic.title,
      article.excerpt,
      article.content,
      article.topic || topic.topicLabel,
      topic.relatedCourseSlug,
      topic.relatedCourseTitle,
      article.meta_title || topic.title,
      article.meta_description || article.excerpt
    );

    // Draft creation and topic consumption must be atomic. D1 batches are
    // transactional, so a failed update cannot leave a generating topic with
    // an untracked draft (or vice versa).
    const statements = [insertStatement];
    if (topic.topicRowId) {
      statements.push(
        env.DB.prepare(
          "UPDATE content_topics SET status='used', used_at=datetime('now'), used_by_post_id=last_insert_rowid(), updated_at=datetime('now') WHERE id=? AND status='generating'"
        ).bind(topic.topicRowId)
      );
    }

    let insertedId: number;
    try {
      const results = await env.DB.batch(statements);
      insertedId = Number(results[0]?.meta?.last_row_id || 0);
      if (!insertedId) throw new Error("BLOG_POST_ID_MISSING");
    } catch (err) {
      await releaseClaim();
      const detail = err instanceof Error ? err.message : String(err);
      return { success: false, message: `ذخیره مقاله یا مصرف Topic شکست خورد: ${detail}` };
    }

    await createSeoAction(env.DB, {
      actionType: "CONTENT_DRAFT",
      targetUrl: "https://fatehmusic.ir/blog/" + slug,
      targetSlug: slug,
      targetTitle: topic.title,
      relatedCourseSlug: topic.relatedCourseSlug,
      recommendationScore: topic.scoreTotal,
      source: "content-engine"
    }).catch((err) => console.error("runDailyArticleGeneration: failed to register SEO action:", err));

    console.log(`runDailyArticleGeneration: created draft "${topic.title}" (${slug})`);
    return { success: true, message: `پیش‌نویس «${topic.title}» با Claude ساخته شد.`, slug };
  } catch (err) {
    await releaseClaim();
    const message = err instanceof Error ? err.message : String(err);
    console.error("runDailyArticleGeneration: unexpected failure:", err);
    return { success: false, message: `تولید مقاله شکست خورد: ${message}` };
  }
}
