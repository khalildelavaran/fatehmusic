(() => {
  if (location.pathname !== '/admin/daily') return;
  const root = document.querySelector('#dailyDashboardRoot');
  const summary = document.querySelector('#summary');
  if (!root || !summary) return;

  const state = { date: new Date().toLocaleDateString('en-CA'), dashboard: null, metrics: null, search: '', searchResults: [], loading: false };
  const esc = (v) => { const e = document.createElement('div'); e.textContent = String(v ?? ''); return e.innerHTML; };
  const num = (v) => Number(v ?? 0).toLocaleString('fa-IR');
  const money = (v) => `${num(v)} تومان`;
  const mins = (v) => { const [h,m] = String(v || '00:00').split(':').map(Number); return h * 60 + m; };

  function conflicts(sessions) {
    const active = sessions.filter(s => s.status !== 'cancelled');
    let instructor = 0, room = 0;
    for (const s of active) {
      if (active.some(o => o.id !== s.id && String(o.instructor_id) === String(s.instructor_id) && mins(o.startTime) < mins(s.endTime) && mins(o.endTime) > mins(s.startTime))) instructor++;
      if (s.room_id != null && active.some(o => o.id !== s.id && String(o.room_id) === String(s.room_id) && mins(o.startTime) < mins(s.endTime) && mins(o.endTime) > mins(s.startTime))) room++;
    }
    return { instructor: Math.ceil(instructor / 2), room: Math.ceil(room / 2) };
  }

  async function getDashboard(date) {
    const r = await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(date)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (!r.ok || !d.success) throw Error(d.message || 'خطا در دریافت جلسات');
    return d;
  }
  async function getCommand(date) {
    const r = await fetch(`/api/admin/daily-command-center?date=${encodeURIComponent(date)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (!r.ok || !d.success) throw Error(d.message || 'خطا در دریافت شاخص‌های عملیاتی');
    return d;
  }

  function ensureUi() {
    if (!document.querySelector('#dailyActionCenter')) {
      summary.insertAdjacentHTML('afterend', `
        <section id="dailyActionCenter" class="dcc-action-center" aria-label="نیازمند اقدام"></section>
        <section id="dailySearch" class="dcc-search" aria-label="جستجوی سریع">
          <div class="dcc-search-head"><div><strong>جستجوی سریع</strong><span>هنرجو، استاد یا کلاس را جستجو کنید.</span></div></div>
          <div class="dcc-search-row"><input id="dccSearchInput" type="search" autocomplete="off" placeholder="مثلاً: علی احمدی، استاد محمدی، گیتار" aria-label="جستجوی هنرجو، استاد یا کلاس" /><button id="dccSearchButton" type="button">جستجو</button></div>
          <div id="dccSearchResults" class="dcc-search-results" aria-live="polite"></div>
        </section>
        <section id="dailyInstructorStatus" class="dcc-instructors" aria-label="وضعیت استادان امروز"></section>
      `);
    }
  }

  function renderSummary() {
    const sessions = (state.dashboard?.sessions || []).filter(s => s.status !== 'cancelled');
    const students = new Map();
    sessions.forEach(s => (s.students || []).forEach(st => students.set(String(st.studentId || st.enrollmentId), st)));
    const present = [...students.values()].filter(s => s.attendanceStatus === 'present').length;
    const pending = [...students.values()].filter(s => s.attendanceStatus === 'pending').length;
    const c = conflicts(sessions);
    const m = state.metrics || {};
    const cards = [
      ['جلسه امروز', num(sessions.length), ''],
      ['هنرجوی یکتا', num(students.size), pending ? `${num(pending)} حضور ثبت نشده` : 'حضورها ثبت شده'],
      ['حضور', `${num(present)} / ${num(students.size)}`, ''],
      ['پرداخت امروز', money(m.paymentsToday), `${num(m.paymentCountToday)} تراکنش`],
      ['معوقات', num(m.overdue_terms), m.overdue_terms ? 'نیازمند پیگیری' : 'موردی نیست'],
      ['تمدید', num(m.renewalCandidates), m.renewalCandidates ? 'نزدیک به پایان / ماهانه' : 'موردی نیست'],
    ];
    summary.innerHTML = cards.map(([title,value,note]) => `<div class="dd-stat dcc-kpi"><strong>${value}</strong><span>${title}</span>${note ? `<small>${esc(note)}</small>` : ''}</div>`).join('');
    summary.dataset.instructorConflicts = c.instructor;
    summary.dataset.roomConflicts = c.room;
  }

  function renderActions() {
    const el = document.querySelector('#dailyActionCenter');
    if (!el) return;
    const sessions = (state.dashboard?.sessions || []).filter(s => s.status !== 'cancelled');
    const students = sessions.flatMap(s => s.students || []);
    const pendingAttendance = students.filter(s => s.attendanceStatus === 'pending').length;
    const noRoom = sessions.filter(s => s.room_id == null).length;
    const teacherPending = sessions.filter(s => (s.teacherAttendanceStatus || 'pending') === 'pending').length;
    const c = conflicts(sessions);
    const m = state.metrics || {};
    const items = [
      [pendingAttendance, 'حضور هنرجویان ثبت نشده', 'attention'],
      [teacherPending, 'حضور استادان ثبت نشده', 'attention'],
      [noRoom, 'جلسه بدون اتاق', 'warning'],
      [c.instructor, 'تداخل زمانی مدرس', 'danger'],
      [c.room, 'تداخل زمانی اتاق', 'danger'],
      [Number(m.overdue_terms || 0), 'ترم دارای معوقه', 'warning'],
      [Number(m.renewalCandidates || 0), 'هنرجو/ترم نیازمند تمدید', 'attention'],
    ].filter(x => x[0] > 0);
    el.innerHTML = `<div class="dcc-section-head"><div><strong>نیازمند اقدام</strong><span>${items.length ? 'مواردی که بهتر است منشی امروز پیگیری کند' : 'برای امروز مورد فوری ثبت نشده است.'}</span></div><b>${num(items.reduce((a,x)=>a+Number(x[0]),0))}</b></div>` +
      (items.length ? `<div class="dcc-action-grid">${items.map(([count,label,type]) => `<button type="button" class="dcc-action ${type}" data-dcc-focus="${esc(label)}"><strong>${num(count)}</strong><span>${esc(label)}</span></button>`).join('')}</div>` : `<div class="dcc-all-clear">✓ وضعیت عملیاتی امروز مرتب است.</div>`);
  }

  function renderInstructors() {
    const el = document.querySelector('#dailyInstructorStatus');
    if (!el) return;
    const rows = state.command?.instructors || [];
    el.innerHTML = `<div class="dcc-section-head"><div><strong>وضعیت استادان</strong><span>تعداد جلسات و وضعیت حضور هر استاد در روز انتخاب‌شده</span></div></div>` +
      (rows.length ? `<div class="dcc-instructor-grid">${rows.map(r => { const pending = Number(r.teacher_pending || 0); const absent = Number(r.teacher_absent || 0); const cls = absent ? 'danger' : pending ? 'warning' : 'ok'; return `<article class="dcc-instructor ${cls}"><strong>${esc(r.instructor_name || 'استاد بدون نام')}</strong><span>${num(r.session_count)} جلسه · ${esc(r.first_session || '—')} تا ${esc(r.last_session || '—')}</span><small>${absent ? `غایب: ${num(absent)}` : pending ? `حضور ثبت‌نشده: ${num(pending)}` : '✓ حضور جلسات ثبت شده'}</small></article>`; }).join('')}</div>` : `<div class="dcc-all-clear">استادی برای این روز جلسه ندارد.</div>`);
  }

  async function search() {
    const input = document.querySelector('#dccSearchInput');
    const out = document.querySelector('#dccSearchResults');
    const q = input?.value.trim() || '';
    if (!q) { out.innerHTML = ''; return; }
    out.innerHTML = '<div class="dcc-search-loading">در حال جستجو…</div>';
    try {
      const r = await fetch(`/api/admin/daily-command-center?date=${encodeURIComponent(state.date)}&q=${encodeURIComponent(q)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (!r.ok || !d.success) throw Error(d.message || 'جستجو ناموفق بود.');
      out.innerHTML = (d.results || []).map(x => `<button type="button" class="dcc-result"><strong>${esc(x.name)}</strong><span>${x.result_type === 'student' ? `هنرجو · ${esc(x.class_title || '')}` : x.result_type === 'instructor' ? 'استاد' : `کلاس · ${esc(x.class_title || '')}`}</span>${x.session_date ? `<small>${esc(x.session_date)} · ${esc(x.start_time || '')}–${esc(x.end_time || '')}</small>` : ''}</button>`).join('') || '<div class="dcc-search-empty">نتیجه‌ای پیدا نشد.</div>';
    } catch (e) { out.innerHTML = `<div class="dcc-search-empty">${esc(e.message || e)}</div>`; }
  }

  async function load() {
    ensureUi();
    try {
      state.loading = true;
      const [dashboard, command] = await Promise.all([getDashboard(state.date), getCommand(state.date)]);
      state.dashboard = dashboard;
      state.command = command;
      state.metrics = command.metrics || {};
      renderSummary(); renderActions(); renderInstructors();
    } catch (e) {
      console.error('[daily-command-center]', e);
    } finally { state.loading = false; }
  }

  ensureUi();
  document.querySelector('#dccSearchButton')?.addEventListener('click', search);
  document.querySelector('#dccSearchInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
  ['prev','next','today','refresh'].forEach(id => document.querySelector(`#${id}`)?.addEventListener('click', () => setTimeout(() => { state.date = document.querySelector('#dailyDashboardRoot')?.dataset?.date || new Date().toLocaleDateString('en-CA'); load(); }, 600)));
  load();
})();
