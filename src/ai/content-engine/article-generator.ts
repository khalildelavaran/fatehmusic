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
import { slugifyArticleTitle } from "../../seo/v2/content-strategy/slug.js";
import { semanticTokens, normalizeSemanticText } from "../../seo/helpers/text.js";
import { isComparisonCourseTitle, matchCoursesInTitle } from "../../seo/v2/content-strategy/course-matching.js";
import { derivePlainName } from "./candidates";
import { toDedupKey, titleSimilarity } from "./normalize";
import { claimNextApprovedTopic, claimTopicById, getExistingTitleIndex, getRecentlyUsedCourses, releaseGeneratingTopic } from "./db";
import { NEAR_DUPLICATE_THRESHOLD } from "./dedup";
import { generateArticleWithProvider } from "./providers/multi-provider";
import { getAiEngineSettings, recordAiEngineRun } from "./settings";
import type { ContentTopicRow, AiProvider } from "./types";

export interface ArticleEnv {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: unknown;
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

export interface GenerateOptions {
  /** Generate for this exact queued topic (admin clicked the button on a topic row). */
  topicId?: number;
  /** Generate for a strategy opportunity that is not in the topic queue. */
  manualTopic?: {
    title: string;
    relatedCourseSlug?: string | null;
    relatedCourseTitle?: string | null;
    topicLabel?: string | null;
  };
  provider?: AiProvider;
  model?: string;
  saveMode?: "draft" | "published";
}

async function selectTopic(db: D1Database, options: GenerateOptions = {}): Promise<SelectedTopic> {
  if (options.manualTopic?.title?.trim()) {
    const manual = options.manualTopic;
    return {
      topicRowId: null,
      title: manual.title.trim(),
      relatedCourseSlug: manual.relatedCourseSlug ?? null,
      relatedCourseTitle: manual.relatedCourseTitle ?? null,
      excerpt: "",
      topicLabel: manual.topicLabel || manual.relatedCourseTitle || "عمومی",
      scoreTotal: null
    };
  }
  if (options.topicId) {
    const picked = await claimTopicById(db, options.topicId);
    if (!picked) throw new Error("TOPIC_NOT_AVAILABLE (این موضوع وجود ندارد یا در وضعیت قابل تولید نیست)");
    return {
      topicRowId: picked.id,
      title: picked.title,
      relatedCourseSlug: picked.related_course_slug,
      relatedCourseTitle: picked.related_course_title,
      excerpt: "",
      topicLabel: picked.category ?? picked.related_course_title ?? "عمومی",
      scoreTotal: picked.score_total
    };
  }
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
- به‌جای جمله‌های کلی («یادگیری ساز فواید زیادی دارد»)، جزئیات مشخص و ملموس بیار -- یک سناریوی آموزشیِ فرضی یا مثال فنی مشخص از همان ساز. تجربه، نقل‌قول، نتیجه یا داستانِ واقعی درباره هنرجو فقط وقتی مجاز است که در بریف صراحتاً داده شده باشد؛ هیچ «هنرجوی ما»، رضایت‌نامه یا تجربه واقعی را از خودت نساز.
- ساختار مقاله رو مصنوعی و قرینه نساز (مثلاً همیشه ۳ مورد با طول یکسان). بعضی نکته‌ها رو کوتاه رد کن، روی یکی-دو تا بیشتر مکث کن.
- پاراگراف آخر رو به یک «جمع‌بندی» فرمولیک که کل متن رو خلاصه می‌کنه تبدیل نکن؛ به‌جاش با یک نکته‌ی عملی، یک دعوت طبیعی، یا یک فکر باز تمومش کن.
- از این کلیشه‌های رایج متن‌های تولیدشده با هوش مصنوعی در فارسی به‌طور خاص پرهیز کن: «در دنیای امروز»، «در این راستا»، «شایان ذکر است»، «نقش بسزایی ایفا می‌کند»، «بدون شک/بی‌تردید» به‌عنوان شروع جمله، و استفاده‌ی مکرر از «همچنین» به‌عنوان تنها ابزار اتصال جمله‌ها.
- به‌جای فعل‌ها و عبارات رسمی و پرطمطراق، فعل ساده و مستقیم رو ترجیح بده (مثلاً «کمک می‌کند» به‌جای «نقش بسزایی در ... ایفا می‌کند»).
- حداقل ۲ لینک داخلی مرتبط در متن قرار بده و یکی از آن‌ها باید به نزدیک‌ترین صفحه‌ی موضوعی/دوره/مدرس/موقعیت محلی در whitelist بریف باشد.
- لینک داخلی فقط از URLهای whitelist شده در بریف استفاده کن؛ URL جدید، slug حدسی یا مسیر ساختگی ایجاد نکن.

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
    .split(carriage + newline).join(newline)
    .split(carriage).join(newline)
    .trim();
}

function validateGeneratedArticle(
  article: { content?: string; excerpt?: string; meta_title?: string; meta_description?: string; slug?: string },
  allowedLinks: Set<string> = new Set(),
  expectedTitle = ""
): string | null {
  const rawContent = normalizeGeneratedText(article.content || "");
  const content = rawContent.replace(/<[^>]+>/g, " ")
    .split("\n").join(" ")
    .split("\r").join(" ")
    .split("\t").join(" ")
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

  if (expectedTitle) {
    const normalizedExpected = toDedupKey(expectedTitle);
    const normalizedContent = toDedupKey(content);
    const normalizedExcerptKey = toDedupKey(excerpt);
    if (titleSimilarity(expectedTitle, metaTitle) < 0.35) {
      return "meta_title با عنوان Topic انتخاب‌شده هم‌خوانی کافی ندارد.";
    }

    // A valid-looking article can still drift away from the selected topic.
    // Require meaningful lexical overlap with the fixed Topic in both the body
    // and excerpt. For very short/generic titles the body check is relaxed.
    const expectedTokens = normalizedExpected
      .split(" ")
      .filter((token) => token.length >= 3)
      .slice(0, 8);
    const contentTokenSet = new Set(semanticTokens(normalizedContent));
    const excerptTokenSet = new Set(semanticTokens(normalizedExcerptKey));
    const contentHitCount = expectedTokens.filter((token) => contentTokenSet.has(token)).length;
    const excerptHitCount = expectedTokens.filter((token) => excerptTokenSet.has(token)).length;
    const requiredHits = expectedTokens.length >= 4 ? 2 : 1;
    if (contentHitCount < requiredHits) {
      return "بدنه مقاله ارتباط کافی با Topic انتخاب‌شده ندارد.";
    }
    if (excerptHitCount < 1) {
      return "خلاصه مقاله با Topic انتخاب‌شده هم‌خوانی کافی ندارد.";
    }
  }

  const absoluteInternalUrls = rawContent.match(/https?:\/\/(?:www\.)?fatehmusic\.ir[^\s)<>"]+/gi) || [];
  const relativeMarkdownUrls = [...rawContent.matchAll(/\]\((\/(?!\/)[^\s)]+)\)/g)].map((match) => match[1]);
  const relativeHtmlUrls = [...rawContent.matchAll(/<a\s+[^>]*href=["'](\/(?!\/)[^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const absoluteHtmlUrls = [...rawContent.matchAll(/<a\s+[^>]*href=["'](https?:\/\/(?:www\.)?fatehmusic\.ir[^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const internalUrls = [...new Set([
    ...absoluteInternalUrls,
    ...relativeMarkdownUrls,
    ...relativeHtmlUrls,
    ...absoluteHtmlUrls
  ])].map((url) => String(url).replace(/[.,،؛:]+$/u, ""));
  const canonicalInternalUrls = internalUrls.map((url) =>
    url.startsWith("/")
      ? "https://fatehmusic.ir" + url.split("#")[0].split("?")[0]
      : url.replace(/^http:\/\//i, "https://").replace("https://www.fatehmusic.ir", "https://fatehmusic.ir").split("#")[0].split("?")[0]
  );

  for (let index = 0; index < canonicalInternalUrls.length; index += 1) {
    const canonicalInternalUrl = canonicalInternalUrls[index];
    if (!allowedLinks.has(canonicalInternalUrl)) {
      return "مقاله شامل لینک داخلی خارج از whitelist است: " + internalUrls[index];
    }
  }

  if (canonicalInternalUrls.length < 2) {
    return "مقاله باید حداقل ۲ لینک داخلی معتبر داشته باشد.";
  }

  const genericLinks = new Set([
    "https://fatehmusic.ir/blog",
    "https://fatehmusic.ir/courses",
    "https://fatehmusic.ir/register"
  ]);
  if (!canonicalInternalUrls.some((url) => !genericLinks.has(url))) {
    return "مقاله باید حداقل یک لینک داخلی مرتبط با موضوع/دوره/مدرس/موقعیت محلی داشته باشد.";
  }

  return null;
}

function allowedInternalLinks(topic: SelectedTopic): Set<string> {
  const matchedCourses = courseMatchesArticleTitle(topic.title);
  const primaryCourse = topic.relatedCourseSlug
    ? (courses as Array<any>).find((item) => item.slug === topic.relatedCourseSlug)
    : null;
  const linkCourseSlugs = [...new Set([
    ...matchedCourses.map((course) => course.slug),
    ...(primaryCourse ? [primaryCourse.slug] : [])
  ])];
  const instructorSlugs = [...new Set([
    ...matchedCourses,
    ...(primaryCourse ? [primaryCourse] : [])
  ].flatMap((course) =>
    (course.instructors || [])
      .map((id: number) => (instructors as Array<any>).find((teacher) => teacher.id === id)?.slug)
      .filter(Boolean)
  ))];
  return new Set([
    ...linkCourseSlugs.map((slug) => "https://fatehmusic.ir/courses/" + slug),
    ...instructorSlugs.map((slug) => "https://fatehmusic.ir/instructors/" + slug),
    "https://fatehmusic.ir/locations/shushtar",
    "https://fatehmusic.ir/courses",
    "https://fatehmusic.ir/blog",
    "https://fatehmusic.ir/register"
  ]);
}

export function courseMatchesArticleTitle(title: string, courseCatalog: Array<any> = courses as Array<any>): any[] {
  return matchCoursesInTitle(title, courseCatalog, {
    comparison: isComparisonCourseTitle(title)
  });
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

  const editorial = courseContent[course.slug as keyof typeof courseContent] || buildFallbackCourseContent(course);
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

  const linkCourseSlugs = [...new Set([
    ...matchedCourses.map((course) => course.slug),
    ...(primaryCourse ? [primaryCourse.slug] : [])
  ])];
  const instructorSlugs = [...new Set([
    ...matchedCourses,
    ...(primaryCourse ? [primaryCourse] : [])
  ].flatMap((course) =>
    (course.instructors || [])
      .map((id: number) => (instructors as Array<any>).find((teacher) => teacher.id === id)?.slug)
      .filter(Boolean)
  ))];
  const allowedLinks = [
    ...linkCourseSlugs.map((slug) => "https://fatehmusic.ir/courses/" + slug),
    ...instructorSlugs.map((slug) => "https://fatehmusic.ir/instructors/" + slug),
    "https://fatehmusic.ir/locations/shushtar",
    "https://fatehmusic.ir/courses",
    "https://fatehmusic.ir/blog",
    "https://fatehmusic.ir/register"
  ];
  lines.push("لینک‌های داخلی مجاز: " + [...new Set(allowedLinks)].join(" | "));
  if (topic.excerpt) lines.push(`توضیح کوتاه موجود: ${topic.excerpt}`);
  lines.push("عنوان، موضوع، فکت‌های رسمی و whitelist لینک‌های بالا را مبنا قرار بده. slug را تغییر نده؛ URL بر اساس همین عنوان توسط سیستم تعیین می‌شود.");
  return lines.join("\n");
}
export async function runDailyArticleGeneration(env: ArticleEnv, options: GenerateOptions = {}): Promise<GenerateResult> {
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
    topic = await selectTopic(env.DB, options);
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
    const settings = await getAiEngineSettings(env.DB).catch(() => null);
    const provider: AiProvider = (settings?.provider && ["gemini", "claude", "openai"].includes(settings.provider))
      ? settings.provider
      : (env.GEMINI_API_KEY ? "gemini" : env.ANTHROPIC_API_KEY ? "claude" : "openai");
    const model = settings?.model;
    const result = await generateArticleWithProvider({
      provider,
      model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildBrief(topic),
      env
    });
    if (!result.success) {
      await releaseClaim();
      await recordAiEngineRun(env.DB, {
        status: "failed",
        message: result.message
      }).catch(() => {});
      console.error("runDailyArticleGeneration:", result.message);
      return { success: false, message: result.message };
    }

    const article = result.article;
    const qualityError = validateGeneratedArticle(article, allowedInternalLinks(topic), topic.title);
    if (qualityError) {
      await releaseClaim();
      return { success: false, message: "اعتبارسنجی کیفیت مقاله شکست خورد: " + qualityError };
    }

    // The Topic title is the canonical editorial identity. Do not let the
    // language model invent a divergent URL slug; only collision suffixes
    // are added when an existing post already uses the deterministic slug.
    const baseSlug = slugifyArticleTitle(topic.title);
    if (!baseSlug) {
      await releaseClaim();
      return { success: false, message: "slug معنادار برای مقاله تولید نشد؛ ذخیره متوقف شد." };
    }

    // Keep clean, durable slugs. Resolve all existing numeric collisions
    // with one indexed query instead of one round-trip per suffix.
    const slugRows = await env.DB.prepare(
      "SELECT slug FROM blog_posts WHERE slug = ? OR slug LIKE ?"
    ).bind(baseSlug, baseSlug + "-%").all<{ slug: string }>();

    const occupiedSlugs = new Set((slugRows.results || []).map((row) => String(row.slug || "")));
    let slug = baseSlug;
    if (occupiedSlugs.has(slug)) {
      slug = "";
      for (let suffix = 2; suffix <= 20; suffix += 1) {
        const candidate = baseSlug + "-" + suffix;
        if (!occupiedSlugs.has(candidate)) {
          slug = candidate;
          break;
        }
      }
      if (!slug) {
        await releaseClaim();
        return { success: false, message: "اسلاگ یکتا برای مقاله پیدا نشد؛ تولید متوقف شد تا محتوای تکراری ساخته نشود." };
      }
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
          "UPDATE content_topics SET status='drafted', used_at=NULL, " +
          "used_by_post_id=(SELECT id FROM blog_posts WHERE slug=? LIMIT 1), updated_at=datetime('now') " +
          "WHERE id=? AND status='generating'"
        ).bind(slug, topic.topicRowId)
      );
    }

    // The SEO action is part of the same D1 transaction as the draft. If the
    // action cannot be registered, the draft is rolled back instead of leaving
    // an orphaned piece of content outside the closed loop.
    statements.push(
      env.DB.prepare(
        "INSERT INTO seo_action_log " +
        "(action_type, target_url, target_slug, target_title, target_post_id, related_course_slug, recommendation_score, status, source) " +
        "VALUES ('CONTENT_DRAFT', ?, ?, ?, (SELECT id FROM blog_posts WHERE slug = ? LIMIT 1), ?, ?, 'pending_review', 'content-engine')"
      ).bind(
        "https://fatehmusic.ir/blog/" + slug,
        slug,
        topic.title,
        slug,
        topic.relatedCourseSlug,
        topic.scoreTotal
      )
    );

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

    console.log(`runDailyArticleGeneration: created draft "${topic.title}" (${slug})`);
    await recordAiEngineRun(env.DB, {
      status: "success",
      message: `پیش‌نویس «${topic.title}» با ${result.provider} ساخته شد.`,
      articleSlug: slug
    }).catch(() => {});

    return { success: true, message: `پیش‌نویس «${topic.title}» با ${result.provider} ساخته شد.`, slug };
  } catch (err) {
    await releaseClaim();
    const message = err instanceof Error ? err.message : String(err);
    console.error("runDailyArticleGeneration: unexpected failure:", err);
    return { success: false, message: `تولید مقاله شکست خورد: ${message}` };
  }
}
