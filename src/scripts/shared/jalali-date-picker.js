const MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const WEEKDAYS = ["ش","ی","د","س","چ","پ","ج"];
const faDigits = "۰۱۲۳۴۵۶۷۸۹";

function faToLatin(value) { return String(value ?? "").replace(/[۰-۹]/g, d => String(faDigits.indexOf(d))); }
function latinToFa(value) { return String(value).replace(/\d/g, d => faDigits[Number(d)]); }
function pad(value) { return String(value).padStart(2, "0"); }
function parts(date) {
  const p = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { calendar: "persian", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(date);
  return Object.fromEntries(p.filter(x => x.type !== "literal").map(x => [x.type, x.value]));
}
function jalaliOf(date) { const p = parts(date); return { year:Number(p.year), month:Number(p.month), day:Number(p.day), weekday:p.weekday }; }
function findGregorianForJalali(year, month, day) {
  const target = `${year}/${month}/${day}`;
  const start = new Date(Date.UTC(year + 621, month < 3 ? 2 : 5, 1));
  for (let i = -120; i <= 420; i++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
    const j = jalaliOf(d);
    if (`${j.year}/${j.month}/${j.day}` === target) return d;
  }
  return null;
}
function firstOfMonth(year, month) { return findGregorianForJalali(year, month, 1); }
function normalize(value) {
  const raw = faToLatin(value).trim().replace(/[.-]/g, "/").replace(/\s+/g, "");
  const m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  const y=Number(m[1]), mo=Number(m[2]), d=Number(m[3]);
  if (mo<1 || mo>12 || d<1 || d>31 || !firstOfMonth(y,mo)) return "";
  const next = mo===12 ? firstOfMonth(y+1,1) : firstOfMonth(y,mo+1);
  const cur = firstOfMonth(y,mo);
  const max = next ? Math.round((next-cur)/86400000) : (mo<=6?31:mo===12?30:30);
  if (d>max) return "";
  return `${latinToFa(y)}/${latinToFa(pad(mo))}/${latinToFa(pad(d))}`;
}

function createPicker(input) {
  if (!input || input.dataset.jalaliPickerReady === "true") return;
  input.dataset.jalaliPickerReady = "true";
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("placeholder", input.getAttribute("placeholder") || "۱۴۰۵/۰۱/۰۱");
  const wrapper = document.createElement("div"); wrapper.className="jalali-picker";
  input.parentNode.insertBefore(wrapper,input); wrapper.appendChild(input);
  const button=document.createElement("button"); button.type="button"; button.className="jalali-picker-toggle"; button.setAttribute("aria-label","باز کردن تقویم شمسی"); button.innerHTML="<span>▣</span>"; wrapper.appendChild(button);
  const pop=document.createElement("div"); pop.className="jalali-picker-popover"; pop.hidden=true; wrapper.appendChild(pop);
  let selected = normalize(input.value);
  const now=jalaliOf(new Date());
  let viewYear=selected ? Number(faToLatin(selected).slice(0,4)) : now.year;
  let viewMonth=selected ? Number(faToLatin(selected).slice(5,7)) : now.month;

  function render() {
    const first=firstOfMonth(viewYear,viewMonth); if(!first) return;
    const daysInMonth = viewMonth<=6 ? 31 : viewMonth<=11 ? 30 : (firstOfMonth(viewYear+1,1) ? Math.round((firstOfMonth(viewYear+1,1)-first)/86400000) : 30);
    const firstDay=jalaliOf(first); // Intl weekday: شنبه/یکشنبه/...; map through short labels
    const weekdayIndex={"شنبه":0,"یکشنبه":1,"دوشنبه":2,"سه‌شنبه":3,"چهارشنبه":4,"پنجشنبه":5,"جمعه":6}[firstDay.weekday] ?? 0;
    let html=`<div class="jalali-picker-head"><button type="button" data-prev aria-label="ماه قبل">‹</button><strong>${MONTHS[viewMonth-1]} ${latinToFa(viewYear)}</strong><button type="button" data-next aria-label="ماه بعد">›</button></div><div class="jalali-picker-weekdays">${WEEKDAYS.map(x=>`<span>${x}</span>`).join("")}</div><div class="jalali-picker-days">`;
    for(let i=0;i<weekdayIndex;i++) html+="<span></span>";
    for(let day=1;day<=daysInMonth;day++) {
      const val=`${latinToFa(viewYear)}/${latinToFa(pad(viewMonth))}/${latinToFa(pad(day))}`;
      const active=selected===val?" is-selected":"";
      html+=`<button type="button" class="jalali-picker-day${active}" data-day="${val}">${latinToFa(day)}</button>`;
    }
    html+="</div>";
    pop.innerHTML=html;
    pop.querySelector("[data-prev]").onclick=()=>{viewMonth--;if(viewMonth<1){viewMonth=12;viewYear--;}render();};
    pop.querySelector("[data-next]").onclick=()=>{viewMonth++;if(viewMonth>12){viewMonth=1;viewYear++;}render();};
    pop.querySelectorAll("[data-day]").forEach(btn=>btn.onclick=()=>{selected=btn.dataset.day;input.value=selected;input.dispatchEvent(new Event("change",{bubbles:true}));pop.hidden=true;});
  }
  function open(){ const n=normalize(input.value); if(n){selected=n;viewYear=Number(faToLatin(n).slice(0,4));viewMonth=Number(faToLatin(n).slice(5,7));} render();pop.hidden=false; }
  button.onclick=()=>pop.hidden?open():(pop.hidden=true);
  input.addEventListener("focus",open);
  input.addEventListener("blur",()=>{setTimeout(()=>{if(!wrapper.contains(document.activeElement))pop.hidden=true;},120);});
  input.addEventListener("input",()=>{const n=normalize(input.value);if(n) input.value=n;});
}

export function initJalaliDatePickers(root=document) {
  root.querySelectorAll("[data-jalali-date-picker]").forEach(createPicker);
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",()=>initJalaliDatePickers());
  else initJalaliDatePickers();
}