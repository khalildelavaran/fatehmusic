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
body{font-family:Vazirmatn,Tahoma,Arial,sans-serif;color:#151515;direction:rtl;overflow:hidden}
.page{position:relative;width:210mm;height:297mm;padding:31mm 16mm 27mm;overflow:hidden;background:#fff}

/* Elegant double frame: restrained enough for economical printing. */
.page:before{content:"";position:absolute;inset:5.5mm;border:.45mm solid #b9973e;pointer-events:none}
.page:after{content:"";position:absolute;inset:7.6mm;border:.15mm solid #e7dcc0;pointer-events:none}

/* Very subtle musical watermark, kept almost invisible so it never competes with text. */
.page .watermark{position:absolute;left:10mm;top:113mm;width:34mm;height:34mm;border:.35mm solid #eee8d9;border-radius:50%;opacity:.55;z-index:0}
.page .watermark:before{content:"♫";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:31pt;color:#eee8d9;transform:rotate(-10deg)}

.header{position:absolute;top:8.5mm;left:15.5mm;right:15.5mm;height:21mm;display:grid;grid-template-columns:50mm 1fr 50mm;grid-template-areas:"logo title meta";align-items:center;border-bottom:.35mm solid #b9973e;z-index:2;direction:ltr}
.logo-wrap{grid-area:logo;width:50mm;height:19mm;display:flex;align-items:center;justify-content:flex-start;overflow:hidden;direction:ltr}
.logo{display:block!important;width:18mm!important;height:18mm!important;max-width:18mm!important;max-height:18mm!important;min-width:18mm!important;min-height:18mm!important;object-fit:contain!important;object-position:center!important;margin:0!important;padding:0!important}
.title-wrap{grid-area:title;text-align:center;direction:rtl}
.title{color:#111;text-align:center;font-size:18pt;font-weight:900;line-height:1.15;white-space:nowrap;letter-spacing:-.1pt}
.subtitle{margin-top:1.2mm;color:#8b6f27;font-size:7.3pt;font-weight:700;letter-spacing:.15pt;white-space:nowrap}
.meta{grid-area:meta;text-align:right;direction:rtl}
.date{color:#222;font-size:8.6pt;font-weight:800;white-space:nowrap}
.tracking{margin-top:1.1mm;font-size:7.2pt;font-weight:600;color:#555;white-space:nowrap}
.tracking .ltr-code{direction:ltr;unicode-bidi:embed;font-weight:800;color:#8b6f27}

.contract{position:relative;z-index:1;width:178mm;height:240mm;margin:0 auto;overflow:hidden;color:#171717!important;background:#fff}
.contract,.contract *{color:#171717!important;-webkit-text-fill-color:#171717!important;text-shadow:none!important}
.contract-article{position:relative;margin:0 0 1.9mm;padding:2.7mm 4mm 2.6mm;border:1px solid #e4dece;border-radius:1.8mm;background:#fff;break-inside:avoid;page-break-inside:avoid}
.contract-article:first-child{border:0;border-bottom:.45mm solid #b9973e;border-radius:0;padding:0 1mm 2.7mm;margin-bottom:2.6mm;text-align:center;background:transparent}
.contract-article h4{display:flex;align-items:center;gap:2.3mm;margin:0 0 1.25mm;font-size:9pt;line-height:1.25;font-weight:900}
.contract-article h4:before{content:"";display:inline-block;width:1.05mm;height:5mm;border-radius:1mm;background:#b9973e;flex:none}
.contract-article p{margin:0;font-size:8.05pt;line-height:1.5;text-align:justify;font-weight:400}
.contract-article:first-child p{font-size:11.5pt;line-height:1.35;font-weight:900;text-align:center}

.contract-signature{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:2.8mm;padding-top:2.8mm;border-top:.3mm solid #cbbf9f;break-inside:avoid;page-break-inside:avoid}
.contract-signature-col{min-height:24mm;padding:2.8mm 3mm;border:1px solid #ded6c4;border-radius:1.8mm;display:flex;flex-direction:column;justify-content:flex-end;gap:1.2mm;text-align:center;font-size:7.8pt;color:#171717}
.contract-signature-col:first-child{border-top:1mm solid #b9973e}
.contract-signature-col:last-child{border-top:1mm solid #333}

.footer{position:absolute;bottom:8.5mm;left:15.5mm;right:15.5mm;height:15.5mm;display:grid;grid-template-columns:1.8fr 1fr 1.25fr 1.2fr;align-items:center;direction:rtl;border-top:.35mm solid #b9973e;z-index:2}
.footer-item{min-width:0;height:10.5mm;padding:0 2.3mm;display:flex;align-items:center;justify-content:center;gap:1.4mm;border-left:.18mm solid #ddd1ae;color:#222;font-size:6pt;line-height:1.4;white-space:nowrap;overflow:hidden}
.footer-item:last-child{border-left:0}
.footer-label{font-weight:900;color:#222;white-space:nowrap}
.footer-value{font-weight:500;color:#444;white-space:nowrap}

@media print{html,body{width:210mm!important;height:297mm!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
`;

/** Contract body only: the ماده articles + signature block. */
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

/** Builds the full, single-page A4 contract document. */
export function buildContractHtml(contract: ContractResult, meta: ContractPdfMeta): string {
  const trackingLine = meta.trackingCode
    ? `<div class="tracking">کد پیگیری: <span class="ltr-code">${escapeHtml(meta.trackingCode)}</span></div>`
    : "";

  const footer = FOOTER_ITEMS.map(
    ([label, value]) => `<div class="footer-item"><span class="footer-label">${escapeHtml(label)}</span><span class="footer-value">${escapeHtml(value)}</span></div>`
  ).join("");

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>قرارداد هنرجویی</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head><body><main class="page"><div class="watermark" aria-hidden="true"></div><header class="header"><div class="logo-wrap"><img class="logo" src="${LOGO_URL}" alt="آموزشگاه موسیقی فاتح"></div><div class="title-wrap"><div class="title">قرارداد هنرجویی</div><div class="subtitle">آموزشگاه موسیقی فاتح</div></div><div class="meta"><div class="date">تاریخ: ${escapeHtml(contract.signature.date)}</div>${trackingLine}</div></header><section class="contract">${renderContractBody(contract)}</section><footer class="footer">${footer}</footer></main></body></html>`;
}
