import {
  formatJalali,
  jalaliMonthDays,
  jalaliMonthNames,
  parseJalali,
  toEnglishDigits,
  toPersianDigits,
  todayJalali
} from "../utils/jalali-date.js";

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function gregorianWeekdayForJalali(year, month, day) {
  const { year: gy, month: gm, day: gd } = (() => {
    const { jalaliToGregorian } = requireFallback();
    return jalaliToGregorian(year, month, day);
  })();
  return new Date(gy, gm - 1, gd).getDay();
}

// Kept local to avoid coupling the picker to browser Intl implementations.
function requireFallback() {
  return { jalaliToGregorian: (jy, jm, jd) => {
    let jy2 = jy - 979;
    let jDayNo = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
    for (let i = 1; i < jm; i++) jDayNo += i <= 6 ? 31 : 30;
    jDayNo += jd - 1;
    let gDayNo = jDayNo + 79;
    let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
    gDayNo %= 146097;
    let leap = true;
    if (gDayNo >= 36525) { gDayNo--; gy += 100 * Math.floor(gDayNo / 36524); gDayNo %= 36524; if (gDayNo >= 365) gDayNo++; else leap = false; }
    gy += 4 * Math.floor(gDayNo / 1461); gDayNo %= 1461;
    if (gDayNo >= 366) { leap = false; gDayNo--; gy += Math.floor(gDayNo / 365); gDayNo %= 365; }
    const md = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 1;
    while (gDayNo >= md[gm - 1]) { gDayNo -= md[gm - 1]; gm++; }
    return { year: gy, month: gm, day: gDayNo + 1 };
  }};
}

export function initJalaliDatePickers(root = document) {
  root.querySelectorAll("input[data-jalali-datepicker]").forEach((input) => {
    if (input.dataset.jalaliReady === "true") return;
    input.dataset.jalaliReady = "true";
    attach(input);
  });
}

function attach(input) {
  input.setAttribute("autocomplete", "off");
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("dir", "ltr");
  const initial = parseJalali(input.value) || todayJalali();
  let view = { year: initial.year, month: initial.month };

  const wrap = document.createElement("div");
  wrap.className = "jalali-picker-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const pop = document.createElement("div");
  pop.className = "jalali-picker";
  pop.hidden = true;
  pop.setAttribute("dir", "rtl");
  wrap.appendChild(pop);

  function render() {
    const selected = parseJalali(input.value);
    const first = gregorianWeekdayForJalali(view.year, view.month, 1);
    const days = jalaliMonthDays(view.year, view.month);
    let html = `<div class="jalali-picker-header"><button type="button" data-prev aria-label="ماه قبل">‹</button><button type="button" data-title>${jalaliMonthNames[view.month - 1]} ${toPersianDigits(view.year)}</button><button type="button" data-next aria-label="ماه بعد">›</button></div>`;
    html += `<div class="jalali-picker-week">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div><div class="jalali-picker-days">`;
    for (let i = 0; i < first; i++) html += `<span class="empty"></span>`;
    for (let d = 1; d <= days; d++) {
      const active = selected && selected.year === view.year && selected.month === view.month && selected.day === d;
      html += `<button type="button" data-day="${d}" class="${active ? "active" : ""}">${toPersianDigits(d)}</button>`;
    }
    html += `</div><button type="button" class="jalali-picker-today" data-today>امروز</button>`;
    pop.innerHTML = html;
  }

  function open() { const p = parseJalali(input.value) || todayJalali(); view = { year: p.year, month: p.month }; render(); pop.hidden = false; input.setAttribute("aria-expanded", "true"); }
  function close() { pop.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function changeMonth(delta) { view.month += delta; if (view.month === 13) { view.month = 1; view.year++; } if (view.month === 0) { view.month = 12; view.year--; } render(); }
  function choose(day) { input.value = formatJalali({ year: view.year, month: view.month, day }); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); close(); }

  input.setAttribute("aria-haspopup", "dialog");
  input.setAttribute("aria-expanded", "false");
  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("blur", () => { const value = input.value.trim(); if (value && !parseJalali(value)) input.setCustomValidity("تاریخ شمسی معتبر وارد کنید."); else input.setCustomValidity(""); });
  pop.addEventListener("click", (e) => { const day = e.target.closest("[data-day]"); if (day) choose(Number(day.dataset.day)); if (e.target.closest("[data-prev]")) changeMonth(-1); if (e.target.closest("[data-next]")) changeMonth(1); if (e.target.closest("[data-today]")) { const t = todayJalali(); view = { year: t.year, month: t.month }; choose(t.day); } });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
}

document.addEventListener("DOMContentLoaded", () => initJalaliDatePickers());
