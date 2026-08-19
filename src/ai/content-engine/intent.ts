// Search-intent classification. Rule-based and title-only, so it works
// uniformly whether a title came from the template generator or (future)
// LLM-assisted expansion, and needs no network call to run.
//
// Per doc/CONTENT_ENGINE_SPECIFICATION.md this project explicitly avoids
// being a "Music Shop" -- so informational/how-to intent is the primary
// target, and transactional/commercial titles are intentionally scored
// lower in scoring.ts rather than filtered out entirely (a handful of
// "چقدر هزینه دارد" style posts are still legitimate and helpful).

import { normalizePersianText } from "./normalize";
import type { SearchIntent } from "./types";

const TRANSACTIONAL_TERMS = ["ثبت‌نام", "ثبت نام", "هزینه", "شهریه", "قیمت", "تعرفه", "رزرو کلاس", "خرید"];
const NAVIGATIONAL_TERMS = ["آموزشگاه فاتح", "آموزشگاه موسیقی فاتح", "فاتح موزیک", "خلیل دلاوران"];
const COMMERCIAL_TERMS = ["بهترین", "مقایسه", "تفاوت", " یا ", "راهنمای خرید", "کدام را انتخاب"];

/** Returns the single strongest matching intent. Order matters: a title
 * mentioning both the brand and a price ("هزینه ثبت‌نام در آموزشگاه فاتح")
 * is still primarily transactional intent from the searcher's point of
 * view, so transactional is checked first. */
export function classifyIntent(title: string): SearchIntent {
  const text = normalizePersianText(title);
  if (TRANSACTIONAL_TERMS.some((term) => text.includes(term))) return "transactional";
  if (NAVIGATIONAL_TERMS.some((term) => text.includes(term))) return "navigational";
  if (COMMERCIAL_TERMS.some((term) => text.includes(term))) return "commercial";
  return "informational";
}
