/*
====================================================
File: src/scripts/registration/ContractTemplates.ts

Purpose:
Fills the academy's two "قرارداد هنرجویی" (student contract)
templates from a completed registration, for display/printing on
the Success step. The two templates are identical except for the
session/duration clause in ماده ۲ and the leave clause in ماده ۴(ب);
which one applies is decided by data/pricing.js's coursePricingMap
("standard" vs "keyboard"), the same mapping already used to show
pricing on the Review step -- not a second, separately-maintained
list of which instruments count as "keyboard".

What is NOT auto-filled, and why:
- (nothing left -- see below for how the previously-blank fields are
  now computed)

ترم (term number) IS auto-filled: src/pages/api/register.ts counts
this student's prior registrations by national code and returns
term = count + 1, per Khalil's rule ("هر ترم باید ثبت‌نام کنه").
That value flows back through RegistrationApi -> RegistrationStore
(state.term) into buildContract below.

تاریخ in ماده ۲ (class start date) IS auto-filled: per Khalil's
rule, it's the first upcoming occurrence of the student's chosen
weekday on or after "now" (registration time) -- e.g. registering
on شنبه for a پنج‌شنبه class starts that same پنج‌شنبه. See
computeClassStartDate below.

Architecture:
- Pure functions only, no DOM access -- RegistrationRenderer is
  responsible for turning a ContractResult into markup.
====================================================
*/

import type { RegistrationState } from "./RegistrationStore";
import { pricing } from "../../data/pricing";
import { formatJalaliDate } from "../../utils/format-date";
import { formatMobileDisplay, toPersianDigits, WEEKDAY_ORDER } from "./RegistrationUtils";

export interface ContractBlock {
  heading?: string;
  paragraphs: string[];
}

export interface ContractResult {
  isKeyboardPlan: boolean;
  blocks: ContractBlock[];
  signature: {
    studentName: string;
    date: string;
  };
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد"];

function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];

  if (hundreds) parts.push(HUNDREDS[hundreds]);

  if (rest) {
    if (rest < 10) parts.push(ONES[rest]);
    else if (rest < 20) parts.push(TEENS[rest - 10]);
    else {
      const tensDigit = Math.floor(rest / 10);
      const onesDigit = rest % 10;
      parts.push(onesDigit ? `${TENS[tensDigit]} و ${ONES[onesDigit]}` : TENS[tensDigit]);
    }
  }

  return parts.join(" و ");
}

/** Converts a non-negative integer to Persian words, e.g. 32000000 -> "سی و دو میلیون". */
export function numberToPersianWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "صفر";

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const phrases: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (!group) continue;
    const words = threeDigitsToWords(group);
    phrases.push(SCALES[i] ? `${words} ${SCALES[i]}` : words);
  }

  return phrases.join(" و ");
}

/** "آموزش گیتار" / "دوره سلفژ" -> "گیتار" / "سلفژ", for the ماده ۲ "رشته" field. */
function courseSubject(title: string): string {
  return title.replace(/^(آموزش|دوره)\s+/, "").trim();
}

function honorific(gender: RegistrationState["student"]["gender"]): string {
  if (gender === "female") return "خانم";
  if (gender === "male") return "آقای";
  return "خانم/آقای";
}

/**
 * First occurrence of `weekday` on or after `from`, per Khalil's rule:
 * "اولین جلسه همان هفته پس از ثبت‌نام" -- e.g. registering شنبه for a
 * پنج‌شنبه class starts that same پنج‌شنبه (5 days later); registering
 * on a day that already passed this week's occurrence of the target
 * still resolves forward (never negative/in the past).
 */
export function computeClassStartDate(weekday: string | null, from: Date): Date | null {
  const targetIndex = weekday ? WEEKDAY_ORDER.indexOf(weekday) : -1;
  if (targetIndex === -1) return null;

  const jsDay = from.getDay(); // 0=Sunday..6=Saturday
  const todayIndex = (jsDay + 1) % 7; // شنبه=0 .. جمعه=6
  const offsetDays = (targetIndex - todayIndex + 7) % 7;

  const start = new Date(from);
  start.setDate(start.getDate() + offsetDays);
  return start;
}

/** Builds the fully-filled contract for a completed registration, or null if the state isn't complete enough yet. */
export function buildContract(state: RegistrationState): ContractResult | null {
  const { instrument } = state.selection;
  const { student } = state;

  if (!instrument.slug || !instrument.title || !student.firstName) return null;

  const planKey = (pricing.coursePricingMap as Record<string, string | undefined>)[instrument.slug];
  const isKeyboardPlan = planKey === "keyboard";
  const plan = planKey ? (pricing.plans as Record<string, typeof pricing.plans.standard>)[planKey] : null;

  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const signatureDate = formatJalaliDate(new Date());
  const startDate = computeClassStartDate(state.selection.schedule.weekday, new Date());
  const startDateText = startDate ? formatJalaliDate(startDate) : "..........................";

  const sessionClause = isKeyboardPlan
    ? "۱ ترم ۱۰ جلسه‌ای به میزان هر جلسه ۳۰ دقیقه‌ای در هفته"
    : "یک ترم ۸ جلسه‌ای به میزان هر جلسه ۳۰ دقیقه‌ای در هفته";

  const durationClause = isKeyboardPlan ? "ده هفته متوالی" : "دو ماه";

  const leaveClause = isKeyboardPlan
    ? "هنرجو نمی‌تواند در طی ترم، از آموزشگاه مرخصی بگیرد. و چنانچه مرخصی بخواهد، غیبت محسوب شده و شهریه از هنرجو کسر می‌گردد."
    : "هنرجو نمی‌تواند در طی ترم، از آموزشگاه مرخصی بگیرد. و غیبت منظور می‌شود.";

  // Pricing data is stored in Toman (see formatToman's doc comment); the
  // contract text explicitly asks for ریال, which is 10x Toman.
  const amountRial = plan ? plan.paymentOptions.fullTerm.amount * 10 : null;

  const blocks: ContractBlock[] = [
    { paragraphs: ["به‌نام خدا"] },
    {
      paragraphs: [
        "تعریف: قرارداد هنرجویی قراردادی است که به منظور تعیین میزان تعهدات هنرجو و آموزشگاه نسبت به‌یکدیگر منعقد می‌گردد."
      ]
    },
    {
      heading: "ماده ۱- مشخصات طرفین قرارداد:",
      paragraphs: [
        `طرف اول: ${honorific(student.gender)} ${fullName} فرزند: ${student.fatherName || "................"} ` +
          `کدملی: ${student.nationalCode ? toPersianDigits(student.nationalCode) : "................"} ` +
          `صادره از: ${student.idIssuePlace || "................"} ` +
          `متولد سال: ${student.birthYear ? toPersianDigits(student.birthYear) : "................"} ` +
          `شغل: ${student.occupation || "................"} ` +
          `آدرس: ${student.address || "................"} ` +
          `شماره همراه: ${student.mobile ? formatMobileDisplay(student.mobile) : "................"} ` +
          "که در این قرارداد هنرجو اطلاق می‌گردد.",
        "طرف دوم آموزشگاه موسیقی فاتح واقع در شوشتر، خیابان امام ضلع غربی، میدان حاج سلیمان به مدیریت آقای رضا فاتح که در این قرارداد آموزشگاه عنوان می‌شود."
      ]
    },
    {
      heading: "ماده ۲- موضوع و مدت قرارداد:",
      paragraphs: [
        `آموزش رشته: ${courseSubject(instrument.title)} ترم: ${state.term ? toPersianDigits(state.term) : ".........."} بر اساس درس‌های تعیین شده و برنامه آموزشی ` +
          `اعلام شده توسط آموزشگاه موسیقی فاتح به میزان ${sessionClause} از تاریخ: ${startDateText} ` +
          `به مدت ${durationClause} اجرا خواهد شد. و هنرجو آمار حضور خود در جلسات مربوطه از کلاس را که توسط ` +
          "آموزشگاه نوشته شده را تائید می‌کند."
      ]
    },
    {
      heading: "ماده ۳- مبلغ قرارداد (هزینه هنرجویی):",
      paragraphs: [
        `هنرجو موظف است مبلغ (با حرف: ${amountRial ? `${numberToPersianWords(amountRial)} ریال` : "................"} ` +
          `/ با عدد: ${amountRial ? toPersianDigits(amountRial.toLocaleString("en-US")) : "................"}) ریال ` +
          "را به‌عنوان شهریه یک ترم در مقابل رسید چاپی کارت‌خوان، در هنگام ثبت‌نام به آموزشگاه پرداخت نماید."
      ]
    },
    {
      heading: "ماده ۴- تعهدات هنرجو:",
      paragraphs: [
        "الف) از تاریخ تنظیم این قرارداد به بعد، در صورتی که هنرجو به هر دلیل یا علت، از تحصیل در آموزشگاه و شرکت " +
          "در کلاس‌های آن منصرف یا به‌هر بهانه، عذر و جهتی، توانایی و امکان شرکت در کلاس‌ها را (پیش یا پس از شروع " +
          "دوره) از دست بدهد، هیچ وجهی از شهریه دریافتی توسط آموزشگاه به هنرجو پس داده نخواهد شد.",
        `ب) ${leaveClause} شماره ارتباطی آموزشگاه با هنرجو، شماره همراه مندرج در قرارداد می‌باشد. و هر گونه مشکل در ` +
          "ارتباط، به عهده هنرجو بوده و موجب غیبت می‌شود. و همچنین روزها یا جلساتِ غیبتِ هنرجو، برگزار شده منظور " +
          "می‌شود، و آموزشگاه تعهدی مبنی بر جبران آنها نخواهد داشت."
      ]
    },
    {
      heading: "ماده ۵- تعهدات آموزشگاه:",
      paragraphs: ["آموزشگاه تا پایان مدت این قرارداد موظف به اجرای موضوع قرارداد (آموزش) می‌باشد."]
    },
    {
      heading: "ماده ۶-",
      paragraphs: [
        `این قرارداد مشتمل بر ۵ ماده، و در ۱ نسخه که در حکم واحد تاریخ ${signatureDate} توسط طرفین تائید و امضاء و ` +
          "مبادله شد و شرعاً و عرفاً متعهد شود."
      ]
    }
  ];

  return {
    isKeyboardPlan,
    blocks,
    signature: { studentName: fullName, date: signatureDate }
  };
}
