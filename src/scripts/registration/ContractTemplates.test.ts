import { describe, expect, it } from "vitest";
import { buildContract, computeClassStartDate, numberToPersianWords } from "./ContractTemplates";
import type { RegistrationState } from "./RegistrationStore";

describe("numberToPersianWords", () => {
  it("converts zero", () => {
    expect(numberToPersianWords(0)).toBe("صفر");
  });

  it("converts single digits and teens", () => {
    expect(numberToPersianWords(7)).toBe("هفت");
    expect(numberToPersianWords(15)).toBe("پانزده");
  });

  it("converts tens with and without a remainder", () => {
    expect(numberToPersianWords(40)).toBe("چهل");
    expect(numberToPersianWords(32)).toBe("سی و دو");
  });

  it("converts hundreds", () => {
    expect(numberToPersianWords(600)).toBe("ششصد");
  });

  it("converts the actual tuition amounts used in the contract (Rial, after the Toman x10 conversion)", () => {
    expect(numberToPersianWords(32000000)).toBe("سی و دو میلیون");
    expect(numberToPersianWords(40000000)).toBe("چهل میلیون");
    expect(numberToPersianWords(16000000)).toBe("شانزده میلیون");
    expect(numberToPersianWords(20000000)).toBe("بیست میلیون");
  });

  it("joins a mixed millions + thousands amount correctly", () => {
    expect(numberToPersianWords(3200000)).toBe("سه میلیون و دویست هزار");
  });
});

describe("computeClassStartDate", () => {
  it("matches Khalil's example exactly: registering on شنبه for a پنج‌شنبه class starts that same پنج‌شنبه (5 days later)", () => {
    const registeredOnSaturday = new Date("2026-08-22T10:00:00"); // confirmed Saturday
    const start = computeClassStartDate("پنج‌شنبه", registeredOnSaturday);
    expect(start?.toDateString()).toBe("Thu Aug 27 2026");
  });

  it("resolves to the same day when registering on the class's own weekday", () => {
    const registeredOnThursday = new Date("2026-08-27T10:00:00"); // confirmed Thursday
    const start = computeClassStartDate("پنج‌شنبه", registeredOnThursday);
    expect(start?.toDateString()).toBe("Thu Aug 27 2026");
  });

  it("moves forward (never into the past) when the chosen weekday already passed this week", () => {
    // Registering Thursday for a شنبه class: شنبه already happened this week,
    // so the next one is 2 days later, not a negative offset.
    const registeredOnThursday = new Date("2026-08-27T10:00:00");
    const start = computeClassStartDate("شنبه", registeredOnThursday);
    expect(start?.toDateString()).toBe("Sat Aug 29 2026");
  });

  it("returns null for an unrecognized weekday instead of guessing", () => {
    expect(computeClassStartDate("نامعتبر", new Date())).toBeNull();
    expect(computeClassStartDate(null, new Date())).toBeNull();
  });
});

function baseState(
  overrides: Partial<RegistrationState["selection"]["instrument"]> = {},
  term: number | null = null
): RegistrationState {
  return {
    currentStep: "success",
    selection: {
      instrument: {
        id: 1,
        slug: "guitar-course",
        title: "آموزش گیتار",
        type: "guitar",
        ...overrides
      },
      instructor: { id: 1, name: "استاد نمونه" },
      schedule: { id: 1, weekday: "شنبه", sessionDuration: 30, classroom: "1", classMode: "حضوری" }
    },
    student: {
      firstName: "علی",
      lastName: "رضایی",
      nationalCode: "0012345678",
      mobile: "09121234567",
      age: 20,
      gender: "male",
      hasInstrument: "yes",
      fatherName: "محمد",
      idIssuePlace: "شوشتر",
      birthYear: 1385,
      occupation: "دانشجو",
      address: "شوشتر، خیابان نمونه"
    },
    trackingCode: "FM-2026-123456",
    term,
    completed: true
  };
}

describe("buildContract", () => {
  it("returns null when the state is not complete enough", () => {
    const state = baseState();
    state.selection.instrument.slug = null;
    expect(buildContract(state)).toBeNull();
  });

  it("selects the standard (non-keyboard) template for a regular instrument", () => {
    const result = buildContract(baseState());
    expect(result?.isKeyboardPlan).toBe(false);
    const article2 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۲"));
    expect(article2?.paragraphs[0]).toContain("یک ترم ۸ جلسه‌ای");
    expect(article2?.paragraphs[0]).toContain("به مدت دو ماه");
  });

  it("selects the keyboard template for piano, with its own session count, duration, and leave clause", () => {
    const result = buildContract(
      baseState({ slug: "piano-course", title: "آموزش پیانو", type: "piano" })
    );
    expect(result?.isKeyboardPlan).toBe(true);

    const article2 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۲"));
    expect(article2?.paragraphs[0]).toContain("۱۰ جلسه‌ای");
    expect(article2?.paragraphs[0]).toContain("ده هفته متوالی");

    const article4 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۴"));
    expect(article4?.paragraphs[1]).toContain("شهریه از هنرجو کسر می‌گردد");
  });

  it("strips the آموزش/دوره prefix from the course title for the رشته field", () => {
    const result = buildContract(baseState({ title: "دوره سلفژ", slug: "solfege-course", type: "theory" }));
    const article2 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۲"));
    expect(article2?.paragraphs[0]).toContain("آموزش رشته: سلفژ ");
  });

  it("fills the known tuition amount for a mapped course, as plain digits with no separators", () => {
    const result = buildContract(baseState());
    const article3 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۳"));
    // standard plan fullTerm is 3,200,000 Toman -> 32,000,000 Rial
    expect(article3?.paragraphs[0]).toContain("سی و دو میلیون ریال");
    expect(article3?.paragraphs[0]).toContain("۳۲۰۰۰۰۰۰");
    expect(article3?.paragraphs[0]).not.toContain(",");
  });

  it("renders the mobile number as plain contiguous Persian digits, not the dashed Latin format (which visually reverses in RTL text)", () => {
    const result = buildContract(baseState());
    const article1 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۱"));
    expect(article1?.paragraphs[0]).toContain("۰۹۱۲۱۲۳۴۵۶۷");
    expect(article1?.paragraphs[0]).not.toContain("-");
  });

  it("fills the term number when the server has computed one", () => {
    const result = buildContract(baseState({}, 3));
    const article2 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۲"));
    expect(article2?.paragraphs[0]).toContain("ترم: ۳ ");
  });

  it("fills the class start date instead of leaving it blank", () => {
    const result = buildContract(baseState({}, 1));
    const article2 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۲"));
    expect(article2?.paragraphs[0]).not.toContain(".........................."); // old placeholder is gone
    expect(article2?.paragraphs[0]).toMatch(/از تاریخ: [۰-۹]+ .+ ۱۴[۰-۹][۰-۹]/); // a real Jalali date
  });

  it("leaves term itself blank too when the server didn't return one (e.g. an old cached state)", () => {
    const result = buildContract(baseState());
    const article2 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۲"));
    expect(article2?.paragraphs[0]).toContain("ترم: .......... ");
  });

  it("falls back to placeholder dots for missing optional student fields instead of showing blank/undefined", () => {
    const state = baseState();
    state.student.fatherName = "";
    const result = buildContract(state);
    const article1 = result?.blocks.find((b) => b.heading?.startsWith("ماده ۱"));
    expect(article1?.paragraphs[0]).toContain("فرزند: ................");
  });
});
