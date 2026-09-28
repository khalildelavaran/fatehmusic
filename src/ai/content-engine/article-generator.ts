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
import { instructors } from "../../data/instructors.js";
import { courseContent } from "../../data/course-content.js";
import { buildFallbackCourseContent } from "../../data/course-content-fallback.js";
import { GENERAL_EVERGREEN_TOPICS } from "../../data/content-engine-seeds";
import { derivePlainName } from "./candidates";
import { toDedupKey, titleSimilarity } from "./normalize";
import { claimNextApprovedTopic, getExistingTitleIndex, getRecentlyUsedCourses, releaseGeneratingTopic } from "./db";
import { NEAR_DUPLICATE_THRESHOLD } from "./dedup";
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
  const base = String(text || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base;
}

function stableIndex(size: number, offset = 0): number {
  if (!size) return 0;
  const day = new Date().toISOString().slice(0, 10);
  let hash = offset;
  for (const char of day) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % size;
}

function isExistingTitle(existing: Awaited<ReturnType<typeof getExistingTitleIndex>>, title: string): boolean {
  const normalized = toDedupKey(title);
  if (existing.normalizedKeys.has(normalized)) return true;
  return existing.titles.some((item) =>
    toDedupKey(item) === normalized || titleSimilarity(title, item) >= NEAR_DUPLICATE_THRESHOLD
  );
}

function fallbackArticleTitles(course: CourseLike): string[] {
  const name = derivePlainName(course.title);
  return [
    `چگونه ${name} را از صفر یاد بگیریم؟`,
    `راهنمای شروع یادگیری ${name} برای مبتدی‌ها`,
    `اشتباهات رایج در شروع یادگیری ${name}`
  ];
}

async function pickFallbackTopic(db: D1Database): Promise<SelectedTopic | null> {
  const [recentSlugs, existingIndex] = await Promise.all([
    getRecentlyUsedCourses(db, 10),
    getExistingTitleIndex(db)
  ]);

  const activeCourses = (courses as CourseLike[]).filter((c) => c.active);
  const unusedCourses = activeCourses.filter((course) =>
    !recentSlugs.has(course.slug)
  );
  const coursePool = unusedCourses.length > 0 ? unusedCourses : activeCourses;

  // Never use the course landing-page title itself as a blog title.
  // The fallback must create a genuinely editorial query that can coexist
  // with the canonical course page without deliberate title cannibalization.
  const safeCourseTopics = coursePool
    .map((course) => ({
      course,
      titles: fallbackArticleTitles(course).filter((title) => !isExistingTitle(existingIndex, title))
    }))
    .filter((item) => item.titles.length > 0);

  if (safeCourseTopics.length > 0) {
    const picked = safeCourseTopics[stableIndex(safeCourseTopics.length)];
    const title = picked.titles[stableIndex(picked.titles.length, 17)];
    return {
      topicRowId: null,
      title,
      relatedCourseSlug: picked.course.slug,
      relatedCourseTitle: picked.course.title,
      excerpt: picked.course.content?.excerpt ?? "",
      topicLabel: picked.course.title,
      scoreTotal: null
    };
  }

  const safeEvergreen = GENERAL_EVERGREEN_TOPICS.filter((topic) => !isExistingTitle(existingIndex, topic));
  if (!safeEvergreen.length) return null;
  const topic = safeEvergreen[stableIndex(safeEvergreen.length, 43)];
  return {
    topicRowId: null,
    title: topic,
    relatedCourseSlug: null,
    relatedCourseTitle: null,
    excerpt: "",
    topicLabel: "عمومی",
    scoreTotal: null
  };
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
  const fallback = await pickFallbackTopic(db);
  if (!fallback) throw new Error("NO_SAFE_ARTICLE_TOPIC");
  return fallback;
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

function countOccurrences(value: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = value.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function normalizeGeneratedText(value: string): string {
  const slash = String.fromCharCode(92);
  const newline = String.fromCharCode(10);
  const carriage = String.fromCharCode(13);
  return String(value || "")
    .split(slash + "r" + slash + "n").join(newline)
    .split(slash + "n").join(newline)
    .split(slash + "r").join(carriage)
    .trim();
}

function validateGeneratedArticle(article: { content?: string; excerpt?: string; meta_title?: string; meta_description?: string; slug?: string }): string | null {
  const rawContent = normalizeGeneratedText(article.content || "");
  const content = rawContent.replace(/<[^>]+>/g, " ")
    .split(" ")
    .filter(Boolean)
    .join(" ");
  const excerpt = String(article.excerpt || "").trim();
  const metaTitle = String(article.meta_title || "").trim();
  const metaDescription = String(article.meta_description || "").trim();
  const wordCount = content ? content.split(" ").filter(Boolean).length : 0;
  const lines = rawContent.split(String.fromCharCode(10)).map((line) => line.trim()).filter(Boolean);
  const paragraphCount = rawContent
    .split(String.fromCharCode(10) + String.fromCharCode(10))
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
  const markdownHeadingCount = lines.filter((line) => {
    const first = line.indexOf("#");
    return first === 0 && line.length > 1 && line[1] === " ";
  }).length;
  const htmlHeadingCount =
    countOccurrences(rawContent.toLowerCase(), "<h1") +
    countOccurrences(rawContent.toLowerCase(), "<h2") +
    countOccurrences(rawContent.toLowerCase(), "<h3") +
    countOccurrences(rawContent.toLowerCase(), "<h4");
  const headingCount = markdownHeadingCount + htmlHeadingCount;
  const normalizedMetaTitle = metaTitle.toLocaleLowerCase("fa");
  const normalizedExcerpt = excerpt.toLocaleLowerCase("fa");
  const placeholderPattern = /(todo|lorem ipsum|tbd|نام مدرس|نام آموزشگاه|مثال ساختگی)/i;

  if (content.length < 2800) return "متن تولیدشده کمتر از ۲۸۰۰ نویسه است.";
  if (wordCount < 450) return "مقاله کمتر از ۴۵۰ واژه دارد و برای محتوای عمیق کافی نیست.";
  if (paragraphCount < 5) return "مقاله باید حداقل ۵ پاراگراف مستقل داشته باشد.";
  if (paragraphCount > 8) return "مقاله نباید بیشتر از ۸ پاراگراف مستقل داشته باشد.";
  if (headingCount < 2) return "مقاله باید حداقل ۲ تیتر ساختاری داشته باشد.";
  if (excerpt.length < 60) return "خلاصه مقاله کمتر از ۶۰ نویسه است.";
  if (metaTitle.length < 20 || metaTitle.length > 60) return "meta_title باید بین ۲۰ تا ۶۰ نویسه باشد.";
  if (metaDescription.length < 80 || metaDescription.length > 160) return "meta_description باید بین ۸۰ تا ۱۶۰ نویسه باشد.";
  if (!String(article.slug || "").trim()) return "slug تولید نشده است.";
  if (placeholderPattern.test(rawContent) || placeholderPattern.test(excerpt) || placeholderPattern.test(metaDescription)) return "متن شامل placeholder یا محتوای ساختگی است.";
  if (normalizedMetaTitle && normalizedExcerpt && normalizedMetaTitle === normalizedExcerpt) return "meta_title نباید دقیقاً برابر excerpt باشد.";
  return null;
}

function courseMatchesArticleTitle(title: string): any[] {
  const normalizedTitle = String(title || "").normalize("NFKC").toLocaleLowerCase("fa");
  return (courses as Array<any>)
    .filter((course) => course?.active && course?.slug && course?.title)
    .filter((course) => {
      const name = String(course.title).replace(/^آموزش\s+/u, "").replace(/^دوره\s+/u, "").normalize("NFKC").toLocaleLowerCase("fa");
      return name && normalizedTitle.includes(name);
    })
    .sort((a, b) => String(b.title).length - String(a.title).length);
}

function appendCourseBrief(lines: string[], course: any, label = "دوره") {
  if (!course) return;
  const teacherNames = (course.instructors || [])
    .map((id: number) => (instructors as Array<any>).find((teacher) => teacher.id === id)?.name)
    .filter(Boolean);
  lines.push(`اطلاعات رسمی ${label}: ${course.title}`);
  lines.push(`- سطح‌ها: ${(course.level || []).join("، ") || "در داده رسمی مشخص نشده"}`);
  lines.push(`- گروه سنی: ${(course.ageGroup || []).join("، ") || "در داده رسمی مشخص نشده"}`);
  lines.push(`- دسته‌بندی: ${course.category || "در داده رسمی مشخص نشده"}`);
  lines.push(`- نوع کلاس: ${course.classType || "در داده رسمی مشخص نشده"}`);
  lines.push(`- مدت: ${course.duration || "در داده رسمی مشخص نشده"}`);
  if (teacherNames.length) lines.push(`- مدرس/مدرس‌ها: ${teacherNames.join("، ")}`);
  if (course.content?.description) lines.push(`- توضیح رسمی دوره: ${course.content.description}`);
  if (course.seo?.keywords?.length) lines.push(`- کلیدواژه‌های رسمی دوره: ${course.seo.keywords.join("، ")}`);

  const editorial = courseContent[course.slug] || buildFallbackCourseContent(course);
  if (editorial) {
    if (editorial.overview?.length) lines.push(`- نکات محتوایی مجاز: ${editorial.overview.slice(0, 2).join(" ")}`);
    if (editorial.learningPath?.length) lines.push(`- مسیر یادگیری: ${editorial.learningPath.slice(0, 4).map((item: any) => item.stage + ": " + item.description).join(" | ")}`);
    if (editorial.curriculum?.length) lines.push(`- سرفصل‌ها: ${editorial.curriculum.slice(0, 6).map((item: any) => item.title + ": " + item.description).join(" | ")}`);
    if (editorial.commonMistakes?.length) lines.push(`- اشتباهات رایج: ${editorial.commonMistakes.slice(0, 4).map((item: any) => item.mistake + " → " + item.fix).join(" | ")}`);
    if (editorial.faqAdditions?.length) lines.push(`- پرسش‌های متداول مرتبط: ${editorial.faqAdditions.slice(0, 4).map((item: any) => item.question + " → " + item.answer).join(" | ")}`);
  }
}

function buildBrief(topic: SelectedTopic): string {
  const lines = [`عنوان مقاله (ثابت، تغییر نده): «${topic.title}»`];
  const matchedCourses = courseMatchesArticleTitle(topic.title);
  const primaryCourse = topic.relatedCourseSlug
    ? (courses as Array<any>).find((item) => item.slug === topic.relatedCourseSlug)
    : null;

  if (matchedCourses.length >= 2) {
    lines.push("این مقاله یک موضوع مقایسه‌ای است و باید هر دو دوره را با وزن متوازن و بدون تبدیل یکی به مرجع مطلق بررسی کند.");
    appendCourseBrief(lines, matchedCourses[0], "اول");
    appendCourseBrief(lines, matchedCourses[1], "دوم");
    lines.push("هر ادعای اختصاصی را فقط به دوره‌ای نسبت بده که در فکت‌های بالا آمده است؛ قیمت، زمان‌بندی، آمار، افتخارات یا ویژگی دیگری را حدس نزن.");
  } else if (primaryCourse) {
    lines.push(`این مقاله باید به دوره‌ی «${topic.relatedCourseTitle || primaryCourse.title || topic.relatedCourseSlug}» در آموزشگاه موسیقی فاتح در شوشتر مرتبط باشد.`);
    appendCourseBrief(lines, primaryCourse);
    lines.push("فقط همین اطلاعات مدرسه را به‌عنوان فکت اختصاصی آموزشگاه استفاده کن؛ درباره سابقه، تعداد هنرجو، قیمت، زمان کلاس یا دستاوردهایی که اینجا داده نشده‌اند چیزی نساز.");
  } else {
    lines.push("این مقاله موضوعی عمومی درباره‌ی آموزش موسیقی است. درباره آموزشگاه فقط اطلاعاتی را ذکر کن که در همین بریف آمده و از ساختن فکت اختصاصی درباره مدرس، قیمت، زمان یا آمار خودداری کن.");
  }

  if (topic.excerpt) lines.push(`توضیح کوتاه موجود: ${topic.excerpt}`);
  lines.push("عنوان، موضوع و فکت‌های رسمی بالا را مبنا قرار بده و submit_article را با فیلدهای کامل صدا بزن.");
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

  let topic: SelectedTopic;
  try {
    topic = await selectTopic(env.DB);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("runDailyArticleGeneration: topic selection failed:", error);
    return { success: false, message: `انتخاب موضوع برای تولید مقاله شکست خورد: ${detail}` };
  }

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

    const modelSlug = slugify(article.slug || "");
    const baseSlug = modelSlug || slugify(topic.title);
    if (!baseSlug) {
      await releaseClaim();
      return { success: false, message: "slug معنادار برای مقاله تولید نشد؛ ذخیره متوقف شد." };
    }

    // Keep clean, durable slugs. Add a numeric suffix only on collision
    // instead of embedding the publication date in every URL.
    let slug = baseSlug;
    for (let suffix = 2; suffix <= 20; suffix += 1) {
      const existing = await env.DB.prepare("SELECT 1 AS found FROM blog_posts WHERE slug = ? LIMIT 1").bind(slug).first<{ found: number }>();
      if (!existing) break;
      slug = baseSlug + "-" + suffix;
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
      targetPostId: insertedId,
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
