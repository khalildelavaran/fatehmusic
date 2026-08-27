// HTML template for the end-of-course certificate ("گواهی پایان دوره").
// Rendered to PDF via Cloudflare Browser Rendering (Chromium).
// Visual redesign: formal A4 landscape, restrained gold/charcoal identity,
// print-friendly cream paper and a clear hierarchy for certificate data.

export interface CertificateData {
  title: string;
  disciplineLine: string;
  certNumber: string;
  level: string | null;
  honorific: "آقای" | "خانم";
  studentName: string;
  nationalId: string;
  completionDateJalali: string;
  bookTitle: string | null;
  bookAuthor: string | null;
  curriculumNote: string | null;
  bookCoverUrl: string | null;
  instructorLabel: string;
  instructorName: string;
  instrumentPhotoUrl: string;
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

const MUSIC_MARK_SVG = `
<svg viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="none" stroke="#b9973e" stroke-width="2" opacity=".72">
    <path d="M8 74 C90 22 155 105 240 57 S395 35 512 70"/>
    <path d="M8 91 C90 39 155 122 240 74 S395 52 512 87" opacity=".45"/>
  </g>
  <g fill="#b9973e" opacity=".82">
    <circle cx="108" cy="42" r="5"/><circle cx="346" cy="67" r="5"/><circle cx="430" cy="37" r="4"/>
  </g>
</svg>`;

export function buildCertificateHtml(d: CertificateData): string {
  const levelBadge = d.level
    ? `<div class="level-badge"><span class="level-num">${escapeHtml(d.level)}</span><span class="level-label">سطح</span></div>`
    : "";
  const bookCover = d.bookCoverUrl
    ? `<img class="book-cover" src="${escapeHtml(d.bookCoverUrl)}" alt="" />`
    : "";

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=Lalezar&display=swap" rel="stylesheet">
<style>
  @page { size: 297mm 210mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    width: 297mm; height: 210mm; margin: 0; padding: 0;
    background: #f8f5ec; color: #29261f;
    font-family: 'Vazirmatn', sans-serif; overflow: hidden;
  }
  body::before {
    content: ""; position: absolute; inset: 7mm;
    border: .45mm solid #b9973e; pointer-events: none; z-index: 8;
  }
  body::after {
    content: ""; position: absolute; inset: 9mm;
    border: .2mm solid rgba(185,151,62,.48); pointer-events: none; z-index: 8;
  }
  .side-panel {
    position: absolute; top: 0; right: 0; width: 61mm; height: 210mm;
    background: #24221d; overflow: hidden;
  }
  .side-panel::before {
    content: ""; position: absolute; inset: 8mm;
    border: .25mm solid rgba(185,151,62,.52);
  }
  .instrument-photo {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: .26; mix-blend-mode: luminosity;
  }
  .side-glow {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(36,34,29,.35), rgba(36,34,29,.92));
  }
  .side-brand { position: absolute; top: 18mm; left: 8mm; right: 8mm; text-align: center; color: #d7bd69; }
  .side-brand img { width: 25mm; height: 25mm; object-fit: contain; filter: brightness(1.08); }
  .side-brand strong { display: block; margin-top: 5mm; font-size: 15px; }
  .side-brand span { display: block; margin-top: 2mm; color: #e8e2d3; font-size: 9px; line-height: 1.8; }
  .side-ornament { position: absolute; bottom: 18mm; left: 8mm; right: 8mm; height: 35mm; opacity: .9; }

  .content { position: absolute; top: 0; left: 0; width: 236mm; height: 210mm; padding: 17mm 18mm 15mm; }
  .topline { display: flex; align-items: flex-start; justify-content: space-between; direction: ltr; }
  .cert-meta { direction: rtl; text-align: left; color: #75633a; font-size: 9px; line-height: 1.9; }
  .cert-meta strong { color: #9b7924; }
  .eyebrow { direction: rtl; text-align: right; color: #9b7924; font-size: 10px; font-weight: 700; letter-spacing: .04em; }
  .eyebrow::before { content: "✦"; margin-left: 6px; }
  .title { margin-top: 13mm; text-align: center; color: #8a691d; font-family: 'Lalezar','Vazirmatn',sans-serif; font-size: 40px; line-height: 1.2; }
  .gold-rule { width: 72mm; height: .45mm; margin: 4mm auto 0; background: linear-gradient(90deg, transparent, #b9973e, transparent); }
  .subtitle { margin-top: 5mm; text-align: center; color: #484238; font-size: 16px; font-weight: 600; }
  .student-name-wrap { margin: 9mm auto 0; width: 165mm; text-align: center; }
  .student-name-label { color: #8d8064; font-size: 10px; }
  .student-name { margin-top: 1mm; color: #24211c; font-family: 'Lalezar','Vazirmatn',sans-serif; font-size: 38px; line-height: 1.35; }
  .name-rule { width: 105mm; margin: 2mm auto 0; border-bottom: .3mm solid #b9973e; }

  .detail-strip {
    width: 180mm; margin: 9mm auto 0; display: grid; grid-template-columns: repeat(3, 1fr);
    border-top: .2mm solid #d8ccb0; border-bottom: .2mm solid #d8ccb0;
  }
  .detail { padding: 4mm 3mm; text-align: center; border-left: .2mm solid #e0d7c3; }
  .detail:last-child { border-left: 0; }
  .detail-label { color: #8e8064; font-size: 8.5px; }
  .detail-value { margin-top: 1.5mm; color: #302c24; font-size: 11px; font-weight: 700; }

  .body-text {
    width: 180mm; margin: 9mm auto 0; padding: 5mm 9mm;
    border-right: .8mm solid #b9973e; background: rgba(255,255,255,.48);
    text-align: justify; font-size: 11px; line-height: 2.05; color: #403b32;
  }
  .book-cover { position: absolute; width: 20mm; max-height: 28mm; object-fit: cover; bottom: 20mm; left: 24mm; box-shadow: 0 1mm 4mm rgba(0,0,0,.18); }

  .footer { position: absolute; bottom: 13mm; right: 18mm; left: 18mm; display: grid; grid-template-columns: 1fr 1fr; gap: 24mm; }
  .footer-col { text-align: center; padding-top: 7mm; border-top: .25mm solid #9f916f; }
  .footer-label { color: #7e725c; font-size: 9px; }
  .footer-name { margin-top: 2mm; color: #2e2a22; font-size: 12px; font-weight: 700; }

  .level-badge {
    position: absolute; top: 13mm; right: 80mm; width: 18mm; height: 18mm;
    border: .6mm solid #b9973e; border-radius: 50%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; background: #fbf8ef; color: #8a691d;
  }
  .level-num { font-size: 16px; font-weight: 800; line-height: 1; }
  .level-label { margin-top: 1mm; font-size: 7px; }

  @media print {
    html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <aside class="side-panel">
    <img class="instrument-photo" src="${escapeHtml(d.instrumentPhotoUrl)}" alt="" />
    <div class="side-glow"></div>
    <div class="side-brand">
      <img src="${escapeHtml(d.logoUrl)}" alt="آموزشگاه موسیقی فاتح" />
      <strong>آموزشگاه موسیقی فاتح</strong>
      <span>شوشتر</span>
    </div>
    <div class="side-ornament">${MUSIC_MARK_SVG}</div>
  </aside>

  <main class="content">
    <div class="topline">
      <div class="eyebrow">گواهی رسمی پایان دوره</div>
      <div class="cert-meta">
        <strong>شماره گواهی:</strong> ${escapeHtml(d.certNumber)}<br />
        <strong>تاریخ صدور:</strong> ${escapeHtml(d.completionDateJalali)}
      </div>
    </div>

    ${levelBadge}
    <div class="title">${escapeHtml(d.title)}</div>
    <div class="gold-rule"></div>
    <div class="subtitle">${escapeHtml(d.disciplineLine)}</div>

    <div class="student-name-wrap">
      <div class="student-name-label">این گواهی به نام</div>
      <div class="student-name">${escapeHtml(d.studentName)}</div>
      <div class="name-rule"></div>
    </div>

    <div class="detail-strip">
      <div class="detail"><div class="detail-label">شماره ملی</div><div class="detail-value">${escapeHtml(d.nationalId)}</div></div>
      <div class="detail"><div class="detail-label">مدرس</div><div class="detail-value">${escapeHtml(d.instructorName)}</div></div>
      <div class="detail"><div class="detail-label">تاریخ پایان دوره</div><div class="detail-value">${escapeHtml(d.completionDateJalali)}</div></div>
    </div>

    <div class="body-text">${buildBodyParagraph(d)}</div>
    ${bookCover}

    <footer class="footer">
      <div class="footer-col">
        <div class="footer-label">مدیریت آموزشگاه</div>
        <div class="footer-name">رضا فاتح</div>
      </div>
      <div class="footer-col">
        <div class="footer-label">${escapeHtml(d.instructorLabel)}</div>
        <div class="footer-name">${escapeHtml(d.instructorName)}</div>
      </div>
    </footer>
  </main>
</body>
</html>`;
}
