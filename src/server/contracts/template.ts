/*
====================================================
File: src/server/contracts/template.ts

Purpose:
The ONE HTML/CSS template for "قرارداد هنرجویی" PDFs.
All contract PDF surfaces use this template so the visual output
stays identical across registration, admin, and student portal.
====================================================
*/

import type { ContractResult } from "../../scripts/registration/ContractTemplates";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Dedicated logo for the contract form, stored in /public.
const LOGO_URL = "https://fatehmusic.ir/logo-form.png";

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
body{font-family:Vazirmatn,Tahoma,Arial,sans-serif;color:#202020;direction:rtl;overflow:hidden}
.page{position:relative;width:210mm;height:297mm;padding:35mm 16.5mm 28mm;overflow:hidden;background:#fff}
.page:before{content:"";position:absolute;inset:5.2mm;border:.42mm solid #b9973e;pointer-events:none;z-index:10}
.page:after{content:"";position:absolute;inset:7.3mm;border:.14mm solid #e4d9ba;pointer-events:none;z-index:10}
.watermark{position:absolute;right:10mm;top:117mm;width:31mm;height:31mm;border:.25mm solid #eee9dd;border-radius:50%;opacity:.48;z-index:0}
.watermark:before{content:"♫";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:28pt;color:#eee9dd;transform:rotate(-9deg)}
.watermark:after{content:"";position:absolute;inset:3mm;border:.12mm solid #f1ede5;border-radius:50%}
.header{position:absolute;top:8.2mm;left:15.8mm;right:15.8mm;height:24mm;display:grid;grid-template-columns:48mm 1fr 48mm;grid-template-areas:"logo title meta";align-items:center;border-bottom:.45mm solid #b9973e;z-index:3;direction:ltr}
.header:after{content:"";position:absolute;bottom:-.95mm;left:50%;transform:translateX(-50%);width:12mm;height:.9mm;background:#b9973e;border-radius:1mm}
.logo-wrap{grid-area:logo;width:48mm;height:20mm;display:flex;align-items:center;justify-content:flex-start;overflow:hidden;direction:ltr}
.logo{display:block!important;width:18.5mm!important;height:18.5mm!important;max-width:18.5mm!important;max-height:18.5mm!important;min-width:18.5mm!important;min-height:18.5mm!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important}
.title-wrap{grid-area:title;text-align:center;direction:rtl}.title{color:#171717;text-align:center;font-size:18pt;font-weight:900;line-height:1.1;white-space:nowrap;letter-spacing:-.15pt}.subtitle{margin-top:1.6mm;color:#876b25;font-size:7.1pt;font-weight:800;white-space:nowrap}.document-label{margin-top:1mm;color:#777;font-size:6.2pt;font-weight:500;white-space:nowrap}
.meta{grid-area:meta;text-align:right;direction:rtl;padding-right:1mm}.meta-row{display:flex;align-items:center;justify-content:flex-start;gap:1.5mm;margin-bottom:1.1mm;white-space:nowrap}.meta-label{font-size:6.8pt;color:#777;font-weight:600}.date{font-size:8.2pt;color:#222;font-weight:850;white-space:nowrap}.tracking{font-size:7pt;font-weight:600;color:#666;white-space:nowrap}.tracking .ltr-code{direction:ltr;unicode-bidi:embed;font-weight:900;color:#876b25;letter-spacing:.2pt}
.contract{position:relative;z-index:1;width:177mm;height:234mm;margin:0 auto;overflow:hidden;color:#202020!important;background:#fff}.contract,.contract *{color:#202020!important;-webkit-text-fill-color:#202020!important;text-shadow:none!important}
.contract-article{position:relative;margin:0 0 1.55mm;padding:2.45mm 4mm 2.25mm;border:1px solid #e5dfd1;border-radius:1.7mm;background:rgba(255,255,255,.97);break-inside:avoid;page-break-inside:avoid}.contract-article:before{content:"";position:absolute;top:0;right:0;width:1mm;height:100%;background:#d4bd7d;border-radius:0 1.7mm 1.7mm 0;opacity:.72}.contract-article:first-child{border:0;border-bottom:.42mm solid #b9973e;border-radius:0;padding:0 1mm 2.2mm;margin-bottom:2.4mm;text-align:center;background:transparent}.contract-article:first-child:before{display:none}.contract-article:first-child p{font-size:11.5pt;line-height:1.28;font-weight:900;text-align:center}.contract-article:nth-child(2){border:0;background:#faf8f2;padding:2.3mm 4mm;margin-bottom:1.8mm;text-align:center}.contract-article:nth-child(2):before{display:none}.contract-article:nth-child(2) p{font-size:7.45pt;line-height:1.48;color:#5d5d5d!important;text-align:center}.contract-article h4{display:flex;align-items:center;gap:2.4mm;margin:0 0 1.15mm;font-size:8.8pt;line-height:1.2;font-weight:900}.contract-article h4:before{content:"";display:inline-block;width:1.05mm;height:4.9mm;border-radius:1mm;background:#b9973e;flex:none}.contract-article p{margin:0;font-size:7.72pt;line-height:1.48;text-align:justify;font-weight:450}.contract-article p+p{margin-top:1mm}.contract-article:nth-child(3){background:#fdfcf9;border-color:#ddd4bd;padding-top:2.7mm;padding-bottom:2.5mm}.contract-article:nth-child(3) h4{margin-bottom:1.6mm}.contract-article:nth-child(3) p{font-size:7.55pt;line-height:1.46}.contract-article:nth-child(3) p+p{margin-top:1.7mm;padding-top:1.55mm;border-top:.18mm solid #e5dfd1}.contract-article:nth-child(n+4) h4{color:#282828!important}
.contract-signature{display:grid;grid-template-columns:1fr 1fr;gap:5.5mm;margin-top:2.4mm;padding-top:2.4mm;border-top:.3mm solid #cfc3a3;break-inside:avoid;page-break-inside:avoid}.contract-signature-col{position:relative;min-height:23.5mm;padding:2.7mm 3mm 2.5mm;border:1px solid #ddd6c7;border-radius:1.7mm;display:flex;flex-direction:column;justify-content:flex-end;gap:1.15mm;text-align:center;font-size:7.45pt;color:#333}.contract-signature-col:before{position:absolute;top:-.25mm;right:0;left:0;height:.9mm;content:"";border-radius:1mm 1mm 0 0}.contract-signature-col:first-child:before{background:#b9973e}.contract-signature-col:last-child:before{background:#444}.contract-signature-col span:first-child{font-weight:900;margin-bottom:.5mm}.contract-signature-col span:not(:first-child){font-size:7pt;color:#666!important}
.footer{position:absolute;bottom:8.2mm;left:15.8mm;right:15.8mm;height:16.2mm;display:grid;grid-template-columns:1.85fr 1fr 1.25fr 1.2fr;align-items:center;direction:rtl;border-top:.4mm solid #b9973e;z-index:3}.footer:before{content:"آموزشگاه موسیقی فاتح";position:absolute;top:-3.1mm;right:50%;transform:translateX(50%);padding:0 2.5mm;background:#fff;color:#96772d;font-size:5.4pt;font-weight:800;white-space:nowrap}.footer-item{min-width:0;height:10.8mm;padding:0 2.2mm;display:flex;align-items:center;justify-content:center;gap:1.3mm;border-left:.16mm solid #ddd4bd;color:#333;font-size:5.75pt;line-height:1.35;white-space:nowrap;overflow:hidden}.footer-item:first-child{justify-content:flex-start;padding-right:1mm;padding-left:3mm}.footer-item:nth-child(2){position:relative;right:1.8mm}.footer-item:last-child{border-left:0;justify-content:flex-start;direction:ltr;gap:1.3mm;padding-left:1mm;padding-right:2.5mm}.footer-label{font-weight:900;color:#333;white-space:nowrap}.footer-value{font-weight:500;color:#666;white-space:nowrap}
@media print{html,body{width:210mm!important;height:297mm!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;

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
  /** Shown under the date in the header, e.g. FM-2026-123456. */
  trackingCode: string;
}

export function buildContractHtml(contract: ContractResult, meta: ContractPdfMeta): string {
  const trackingLine = meta.trackingCode
    ? `<div class="tracking">کد پیگیری: <span class="ltr-code">${escapeHtml(meta.trackingCode)}</span></div>`
    : "";

  const footer = FOOTER_ITEMS.map(
    ([label, value]) => `<div class="footer-item"><span class="footer-label">${escapeHtml(label)}</span><span class="footer-value">${escapeHtml(value)}</span></div>`
  ).join("");

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>قرارداد هنرجویی</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><main class="page"><div class="watermark" aria-hidden="true"></div><header class="header"><div class="logo-wrap"><img class="logo" src="${LOGO_URL}" alt="آموزشگاه موسیقی فاتح"></div><div class="title-wrap"><div class="title">قرارداد هنرجویی</div><div class="subtitle">آموزشگاه موسیقی فاتح</div><div class="document-label">سند ثبت‌نام و تعهدات آموزشی</div></div><div class="meta"><div class="meta-row"><span class="meta-label">تاریخ:</span><span class="date">${escapeHtml(contract.signature.date)}</span></div>${trackingLine}</div></header><section class="contract">${renderContractBody(contract)}</section><footer class="footer">${footer}</footer></main></body></html>`;
}
