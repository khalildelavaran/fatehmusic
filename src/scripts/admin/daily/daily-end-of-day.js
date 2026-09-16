(() => {
  if (location.pathname !== '/admin/daily') return;
  const root = document.querySelector('#dailyDashboardRoot');
  const summary = document.querySelector('#summary');
  if (!root || !summary || document.querySelector('#dailyEndOfDay')) return;

  const todayKey = () => new Date().toLocaleDateString('en-CA');
  const state = { date: root.dataset.date || todayKey(), data: null, busy: false };
  const esc = (v) => { const e = document.createElement('div'); e.textContent = String(v ?? ''); return e.innerHTML; };
  const num = (v) => Number(v ?? 0).toLocaleString('fa-IR');
  const money = (v) => `${num(v)} ریال`;

  summary.insertAdjacentHTML('afterend', `
    <section id="dailyEndOfDay" class="dcc-end-of-day" aria-label="گزارش پایان روز">
      <div class="dcc-section-head">
        <div><strong>گزارش پایان روز</strong><span>کنترل‌های لازم برای بستن عملیات روز انتخاب‌شده</span></div>
        <span id="dccEodStatus" class="dcc-eod-status">در حال بررسی…</span>
      </div>
      <div id="dccEodSummary" class="dcc-eod-grid"></div>
      <div id="dccEodChecklist" class="dcc-eod-checklist"></div>
      <div id="dccEodActions" class="dcc-eod-actions"></div>
    </section>`);

  function render() {
    const d = state.data;
    if (!d) return;
    const s = d.summary || {};
    const statusEl = document.querySelector('#dccEodStatus');
    const summaryEl = document.querySelector('#dccEodSummary');
    const checklistEl = document.querySelector('#dccEodChecklist');
    const actionsEl = document.querySelector('#dccEodActions');
    const statusText = { open: 'باز', ready: 'آماده بستن', needs_attention: 'نیازمند اقدام', closed: 'بسته شده' };
    const statusClass = d.status === 'ready' ? 'ok' : d.status === 'needs_attention' ? 'warning' : d.status === 'closed' ? 'closed' : 'neutral';
    statusEl.className = `dcc-eod-status ${statusClass}`;
    statusEl.textContent = statusText[d.status] || d.status;
    summaryEl.innerHTML = [
      ['جلسات فعال', num(s.active_sessions)],
      ['حضور استاد ثبت‌نشده', num(s.teacher_attendance_pending)],
      ['حضور هنرجوی ثبت‌نشده', num(s.student_attendance_pending)],
      ['معوقه', num(s.overdue_count)],
      ['مانده بدهی', money(s.balance_due)],
    ].map(([label, value]) => `<div class="dcc-eod-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('');
    const checks = d.close_checklist || {};
    const rows = [
      ['teacher_attendance', 'حضور استادان'],
      ['student_attendance', 'حضور هنرجویان'],
      ['finance_overdue', 'بررسی معوقه مالی'],
    ];
    checklistEl.innerHTML = rows.map(([key, label]) => {
      const ok = Boolean(checks[key]);
      return `<div class="dcc-eod-check ${ok ? 'ok' : 'warning'}"><span>${ok ? '✓' : '!'}</span><strong>${esc(label)}</strong><small>${ok ? 'تکمیل شده' : 'نیازمند پیگیری'}</small></div>`;
    }).join('');
    actionsEl.innerHTML = d.status === 'ready'
      ? `<button type="button" class="dcc-eod-close" id="dccEodClose" ${state.busy ? 'disabled' : ''}>${state.busy ? 'در حال بستن…' : 'بستن روز'}</button>`
      : d.status === 'closed'
        ? `<span class="dcc-eod-closed-note">این روز در سیستم بسته شده است.</span>`
        : `<span class="dcc-eod-action-note">پس از تکمیل موارد بالا، امکان بستن روز فعال می‌شود.</span>`;
    document.querySelector('#dccEodClose')?.addEventListener('click', closeDay);
  }

  async function load(date = state.date) {
    state.date = date;
    try {
      const r = await fetch(`/api/admin/daily-end-of-day?date=${encodeURIComponent(state.date)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (!r.ok || !d.success) throw Error(d.message || 'خطا در دریافت گزارش پایان روز');
      state.data = d;
      render();
    } catch (error) {
      const el = document.querySelector('#dccEodStatus');
      if (el) { el.className = 'dcc-eod-status warning'; el.textContent = 'گزارش در دسترس نیست'; }
      console.error('[daily-end-of-day]', error);
    }
  }

  async function closeDay() {
    if (state.busy || state.data?.status !== 'ready') return;
    if (!window.confirm(`آیا روز ${state.date} بسته شود؟ پس از ثبت، این روز به‌عنوان روز بسته‌شده ثبت خواهد شد.`)) return;
    state.busy = true;
    render();
    try {
      const r = await fetch('/api/admin/daily-close', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ date: state.date }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw Error(d.message || 'بستن روز انجام نشد');
      await load(state.date);
    } catch (error) {
      state.busy = false;
      render();
      window.alert(error.message || 'بستن روز انجام نشد');
      console.error('[daily-end-of-day-close]', error);
    }
    state.busy = false;
    render();
  }

  window.addEventListener('daily:date-change', (event) => {
    const date = event.detail?.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) load(String(date));
  });

  const closedFeedbackScript = document.createElement('script');
  closedFeedbackScript.src = '/scripts/admin/daily/daily-closed-feedback.js';
  closedFeedbackScript.async = true;
  document.head.appendChild(closedFeedbackScript);

  const overrideScript = document.createElement('script');
  overrideScript.src = '/scripts/admin/daily/daily-authoritative-overrides.js';
  overrideScript.async = true;
  document.head.appendChild(overrideScript);

  const studentControlsFixScript = document.createElement('script');
  studentControlsFixScript.src = '/scripts/admin/daily/daily-student-controls-fix.js';
  studentControlsFixScript.async = false;
  document.head.appendChild(studentControlsFixScript);

  load(state.date);
})();