// HTML template for the end-of-course certificate ("گواهی پایان دوره").
// Rendered to PDF via Cloudflare Browser Rendering (env.BROWSER PDF quick
// action) -- NOT pdf-lib. Real Chromium handles Persian/Arabic contextual
// letter-shaping and RTL bidi correctly out of the box, which no JS PDF
// library does on its own; fighting that by hand was the wrong path.
// See doc/ADR/ADR-012 — Certificate Issuance System.md.
//
// instrumentPhotoUrl is currently a placeholder (public/images/cert-photos/
// does not exist yet) -- the site owner is providing real photos per
// course; swapping them in later is a data change, not a template change.

export interface CertificateData {
  title: string;                 // e.g. "گواهی پایان دوره"
  disciplineLine: string;        // e.g. "نوازندگی گیتار پاپ دوره مقدماتی"
  certNumber: string;            // registrations.tracking_code
  level: string | null;          // "1" | "2" | "3" | "4" | null (no badge if null)
  honorific: "آقای" | "خانم";
  studentName: string;
  nationalId: string;
  completionDateJalali: string;  // already formatted, e.g. "۱۴۰۵/۰۲/۰۱"
  bookTitle: string | null;
  bookAuthor: string | null;
  curriculumNote: string | null; // free-form extra clause, optional
  bookCoverUrl: string | null;
  instructorLabel: string;       // e.g. "مدرس گیتار"
  instructorName: string;
  instrumentPhotoUrl: string;    // placeholder today, real photo later
  logoUrl: string;
}

const LICENSE_LINE = "با مجوز وزارت فرهنگ و ارشاد اسلامی ایران به شناسه ۱۴۰۱۱۷-۲۳۰۰۳۸۰ در شهرستان شوشتر";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildBodyParagraph(d: CertificateData): string {
  const parts = [
    `گواهی می‌شود ${d.honorific} ${escapeHtml(d.studentName)} به شماره ملی ${escapeHtml(d.nationalId)} در تاریخ ${escapeHtml(d.completionDateJalali)}`,
    `در رشته‌ی ${escapeHtml(d.disciplineLine)}،`
  ];
  if (d.bookTitle) {
    let clause = `کتاب ${escapeHtml(d.bookTitle)}`;
    if (d.bookAuthor) clause += ` نوشته‌ی ${escapeHtml(d.bookAuthor)}`;
    parts.push(clause + (d.curriculumNote ? `، ${escapeHtml(d.curriculumNote)}،` : "،"));
  }
  parts.push(`را در آموزشگاه موسیقی فاتح ${LICENSE_LINE} با موفقیت گذرانده است.`);
  return parts.join(" ");
}

// Abstract flowing ribbon -- original vector art, not a sourced photo, so
// there is no licensing question the way there would be with a stock image.
const WAVE_SVG = `
<svg viewBox="0 0 900 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <path d="M0,60 C220,180 380,-40 620,80 C780,160 850,40 900,90 L900,0 L0,0 Z" fill="#bfe4ee" opacity="0.85"/>
  <path d="M120,180 C340,60 480,260 700,140 C820,80 870,160 900,140 L900,0 L0,0 L0,120 Z" fill="#3f9cc4" opacity="0.55"/>
  <path d="M260,240 C440,120 560,300 780,190 C840,160 880,200 900,190 L900,0 L300,0 Z" fill="#1c6f96" opacity="0.35"/>
</svg>`;

export function buildCertificateHtml(d: CertificateData): string {
  const levelBadge = d.level
    ? `<div class="level-badge"><span class="level-num">${escapeHtml(d.level)}</span><span class="level-label">LEVEL</span></div>`
    : "";
  const bookCover = d.bookCoverUrl
    ? `<img class="book-cover" src="${escapeHtml(d.bookCoverUrl)}" alt="" />`
    : "";

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&family=Lalezar&display=swap" rel="stylesheet">
<style>
  @page { size: 297mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    width: 297mm; height: 210mm; margin: 0; padding: 0; position: relative;
    background: #f5f5f4; font-family: 'Vazirmatn', sans-serif; overflow: hidden;
  }
  /* Single unit system (mm) throughout, explicit width+left/top rather than
     mixing left+right on the same element -- wkhtmltopdf (used only for
     local layout testing) is unreliable with mixed-unit opposing offsets;
     this form is also simply more predictable in any engine. */
  .wave { position: absolute; top: 0mm; left: 110mm; width: 187mm; height: 95mm; z-index: 0; }
  .instrument-photo {
    position: absolute; left: 0mm; top: 0mm; width: 78mm; height: 210mm;
    object-fit: cover; z-index: 1;
  }
  .content { position: relative; z-index: 2; height: 100%; }
  .level-badge {
    position: absolute; top: 10mm; left: 16mm; width: 26mm; height: 26mm;
    border-radius: 50%; background: radial-gradient(circle at 35% 30%, #6fb6d9, #2d6f9e);
    color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,.25); z-index: 3;
  }
  .level-badge .level-num { font-size: 22px; font-weight: 700; line-height: 1; }
  .level-badge .level-label { font-size: 9px; letter-spacing: 1px; }
  .cert-meta {
    position: absolute; left: 14mm; width: 30mm; text-align: center;
    font-size: 11px; color: #2d4fa3; font-weight: 600; top: 14mm;
  }
  .cert-meta.with-badge { top: 39mm; }
  .title { position: absolute; top: 16mm; left: 90mm; width: 195mm; text-align: center;
    font-family: 'Lalezar', 'Vazirmatn', sans-serif; font-size: 42px; color: #24408f; }
  .subtitle { position: absolute; top: 44mm; left: 90mm; width: 195mm; text-align: center;
    font-size: 20px; font-weight: 600; color: #1c1c1c; }
  .student-name { position: absolute; top: 64mm; left: 90mm; width: 195mm; text-align: center;
    font-family: 'Lalezar', 'Vazirmatn', sans-serif; font-size: 50px; color: #24408f; }
  .body-text { position: absolute; top: 110mm; left: 90mm; width: 190mm; text-align: justify;
    font-size: 14px; line-height: 2; color: #1c1c1c; }
  .book-cover { position: absolute; top: 64mm; left: 92mm; width: 26mm; box-shadow: 0 2px 8px rgba(0,0,0,.25); border-radius: 3px; z-index: 3; }
  .footer { position: absolute; bottom: 14mm; left: 90mm; width: 195mm;
    display: flex; justify-content: space-between; align-items: center; }
  .footer .col { text-align: center; width: 55mm; }
  .footer .label { font-size: 13px; color: #444; margin-bottom: 2mm; }
  .footer .name { font-size: 15px; font-weight: 700; color: #1c1c1c; border-top: 1px solid #999; padding-top: 2mm; display: inline-block; min-width: 40mm; }
  .footer .logo { width: 26mm; height: 26mm; }
</style>
</head>
<body>
  <img class="instrument-photo" src="${escapeHtml(d.instrumentPhotoUrl)}" alt="" />
  <div class="wave">${WAVE_SVG}</div>
  <div class="content">
    ${levelBadge}
    <div class="cert-meta ${d.level ? "with-badge" : ""}">شماره گواهی: ${escapeHtml(d.certNumber)}</div>
    <div class="title">${escapeHtml(d.title)}</div>
    <div class="subtitle">${escapeHtml(d.disciplineLine)}</div>
    <div class="student-name">${escapeHtml(d.studentName)}</div>
    ${bookCover}
    <div class="body-text">${buildBodyParagraph(d)}</div>
    <div class="footer">
      <div class="col">
        <div class="label">مدیر آموزشگاه</div>
        <div class="name">رضا فاتح</div>
      </div>
      <img class="logo" src="${escapeHtml(d.logoUrl)}" alt="آموزشگاه موسیقی فاتح" />
      <div class="col">
        <div class="label">${escapeHtml(d.instructorLabel)}</div>
        <div class="name">${escapeHtml(d.instructorName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
