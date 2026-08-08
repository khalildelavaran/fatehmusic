/**
 * ============================================================
 * Fateh Music Academy — FAQ Assistant Engine
 * src/scripts/faq-bot.js
 * ============================================================
 *
 * Pure data/logic module (no DOM access) so it stays cheap to
 * bundle and easy to test. It never invents facts: every answer
 * is derived at query-time from the real data files (courses,
 * instructors, schedule, pricing, contact) — the same single
 * source of truth the rest of the site (course pages, FAQPage
 * schema) already relies on. If a course has no active schedule
 * or no pricing entry yet, the honest fallback text is shown
 * instead of a guess.
 */

import { courses } from "../data/courses.js";
import { instructors } from "../data/instructors.js";
import { schedules } from "../data/schedule.js";
import { contact } from "../data/contact.js";
import { pricing } from "../data/pricing.js";
import { generateCourseFAQ } from "../data/faq.js";

/* ============================================================
   Bidi isolation
   The site is RTL. A hyphen-separated number like a phone number
   ("۰۹۳۳-۳۱۳-۹۳۱۹"), once mixed into a Persian sentence, gets its
   segments visually reordered by the browser's bidi algorithm.
   Wrapping it in Unicode isolate marks keeps the digit groups in
   their real left-to-right order regardless of the surrounding
   RTL text.
============================================================ */

const LRI = "\u2066";
const PDI = "\u2069";

function isolateLTR(text) {
  return `${LRI}${text}${PDI}`;
}

/* ============================================================
   Text normalization
   Collapses Arabic/Persian character variants, half-spaces and
   punctuation so "سه‌تار", "سه تار" and "سه   تار" all compare
   equal.
============================================================ */

export function normalizeText(text = "") {
  return text
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[؟?!،؛,:()[\]{}"']/g, "")
    .toLowerCase()
    .trim();
}

/* ============================================================
   Extra search synonyms, keyed by the real course slug.
   These are ONLY alternate spellings/short names used for
   matching — never a source of facts. Deliberately excludes
   ambiguous bare words (e.g. bare "پاپ") that collide across
   more than one course, so a genuinely ambiguous message gets
   an honest "not found" instead of a confident wrong guess.
============================================================ */

const EXTRA_KEYWORDS = {
  "violin-course": ["ویلن", "violin"],
  "guitar-course": ["گیتار کلاسیک", "گیتار پاپ", "فلامنکو", "guitar"],
  "keyboard-course": ["ارگ", "کیبورد", "keyboard", "organ"],
  "setar-course": ["سه تار", "setar"],
  "tonbak-course": ["تمبک", "tonbak", "tombak"],
  "ney-anban-course": ["نی انبان"],
  "hangdrum-course": ["هنگ درام", "هنگدرام", "handpan"],
  "traditional-vocal-course": ["ردیف"],
  "bakhtiari-vocal-course": ["بختیاری", "آواز بختیاری"],
  "pop-vocal-course": ["آواز پاپ", "خوانندگی پاپ"],
  "shushtari-vocal-course": ["شوشتری", "آواز شوشتری"],
  "rhythm-reading-course": ["وزن خوانی", "ریتم خوانی"],
  "music-theory-course": ["تئوری"],
  "voice-training-course": ["پرورش صدا"],
  "children-music-course": ["کودک", "بچه"]
};

/* ============================================================
   Matching primitives
============================================================ */

/**
 * Scores how well a single search term matches the user's query.
 *
 * Requires whole-word matches for the term's own words (so short
 * terms like "دف" never fire on a substring inside an unrelated
 * word like "هدف"), plus a partial-typing allowance so a match
 * can appear before the user finishes typing a word.
 *
 * @param {string} query - full normalized user input
 * @param {string[]} queryWords - normalized query split into words
 * @param {string} term - normalized candidate term
 * @returns {number} match score, 0 if no match
 */
function scoreMatch(query, queryWords, term) {
  if (!term || term.length < 2) return 0;

  const termWords = term.split(" ").filter(Boolean);
  const allWordsPresent = termWords.every((word) => queryWords.includes(word));
  if (allWordsPresent) return term.length;

  if (termWords.length === 1 && query.length >= 2 && term.includes(query)) {
    return query.length;
  }

  return 0;
}

function coreTitle(course) {
  return course.title.replace(/^(آموزش|دوره)\s+/, "");
}

function courseSearchTerms(course) {
  const extra = EXTRA_KEYWORDS[course.slug] || [];
  return [coreTitle(course), course.instrument, ...extra]
    .filter(Boolean)
    .map(normalizeText);
}

/**
 * Finds the best-matching active course for a query.
 *
 * @param {string} query
 * @param {string[]} queryWords
 * @returns {object|null}
 */
function matchCourse(query, queryWords) {
  let best = null;
  let bestScore = 0;

  courses.forEach((course) => {
    if (course.active === false) return;

    courseSearchTerms(course).forEach((term) => {
      const score = scoreMatch(query, queryWords, term);
      if (score > bestScore) {
        bestScore = score;
        best = course;
      }
    });
  });

  return best;
}

/**
 * "فاتح" is both the academy's own name and the shared family
 * name of two different instructors — too ambiguous to use for
 * single-word matching, so it's excluded and only works as part
 * of a full name.
 */
const RESERVED_NAME_WORDS = ["فاتح"];

function instructorFullNameTerm(person) {
  return normalizeText(person.name);
}

function instructorNameParts(person) {
  return normalizeText(person.name)
    .split(" ")
    .filter((part) => part.length >= 2 && !RESERVED_NAME_WORDS.includes(part));
}

/**
 * Finds active instructors matching a query: a full-name match
 * wins outright; otherwise instructors are scored by how many of
 * their own name-parts the query covers, so a query overlapping
 * two parts of one name (e.g. both halves of a surname) beats a
 * different person who only shares one part with them. Only the
 * top-scoring instructor(s) are returned, so a genuine tie (two
 * people sharing a first name) still yields both for disambiguation.
 *
 * @param {string} query
 * @param {string[]} queryWords
 * @returns {object[]}
 */
function matchInstructors(query, queryWords) {
  const active = instructors.filter((person) => person.active !== false);

  const fullMatches = active.filter(
    (person) => scoreMatch(query, queryWords, instructorFullNameTerm(person)) > 0
  );
  if (fullMatches.length) return fullMatches;

  let bestScore = 0;
  let best = [];

  active.forEach((person) => {
    const matchedParts = instructorNameParts(person).filter((part) => queryWords.includes(part));
    if (!matchedParts.length) return;

    const score = matchedParts.reduce((sum, part) => sum + part.length, 0);
    if (score > bestScore) {
      bestScore = score;
      best = [person];
    } else if (score === bestScore) {
      best.push(person);
    }
  });

  return best;
}

/* ============================================================
   General (non-course) topics
============================================================ */

const TOPIC_KEYWORDS = {
  contact: [
    "تماس", "شماره", "تلفن", "واتساپ", "واتس اپ",
    "اینستاگرام", "تلگرام", "ایمیل",
    "آدرس", "کجا", "لوکیشن", "مسیریابی", "نشان", "گوگل مپ"
  ],
  price: ["شهریه", "هزینه", "قیمت", "تومان", "اقساط"],
  hours: ["ساعت کاری", "ساعات کاری", "بازه", "تعطیل"],
  registration: ["ثبت نام", "ثبتنام", "عضویت", "مدارک"],
  beginner: ["مبتدی", "از صفر", "اولین بار"],
  age: ["سن", "حداقل سن", "حداکثر سن"],
  certificate: ["مدرک", "گواهی", "گواهینامه", "سرتیفیکیت"]
};

function detectTopics(query, queryWords) {
  return Object.entries(TOPIC_KEYWORDS)
    .filter(([, terms]) =>
      terms.some((term) => scoreMatch(query, queryWords, normalizeText(term)) > 0)
    )
    .map(([topic]) => topic);
}

/* ============================================================
   Closing block
   Appended to every real answer: how to actually act on the
   information (call to register / arrange a class time) plus
   the address, so an answer never leaves the visitor wondering
   what to do next.
============================================================ */

function closingBlock() {
  return {
    lines: [
      {
        text: `برای ثبت‌نام و هماهنگی ساعت کلاس، لطفاً با شماره ${isolateLTR(contact.phones.mobile.display)} تماس بگیرید.`,
        linkText: "ثبت‌نام",
        href: "/register"
      },
      `📍 آدرس: ${contact.address.full}`
    ],
    links: []
  };
}

function withClosing(result) {
  if (!result || !result.found) return result;
  const closing = closingBlock();
  return {
    ...result,
    lines: [...(result.lines || []), ...closing.lines],
    links: [...(result.links || []), ...closing.links]
  };
}

/* ============================================================
   Answer builders
   Each returns { found, heading, lines, links }. A line is
   normally plain text, or — for the one closing sentence that
   needs a clickable word inside it — an object of the form
   { text, linkText, href }.
============================================================ */

function buildCourseAnswer(course) {
  const teacherRecords = (course.instructors || [])
    .map((id) => instructors.find((person) => person.id === id))
    .filter(Boolean);

  const teacherNames = teacherRecords.map((person) => person.name).join(" و ");

  const faqs = generateCourseFAQ(course.id);
  const scheduleFaq = faqs.find((item) => item.question.includes("روزهایی"));
  const priceFaq = faqs.find((item) => item.question.includes("هزینه"));

  const lines = [];
  if (teacherNames) lines.push(`👨‍🏫 مدرس: ${teacherNames}`);
  lines.push(`📅 ${scheduleFaq ? scheduleFaq.answer : "برنامه هفتگی این دوره به‌زودی اعلام می‌شود."}`);
  lines.push(`💳 ${priceFaq ? priceFaq.answer : "برای اطلاع از شهریه با آموزشگاه تماس بگیرید."}`);

  const links = [{ label: `مشاهده دوره ${course.title}`, href: `/courses/${course.slug}` }];
  teacherRecords.forEach((person) => {
    links.push({ label: `پروفایل ${person.name}`, href: `/instructors/${person.slug}` });
  });

  return { found: true, heading: course.title, lines, links };
}

function buildInstructorAnswer(person) {
  const taughtCourses = (person.relations?.courses || [])
    .map((slug) => courses.find((course) => course.slug === slug && course.active !== false))
    .filter(Boolean);

  const days = [
    ...new Set(
      schedules
        .filter((item) => item.instructorId === person.id && item.active !== false)
        .map((item) => item.weekday)
    )
  ];

  const lines = [];
  if (person.position) lines.push(`🎼 ${person.position}`);
  if (taughtCourses.length) {
    lines.push(`📚 دوره‌ها: ${taughtCourses.map((course) => course.title).join("، ")}`);
  }
  if (days.length) lines.push(`📅 روزهای حضور: ${days.join(" و ")}`);
  if (!lines.length) lines.push("برای اطلاعات کامل، پروفایل استاد را ببینید.");

  const links = [{ label: `پروفایل ${person.name}`, href: `/instructors/${person.slug}` }];
  taughtCourses.forEach((course) => {
    links.push({ label: `دوره ${course.title}`, href: `/courses/${course.slug}` });
  });

  return { found: true, heading: person.name, lines, links };
}

function buildInstructorDisambiguation(matches) {
  return {
    found: true,
    heading: "چند استاد پیدا شد",
    lines: ["منظورتان کدام استاد است؟"],
    links: matches.map((person) => ({ label: person.name, href: `/instructors/${person.slug}` }))
  };
}

function buildTopicAnswer(topics) {
  if (!topics.length) return null;

  const lines = [];
  const links = [];

  if (topics.includes("contact")) {
    lines.push("راه‌های دیگر ارتباط با آموزشگاه:");
    links.push({ label: "اینستاگرام", href: contact.social.instagram });
    links.push({ label: "تلگرام", href: contact.social.telegram });
    links.push({ label: "مسیریابی در نقشه", href: contact.map.google });
  }

  if (topics.includes("price")) {
    Object.values(pricing.plans).forEach((plan) => {
      const sessions = plan.duration.sessions.toLocaleString("fa-IR");
      const full = plan.paymentOptions.fullTerm.amount.toLocaleString("fa-IR");
      const half = plan.paymentOptions.halfTerm.amount.toLocaleString("fa-IR");
      lines.push(
        `💳 ${plan.title}: ${sessions} جلسه (${plan.duration.period}) — کامل ${full} تومان یا نیم‌ترم ${half} تومان`
      );
    });
  }

  if (topics.includes("hours")) {
    contact.workingHours.forEach((item) => {
      lines.push(`🕐 ${item.title}: ${item.value}`);
    });
  }

  if (topics.includes("registration")) {
    lines.push("ثبت‌نام به‌صورت حضوری یا از طریق همین فرم انجام می‌شود؛ بعد از هماهنگی، روز و ساعت کلاس با استاد تعیین می‌شود.");
  }

  if (topics.includes("beginner")) {
    lines.push("بله؛ همه دوره‌ها از سطح کاملاً مبتدی شروع می‌شوند و نیازی به پیش‌زمینه نیست.");
  }

  if (topics.includes("age")) {
    lines.push("محدودیت سنی برای یادگیری وجود ندارد؛ کلاس‌های کودک، نوجوان و بزرگسال جدا برگزار می‌شود.");
  }

  if (topics.includes("certificate")) {
    lines.push("در صورت فعال‌سازی سامانه آموزشی آموزشگاه، امکان صدور گواهی پایان دوره فراهم می‌شود.");
  }

  if (!lines.length) return null;
  return { found: true, heading: "پاسخ آموزشگاه", lines, links };
}

/* ============================================================
   Public API
============================================================ */

/**
 * Answers a free-text question using only real academy data.
 *
 * @param {string} rawText
 * @returns {{found:boolean, heading?:string, lines?:(string|{text:string,linkText:string,href:string})[], links?:object[], hint?:string}}
 */
export function ask(rawText = "") {
  const query = normalizeText(rawText);
  if (query.length < 2) return { found: false };

  const queryWords = query.split(" ").filter(Boolean);

  const course = matchCourse(query, queryWords);
  if (course) return withClosing(buildCourseAnswer(course));

  const instructorMatches = matchInstructors(query, queryWords);
  if (instructorMatches.length === 1) return withClosing(buildInstructorAnswer(instructorMatches[0]));
  if (instructorMatches.length > 1) return buildInstructorDisambiguation(instructorMatches);

  const topics = detectTopics(query, queryWords);
  const topicAnswer = buildTopicAnswer(topics);
  if (topicAnswer) return withClosing(topicAnswer);

  if (query.length >= 6) {
    return {
      found: false,
      hint: "می‌توانید نام ساز مورد نظر (مثلاً گیتار، تار، آواز) یا موضوعی مثل هزینه، ثبت‌نام یا آدرس را بنویسید."
    };
  }

  return { found: false };
}

export default { ask, normalizeText };
