// Structured seed data for the Content Intelligence Engine.
// Pure data only (per AGENTS.md "Store structured data in src/data/") --
// the generation logic that fills these templates lives in
// src/ai/content-engine/candidates.ts.
//
// Every template was hand-written for natural Persian phrasing (per
// AGENTS.md "Never produce robotic Persian" / "Content must read
// naturally") -- none of this is mechanical slot-filling of an English
// pattern translated word-for-word.

import type { ModifierType } from "../ai/content-engine/types";

/** {name} is replaced with the plain instrument/topic name derived from
 * the course title (see derivePlainName in candidates.ts). */
export const MODIFIER_TEMPLATES: Record<ModifierType, string[]> = {
  how_to: [
    "چگونه {name} را از صفر یاد بگیریم؟",
    "راهنمای گام‌به‌گام یادگیری {name} برای مبتدی‌ها",
    "از کجا شروع کنیم: مسیر یادگیری {name}"
  ],
  mistakes: [
    "رایج‌ترین اشتباهات هنرجویان {name} و راه اصلاح آن‌ها",
    "چند اشتباه که یادگیری {name} را کند می‌کند"
  ],
  comparison: [
    // Filled from COMPARISON_PAIRS below, not combinatorially generated.
    "تفاوت {name} و {name2} در چیست؟ کدام را انتخاب کنیم",
    "{name} یا {name2}؛ مقایسه‌ای برای انتخاب ساز مناسب شما"
  ],
  buying_guide: [
    "راهنمای خرید {name} مناسب برای مبتدی‌ها",
    "قبل از خرید {name} این نکات را بدانید"
  ],
  practice_tips: [
    "تکنیک‌های تمرین مؤثر برای هنرجویان {name}",
    "چطور با تمرین کم، در {name} پیشرفت محسوس داشته باشیم"
  ],
  theory_link: [
    "چرا دانستن تئوری موسیقی برای نواختن {name} مهم است",
    "ارتباط سلفژ و ریتم‌خوانی با یادگیری {name}"
  ],
  parent_guide: [
    "راهنمای والدین برای همراهی فرزند در یادگیری {name}",
    "چطور بفهمیم فرزندمان برای یادگیری {name} آماده است"
  ],
  local_shushtar: [
    "آموزش {name} در شوشتر؛ چه انتظاری داشته باشیم",
    "چرا آموزشگاه فاتح برای یادگیری {name} در شوشتر انتخاب خوبی است"
  ],
  age_specific: [
    // Index 0: کودک, 1: نوجوان, 2: بزرگسال -- picked by audience in candidates.ts
    "{name} برای کودکان؛ از چه سنی شروع کنیم",
    "یادگیری {name} در نوجوانی؛ فرصتی که نباید از دست داد",
    "شروع {name} در بزرگسالی؛ هرگز دیر نیست"
  ],
  benefits: [
    "فواید یادگیری {name} برای رشد ذهنی و تمرکز",
    "{name} چه تاثیری روی اعتمادبه‌نفس و آرامش دارد"
  ],
  career_path: [
    "مسیر حرفه‌ای شدن در {name}؛ از کلاس اول تا اجرای زنده",
    "بعد از یادگیری {name} چه فرصت‌هایی پیش رو داریم"
  ],
  evergreen_general: [] // filled directly from GENERAL_EVERGREEN_TOPICS, no template
};

/** Which audiences make sense for each modifier type. Empty string means
 * "general / unspecified" and is valid unless explicitly excluded here. */
export const MODIFIER_AUDIENCE_RULES: Record<ModifierType, Array<"" | "کودک" | "نوجوان" | "بزرگسال">> = {
  how_to: ["", "کودک", "نوجوان", "بزرگسال"],
  mistakes: ["", "نوجوان", "بزرگسال"],
  comparison: [""],
  buying_guide: ["", "کودک", "نوجوان", "بزرگسال"],
  practice_tips: ["", "نوجوان", "بزرگسال"],
  theory_link: ["", "نوجوان", "بزرگسال"],
  parent_guide: ["کودک", "نوجوان"], // only makes sense when there IS a child/teen
  local_shushtar: [""],
  age_specific: ["کودک", "نوجوان", "بزرگسال"], // audience IS the point, general excluded
  benefits: ["", "کودک", "نوجوان", "بزرگسال"],
  career_path: ["", "نوجوان", "بزرگسال"], // a full career path pitch to a child doesn't make sense
  evergreen_general: [""]
};

/** Hand-curated, meaningful comparison pairs (never combinatorial --
 * AGENTS.md Decision 009 explicitly treats e.g. violin/kamancheh as
 * distinct-intent pages, which is exactly why a *comparison* article
 * between them is useful; arbitrary pairs like guitar/tonbak are not). */
export const COMPARISON_PAIRS: Array<[string, string]> = [
  ["tar-course", "setar-course"],
  ["violin-course", "kamancheh-course"],
  ["piano-course", "keyboard-course"],
  ["daf-course", "tonbak-course"],
  ["tonbak-course", "zarb-tempo-course"],
  ["ney-course", "ney-anban-course"],
  ["pop-vocal-course", "traditional-vocal-course"]
];

/** General/evergreen topics not tied to a single instrument -- parenting,
 * pedagogy, and academy-choice angles. Extends the smaller hardcoded list
 * that used to live inline in ai-post-generator.ts. */
export const GENERAL_EVERGREEN_TOPICS: string[] = [
  "چطور بفهمیم بچه‌مان برای شروع آموزش موسیقی آماده است",
  "تفاوت آموزش حضوری و آنلاین موسیقی و اینکه کدام مناسب‌تر است",
  "نقش موسیقی در تقویت تمرکز، حافظه و اعتماد‌به‌نفس کودکان",
  "چگونه اولین ساز موسیقی مناسب خودمان را انتخاب کنیم",
  "چرا تمرین منظم و کم، مهم‌تر از استعداد ذاتی است",
  "چند اشتباه رایج هنرجویان تازه‌کار موسیقی و راه رفع آن‌ها",
  "چطور یک آموزشگاه موسیقی مناسب در شهرمان پیدا کنیم",
  "چرا هیچ‌وقت برای شروع یادگیری موسیقی دیر نیست",
  "چگونه انگیزه‌ی تمرین روزانه‌ی فرزندمان را حفظ کنیم",
  "تفاوت کلاس خصوصی و گروهی موسیقی؛ کدام برای فرزند شما بهتر است",
  "موسیقی و تحصیل؛ آیا یادگیری ساز به درس خواندن هم کمک می‌کند؟",
  "چطور یک برنامه‌ی تمرین هفتگی واقع‌بینانه برای خودمان بچینیم"
];

/** Local SEO anchor phrases the scoring engine looks for / can suggest,
 * matching AGENTS.md's "always reinforce Shushtar / Khuzestan" rule. */
export const LOCAL_ANCHOR_TERMS: string[] = ["شوشتر", "خوزستان", "آموزشگاه فاتح", "آموزشگاه موسیقی فاتح"];
