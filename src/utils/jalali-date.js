const JALALI_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

const GREGORIAN_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const jalaliMonthNames = JALALI_MONTH_NAMES;

export function toPersianDigits(value) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function toEnglishDigits(value) {
  return String(value).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

export function isJalaliLeapYear(year) {
  const remainder = ((year - 10) % 33 + 33) % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(remainder);
}

export function jalaliMonthDays(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

function div(a, b) {
  return Math.floor(a / b);
}

export function gregorianToJalali(gy, gm, gd) {
  const gdm = GREGORIAN_MONTH_DAYS;
  let gy2 = gy - 1600;
  let gm2 = gm - 1;
  let gd2 = gd - 1;
  let gDayNo = 365 * gy2 + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400);
  for (let i = 0; i < gm2; i++) gDayNo += gdm[i];
  if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) gDayNo++;
  gDayNo += gd2;

  let jDayNo = gDayNo - 79;
  const jNp = div(jDayNo, 12053);
  jDayNo %= 12053;
  let jy = 979 + 33 * jNp + 4 * div(jDayNo, 1461);
  jDayNo %= 1461;
  if (jDayNo >= 366) {
    jy += div(jDayNo - 1, 365);
    jDayNo = (jDayNo - 1) % 365;
  }
  let jm = jDayNo < 186 ? 1 + div(jDayNo, 31) : 7 + div(jDayNo - 186, 30);
  const jd = 1 + (jDayNo < 186 ? jDayNo % 31 : (jDayNo - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

export function jalaliToGregorian(jy, jm, jd) {
  let jy2 = jy - 979;
  let jDayNo = 365 * jy2 + div(jy2, 33) * 8 + div((jy2 % 33) + 3, 4);
  for (let i = 1; i < jm; i++) jDayNo += i <= 6 ? 31 : 30;
  jDayNo += jd - 1;
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * div(gDayNo, 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--;
    gy += 100 * div(gDayNo, 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo++;
    else leap = false;
  }
  gy += 4 * div(gDayNo, 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo--;
    gy += div(gDayNo, 365);
    gDayNo %= 365;
  }
  let gm = 1;
  const monthDays = [...GREGORIAN_MONTH_DAYS];
  if (leap) monthDays[1] = 29;
  while (gDayNo >= monthDays[gm - 1]) {
    gDayNo -= monthDays[gm - 1];
    gm++;
  }
  return { year: gy, month: gm, day: gDayNo + 1 };
}

export function todayJalali() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function formatJalali({ year, month, day }, persian = true) {
  const value = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  return persian ? toPersianDigits(value) : value;
}

export function parseJalali(value) {
  const digits = toEnglishDigits(String(value).trim());
  const match = digits.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > jalaliMonthDays(year, month)) return null;
  return { year, month, day };
}
