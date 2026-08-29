/*
====================================================
File: src/server/contracts/template.ts

Purpose:
The ONE HTML/CSS template for "قرارداد هنرجویی" (student contract)
PDFs. Every surface that needs a contract PDF -- the registration
wizard's own Success step, the admin panel's "چاپ قرارداد" button,
and the student portal's "PDF قرارداد" link -- renders through this
same function, so the three of them can no longer visually drift
apart the way they had (three separate hand-rolled HTML strings,
each with its own header/footer/border styling, one of them not
even a real PDF -- just window.print()).

This design is the most-iterated one of the three predecessors
(the one that used to live inline in SuccessStep.astro's <script>):
double gold border frame, logo, single-page A4 fit, RTL-correct
body. See generate.ts for the D1 -> ContractResult -> PDF pipeline
that calls this.

Architecture:
- Pure function, no DOM access -- takes a ContractResult (already
  built by scripts/registration/ContractTemplates.ts's buildContract)
  plus the tracking code, returns a full HTML document string.
- Runs server-side inside the Worker, handed to env.BROWSER.quickAction
  ("pdf", ...) -- see generate.ts.
====================================================
*/

import type { ContractResult } from "../../scripts/registration/ContractTemplates";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LOGO_URL = "https://fatehmusic.ir/logo.png";

const FOOTER_ITEMS: Array<[label: string, value: string]> = [
  ["آدرس:", "خیابان امام شرقی، پس از پاساژ مهستان، محوطه دوم پارکینگ حاج سلیمان"],
  ["تلفن:", "۰۶۱-۳۶۲۲۱۱۷۴"],
  ["موبایل / WhatsApp:", "۰۹۳۳-۳۱۳-۹۳۱۹"],
  ["Instagram:", "fateh.music.academy"]
];

const CSS = `
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:210mm;height:297mm;background:#fff}
body{font-family:Vazirmatn,Tahoma,Arial,sans-serif;color:#000;direction:rtl;overflow:hidden}
.page{position:relative;width:210mm;height:297mm;padding:32mm 15mm 26mm;overflow:hidden;background:#fff}
.page:before{content:"";position:absolute;inset:6mm;border:.45mm solid #b9973e;pointer-events:none}
.page:after{content:"";position:absolute;inset:8mm;border:.18mm solid #dfd1a5;pointer-events:none}
.header{position:absolute;top:9mm;left:15mm;right:15mm;height:20mm;display:grid;grid-template-columns:50mm 1fr 50mm;align-items:center;direction:rtl;border-bottom:.35mm solid #b9973e;z-index:2}
.logo-wrap{width:50mm;height:19mm;display:flex;align-items:center;justify-content:flex-start;overflow:hidden}
.logo{display:block!important;width:18mm!important;height:18mm!important;max-width:18mm!important;max-height:18mm!important;min-width:18mm!important;min-height:18mm!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important}
.title{color:#000;text-align:center;font-size:18pt;font-weight:900;white-space:nowrap}
.date-block{text-align:right;direction:rtl}
.date{color:#000;font-size:9pt;font-weight:700;white-space:nowrap}
.tracking{margin-top:1mm;font-size:7.6pt;font-weight:600;color:#000;white-space:nowrap}
.tracking .ltr-code{direction:ltr;unicode-bidi:embed;font-weight:700}
.contract{width:180mm;height:239mm;margin:0 auto;overflow:hidden;color:#000!important;background:#fff}
.contract,.contract *{color:#000!important;-webkit-text-fill-color:#000!important;text-shadow:none!important}
.contract-article{margin:0 0 2.2mm;padding:3.2mm 4mm;border:1px solid #ded6c4;border-radius:2mm;background:#fff;break-inside:avoid;page-break-inside:avoid}
.contract-article:first-child{border:0;padding:0 0 2.5mm;margin-bottom:2mm;text-align:center;background:#fff}
.contract-article h4{display:flex;align-items:center;gap:2.5mm;margin:0 0 1.4mm;font-size:9.2pt;line-height:1.25;font-weight:800}
.contract-article h4:before{content:"";display:inline-block;width:1mm;height:5mm;border-radius:1mm;background:#b9973e;flex:none}
.contract-article p{margin:0;font-size:8.2pt;line-height:1.52;text-align:justify;font-weight:400}
.contract-article:first-child p{font-size:12pt;line-height:1.35;font-weight:800;text-align:center}
.contract-signature{display:grid;grid-template-columns:1fr 1fr;gap:7mm;margin-top:3mm;padding-top:3mm;border-top:.3mm solid #cbbf9f;break-inside:avoid;page-break-inside:avoid}
.contract-signature-col{min-height:24mm;padding:3mm;border:1px solid #ded3b7;border-radius:2mm;display:flex;flex-direction:column;justify-content:flex-end;gap:1.3mm;text-align:center;font-size:8pt;color:#000}
.contract-signature-col:first-child{border-top:1mm solid #b9973e}.contract-signature-col:last-child{border-top:1mm solid #000}
.footer{position:absolute;bottom:9mm;left:15mm;right:15mm;height:15mm;display:grid;grid-template-columns:1.8fr 1fr 1.25fr 1.2fr;align-items:center;direction:rtl;border-top:.35mm solid #b9973e;z-index:2}
.footer-item{min-width:0;height:10mm;padding:0 2.5mm;display:flex;align-items:center;justify-content:center;gap:1.5mm;border-left:.18mm solid #d8c899;color:#000;font-size:6.2pt;line-height:1.45;white-space:nowrap;overflow:hidden}
.footer-item:last-child{border-left:0}.footer-label{font-weight:800;color:#000;white-space:nowrap}.footer-value{font-weight:500;color:#000;white-space:nowrap}
@media print{html,body{width:210mm!important;height:297mm!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;

/** Contract body only: the ماده articles + signature block. Same structure the on-page preview (RegistrationRenderer) renders, minus the header/footer this template supplies itself. */
function renderContractBody(contract: ContractResult): string {
  const articles = contract.blocks
    .map(
      (block) =>
        `<div class="contract-article">${block.heading ? `<h4>${escapeHtml(block.heading)}</h4>` : ""}${block.paragraphs
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join("")}</div>`
    )
    .join("");

  const signature = `<div class="contract-signature"><div class="contract-signature-col"><span>محل امضاء هنرجو (یا ولی و سرپرست)</span><span>نام و نام خانوادگی: ${escapeHtml(
    contract.signature.studentName
  )}</span><span>تاریخ: ${escapeHtml(contract.signature.date)}</span></div><div class="contract-signature-col"><span>محل امضاء آموزشگاه</span></div></div>`;

  return articles + signature;
}

export interface ContractPdfMeta {
  /** Shown (bidi-isolated) under the date in the header, e.g. "FM-2026-123456". Omitted entirely if empty. */
  trackingCode: string;
}

/** Builds the full, single-page A4 contract document. Handed to env.BROWSER.quickAction("pdf", {html}) -- see generate.ts. */
export function buildContractHtml(contract: ContractResult, meta: ContractPdfMeta): string {
  // "FM-2026-123456" is Latin letters/digits/dashes; embedded as-is inside
  // RTL text the Unicode bidi algorithm can visually reverse the hyphenated
  // groups. Isolating it with direction:ltr + unicode-bidi:embed keeps the
  // code's own character order stable (see the mobile/tuition-digit fix
  // this mirrors in ContractTemplates.ts).
  const trackingLine = meta.trackingCode
    ? `<div class="tracking">کد پیگیری: <span class="ltr-code">${escapeHtml(meta.trackingCode)}</span></div>`
    : "";

  const footer = FOOTER_ITEMS.map(
    ([label, value]) => `<div class="footer-item"><span class="footer-label">${escapeHtml(label)}</span><span class="footer-value">${escapeHtml(value)}</span></div>`
  ).join("");

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>قرارداد هنرجویی</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><main class="page"><header class="header"><div class="logo-wrap"><img class="logo" src="${LOGO_URL}" alt="آموزشگاه موسیقی فاتح"></div><div class="title">قرارداد هنرجویی</div><div class="date-block"><div class="date">تاریخ: ${escapeHtml(
    contract.signature.date
  )}</div>${trackingLine}</div></header><section class="contract">${renderContractBody(contract)}</section><footer class="footer">${footer}</footer></main></body></html>`;
}
