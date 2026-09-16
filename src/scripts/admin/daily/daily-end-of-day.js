(() => {
  if (location.pathname !== '/admin/daily') return;
  const root = document.querySelector('#dailyDashboardRoot');
  const summary = document.querySelector('#summary');
  if (!root || !summary || document.querySelector('#dailyEndOfDay')) return;

  const state = { date: new Date().toLocaleDateString('en-CA'), data: null };
  const esc = (v) => { const e = document.createElement('div'); e.textContent = String(v ?? ''); return e.innerHTML; };
  const num = (v) => Number(v ?? 0).toLocaleString('fa-IR');
  const money = (v) => `${num(v)} تومان`;

  summary.insertAdjacentHTML('afterend', `
    <section id="dailyEndOfDay" class="dcc-end-of-day" aria-label="گزارش پایان روز">
      <div class="dcc-section-head">
        <div><strong>گزارش پایان روز</strong><span>کنترل‌های لازم برای بستن عملیات روز انتخاب‌شده</span></div>
        <span id="dccEodStatus" class="dcc-eod-status">در حال بررسی…</span>
      </div>
      <div id="dccEodSummary" class="dcc-eod-grid"></div>
      <div id="dccEodChecklist" class="dcc-eod-checklist"></div>
    </section>`);

  function render() {
    const d = state.data;
    if (!d) return;
    const s = d.summary || {};
    const statusEl = document.querySelector('#dccEodStatus');
    const summaryEl = document.querySelector('#dccEodSummary');
    const checklistEl = document.querySelector('#dccEodChecklist');
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
  }

  async function load() {
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

  ['prev', 'next', 'today', 'refresh'].forEach((id) => {
    document.querySelector(`#${id}`)?.addEventListener('click', () => {
      setTimeout(() => {
        const parsed = root.dataset.date || new Date().toLocaleDateString('en-CA');
        state.date = /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : state.date;
        load();
      }, 450);
    });
  });

  const overrideScript = document.createElement('script');
  overrideScript.src = '/scripts/admin/daily/daily-authoritative-overrides.js';
  overrideScript.async = true;
  document.head.appendChild(overrideScript);

  load();
})();
