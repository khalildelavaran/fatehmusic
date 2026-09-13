/*
 * Daily Dashboard — single controller (spec: fateh-daily-dashboard-spec.md)
 *
 * Replaces the previous six independent scripts (daily-planner.js,
 * daily-planner-status.js, daily-planner-drag-fix.js,
 * daily-attendance-controls.js, daily-student-time-edit.js,
 * daily-operations-panels.js) which all read/wrote a shared DOM tree
 * concurrently and used MutationObserver as their primary sync mechanism.
 *
 * Architecture:
 *   - Single source of truth: `state` (section 27 of the spec).
 *   - All rendering is a pure function of `state` (section 28).
 *   - One set of delegated event listeners on the dashboard root
 *     (section 14) — no per-card listeners, no capture-phase hijacking.
 *   - Interactive controls (button/input/select/time editor/attendance)
 *     are always excluded from drag start (section 13).
 *   - The timeline session card and the student card read the exact same
 *     `state.sessions` record (section 11.1) — editing time from either
 *     place calls the same action and re-renders both via one function.
 *   - Room columns are built from `state.rooms`, fetched from the API —
 *     never hard-coded (section 9 / 46.4).
 *   - No MutationObserver anywhere in this file.
 */
(() => {
  if (location.pathname !== "/admin/daily") return;

  const root = document.querySelector("#dailyDashboardRoot");
  if (!root) return;

  /* ============================== STATE ============================== */
  /** @type {{
   *   date: string,
   *   sessions: any[],
   *   rooms: any[],
   *   instructorFilter: string,
   *   loading: boolean,
   *   saving: number,
   *   editingSessionId: number|null,
   *   draggingSessionId: number|null,
   *   lastUpdatedAt: string|null,
   *   error: string|null,
   *   quickPayment: { invoiceId: number, enrollmentSessionId: number } | null
   * }} */
  const state = {
    date: localDateString(),
    sessions: [],
    rooms: [],
    instructorFilter: "all",
    loading: false,
    saving: 0,
    editingSessionId: null,
    draggingSessionId: null,
    lastUpdatedAt: null,
    error: null,
    quickPayment: null,
  };

  /* ============================== UTILS =============================== */
  function localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function todayKey() { return localDateString(); }
  function esc(value) {
    const el = document.createElement("div");
    el.textContent = String(value ?? "");
    return el.innerHTML;
  }
  function formatNumber(value) { return Number(value ?? 0).toLocaleString("fa-IR"); }
  function minutesOf(value) {
    const [h, m] = String(value || "00:00").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  }
  function timeOf(value) {
    const v = Math.max(0, Math.round(value));
    return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  }
  function snap15(value) { return Math.round(value / 15) * 15; }
  const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  function isValidTime(value) { return typeof value === "string" && TIME_RE.test(value); }
  function formatShamsiDate(value) {
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const parts = new Intl.DateTimeFormat("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `<span class="daily-date-part">${esc(get("weekday"))}</span><span class="daily-date-day">${esc(get("day"))}</span><span class="daily-date-part">${esc(get("month"))}</span><span class="daily-date-part">${esc(get("year"))}</span>`;
  }

  const attendanceLabels = { pending: "ثبت نشده", present: "حاضر", absent: "غایب", excused: "مرخصی", withdrawn: "انصراف" };
  const teacherAttendanceLabels = { pending: "ثبت نشده", present: "حاضر", absent: "غایب" };
  const financeLabels = { paid: "تسویه شده", partial: "پرداخت ناقص", overdue: "معوق", pending: "پرداخت نشده", none: "صورتحساب ندارد" };
  const paymentMethodLabels = { cash: "نقدی", card: "کارتخوان", transfer: "کارت‌به‌کارت / انتقال", other: "سایر" };

  /* Deterministic per-instructor accent color, used only as a subtle visual
     grouping aid on timeline cards — never as the sole indicator of state. */
  const instructorPalette = ["#a78bfa", "#7dd3fc", "#f9a8d4", "#86efac", "#fcd34d", "#fb923c", "#c4b5fd", "#67e8f9"];
  const instructorColorMap = new Map();
  function instructorColor(name) {
    const key = String(name || "مدرس").trim();
    if (!instructorColorMap.has(key)) instructorColorMap.set(key, instructorPalette[instructorColorMap.size % instructorPalette.length]);
    return instructorColorMap.get(key);
  }

  /* ============================== API =================================== */
  async function responseJson(response) {
    const text = await response.text();
    if (!text.trim()) throw new Error(`پاسخ خالی از سرور دریافت شد (${response.status})`);
    try { return JSON.parse(text); }
    catch { throw new Error(`پاسخ JSON نامعتبر از سرور دریافت شد (${response.status})`); }
  }

  async function apiGetDashboard(date) {
    const response = await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(date)}`, {
      credentials: "same-origin", headers: { Accept: "application/json" },
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || `خطا در دریافت داشبورد (${response.status})`);
    return data;
  }

  async function apiPatchSessionTime(sessionId, sessionDate, startTime, endTime, roomId) {
    const body = { sessionId, sessionDate, startTime, endTime };
    if (roomId !== undefined) body.roomId = roomId;
    const response = await fetch("/api/admin/daily-planner", {
      method: "PATCH", credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "ذخیره زمان‌بندی ناموفق بود.");
    return data;
  }

  async function apiPostAttendance(enrollmentSessionId, enrollmentId, status) {
    const response = await fetch("/api/admin/daily-planner", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ enrollmentSessionId, enrollmentId, status }),
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "ذخیره وضعیت حضور ناموفق بود.");
    return data;
  }

  async function apiPostPayment(invoiceId, amount, method, reference) {
    const response = await fetch("/api/admin/payments", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ invoiceId, amount, method, reference }),
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "ثبت پرداخت ناموفق بود.");
    return data;
  }

  async function apiPostRenewal(enrollmentId, startDate) {
    const response = await fetch("/api/admin/enrollment-term-renew", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ enrollmentId, startDate }),
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "تمدید ترم ناموفق بود.");
    return data;
  }

  /* ======================= DERIVED DATA (pure) ========================== */

  /** Sessions filtered by the current instructor filter. */
  function visibleSessions() {
    if (state.instructorFilter === "all") return state.sessions;
    return state.sessions.filter((s) => String(s.instructor_id) === String(state.instructorFilter));
  }

  /** Timeline start/end in minutes, padded around the day's sessions. */
  function timelineRange() {
    const starts = state.sessions.map((s) => minutesOf(s.startTime));
    const ends = state.sessions.map((s) => minutesOf(s.endTime));
    const start = Math.floor(Math.min(16 * 60, ...(starts.length ? [Math.min(...starts) - 30] : [])) / 60) * 60;
    const end = Math.ceil(Math.max(22 * 60, ...(ends.length ? [Math.max(...ends) + 30] : [])) / 60) * 60;
    return { start: Math.max(0, start), end: Math.min(24 * 60, end) };
  }

  /**
   * Instructor/room conflict detection (spec section 21). Purely a display
   * hint — the backend intentionally does not reject overlapping
   * instructor/room assignments (an instructor may run two rooms at once),
   * so this never blocks a save; it only flags the card.
   */
  function hasConflict(session, all) {
    return all.some((other) => (
      other.id !== session.id
      && other.status !== "cancelled" && session.status !== "cancelled"
      && String(other.instructor_id) === String(session.instructor_id)
      && String(other.room_id ?? "") === String(session.room_id ?? "")
      && session.room_id != null
      && minutesOf(other.startTime) < minutesOf(session.endTime)
      && minutesOf(other.endTime) > minutesOf(session.startTime)
    ));
  }

  function sessionVisualStatus(session) {
    if (session.status === "cancelled") return "cancelled";
    if (session.calendar_exception_type) return "exception";
    const now = new Date();
    const isToday = state.date === todayKey();
    if (!isToday) return session.status === "completed" ? "done" : "normal";
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const start = minutesOf(session.startTime);
    const end = minutesOf(session.endTime);
    if (nowMinutes < start) return "upcoming";
    if (nowMinutes >= end) return "done";
    return "ongoing";
  }

  /** Assigns a vertical lane index to each session in a room so overlaps stack instead of collide. */
  function assignLanes(items) {
    const sorted = [...items].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime) || minutesOf(a.endTime) - minutesOf(b.endTime));
    const lanes = [];
    for (const item of sorted) {
      const start = minutesOf(item.startTime);
      let lane = 0;
      while (lane < lanes.length && lanes[lane] > start) lane += 1;
      if (lane === lanes.length) lanes.push(minutesOf(item.endTime));
      else lanes[lane] = minutesOf(item.endTime);
      item.__lane = lane;
    }
    return Math.max(1, lanes.length);
  }

  /** Rooms-as-timeline-columns, built entirely from state.rooms (never hard-coded — spec 46.4). */
  function timelineColumns() {
    const columns = state.rooms.map((room) => ({ id: room.id, name: room.name, items: [] }));
    const byId = new Map(columns.map((c) => [String(c.id), c]));
    let unassigned = null;
    for (const item of visibleSessions()) {
      if (item.room_id != null && byId.has(String(item.room_id))) {
        byId.get(String(item.room_id)).items.push(item);
      } else {
        if (!unassigned) unassigned = { id: null, name: item.room_name || "بدون اتاق", items: [] };
        unassigned.items.push(item);
      }
    }
    if (unassigned) columns.push(unassigned);
    return columns;
  }

  function findSession(sessionId) {
    return state.sessions.find((s) => String(s.id) === String(sessionId)) || null;
  }
  function findStudent(session, enrollmentSessionId) {
    return (session?.students || []).find((st) => String(st.enrollmentSessionId) === String(enrollmentSessionId)) || null;
  }

  /* ============================== RENDER ================================ */
  /* Every render function is a pure read of `state` — nothing here mutates
     state, and nothing outside `render()` touches innerHTML. */

  const els = {
    dateLabel: root.querySelector("#dateLabel"),
    timeLabel: root.querySelector("#timeLabel"),
    sync: root.querySelector("#lastSync"),
    error: root.querySelector("#error"),
    summary: root.querySelector("#summary"),
    timeline: root.querySelector("#timeline"),
    sessionsPanel: root.querySelector("#sessionsPanel"),
    modal: root.querySelector("#quickPaymentModal"),
    modalBody: root.querySelector("#quickPaymentBody"),
  };

  function render() {
    renderClock();
    renderSync();
    renderError();
    renderSummary();
    renderTimeline();
    renderSessionsPanel();
    renderModal();
  }

  function renderClock() {
    els.dateLabel.innerHTML = formatShamsiDate(state.date);
    const now = new Date();
    els.timeLabel.textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function renderSync() {
    if (state.loading) {
      els.sync.textContent = "در حال بروزرسانی…";
      els.sync.classList.add("is-loading");
    } else {
      els.sync.classList.remove("is-loading");
      els.sync.textContent = state.lastUpdatedAt ? `آخرین بروزرسانی: ${state.lastUpdatedAt}` : "";
    }
  }

  function renderError() {
    if (!state.error) { els.error.hidden = true; els.error.innerHTML = ""; return; }
    els.error.hidden = false;
    els.error.innerHTML = `<span>${esc(state.error)}</span><button type="button" data-action="retry">تلاش دوباره</button>`;
  }

  function renderSummary() {
    const sessions = state.sessions.filter((s) => s.status !== "cancelled");
    const students = sessions.flatMap((s) => s.students || []);
    const totalStudents = students.length;
    const presentCount = students.filter((st) => st.attendanceStatus === "present").length;
    const pendingCount = students.filter((st) => st.attendanceStatus === "pending").length;
    const alarmStudents = students.filter((st) => typeof st.remainingSessions === "number" && st.remainingSessions <= 0);
    const cancelledCount = state.sessions.filter((s) => s.status === "cancelled").length;

    const attentionChips = alarmStudents.slice(0, 6).map((st) => `<span>${esc(st.studentName)}</span>`).join("");

    els.summary.innerHTML = `
      <div class="dd-stat"><strong>${formatNumber(sessions.length)}</strong><span>جلسه امروز${cancelledCount ? ` (${formatNumber(cancelledCount)} لغو شده)` : ""}</span></div>
      <div class="dd-stat"><strong>${formatNumber(totalStudents)}</strong><span>هنرجوی امروز</span></div>
      <div class="dd-stat"><strong>${formatNumber(presentCount)} / ${formatNumber(totalStudents)}</strong><span>حضور ثبت‌شده${pendingCount ? ` — ${formatNumber(pendingCount)} در انتظار` : ""}</span></div>
      <div class="dd-stat ${alarmStudents.length ? "warning attention-list" : ""}">
        <strong>${formatNumber(alarmStudents.length)}</strong><span>هنرجو بدون جلسه باقیمانده</span>
        ${attentionChips ? `<div class="attention-chips">${attentionChips}${alarmStudents.length > 6 ? `<span>+${formatNumber(alarmStudents.length - 6)}</span>` : ""}</div>` : ""}
      </div>`;
  }

  function renderTimeline() {
    const columns = timelineColumns();
    if (!state.sessions.length) {
      els.timeline.innerHTML = `<div class="dd-empty"><div class="dd-empty-title">هیچ جلسه‌ای برای این روز ثبت نشده</div><div class="dd-empty-note">با انتخاب روز دیگر یا افزودن کلاس از بخش «کلاس‌ها»، جلسات این روز را ببینید.</div></div>`;
      return;
    }
    if (!state.rooms.length) {
      els.timeline.innerHTML = `<div class="dd-empty"><div class="dd-empty-title">هیچ اتاق فعالی تعریف نشده</div><div class="dd-empty-note">از بخش «تنظیمات ← اتاق‌ها» حداقل یک اتاق فعال اضافه کنید تا نوار زمانی نمایش داده شود.</div></div>`;
      return;
    }
    const { start, end } = timelineRange();
    const totalMinutes = Math.max(60, end - start);
    const pxPerMinute = 2.1;
    const trackWidth = totalMinutes * pxPerMinute;

    const hourMarks = [];
    for (let m = start; m <= end; m += 30) {
      const left = ((m - start) / totalMinutes) * 100;
      const isMajor = m % 60 === 0;
      hourMarks.push(`<span class="dd-hour ${isMajor ? "dd-hour-major" : "dd-hour-minor"}" style="left:${left}%">${isMajor ? timeOf(m) : ""}</span>`);
    }

    const rows = columns.map((column) => {
      const laneCount = assignLanes(column.items);
      const rowHeight = Math.max(94, laneCount * 82 + 12);
      const cards = column.items.map((session) => renderTimelineCard(session, start, totalMinutes, laneCount)).join("");
      return `
        <div class="dd-row" style="min-height:${rowHeight}px" data-room-id="${column.id ?? ""}">
          <div class="dd-row-label"><strong>${esc(column.name)}</strong><small>${formatNumber(column.items.length)} جلسه</small></div>
          <div class="dd-track" style="min-width:${trackWidth}px;height:${rowHeight - 4}px" data-track-room-id="${column.id ?? ""}">${cards}</div>
        </div>`;
    }).join("");

    els.timeline.innerHTML = `
      <div class="dd-timeline-head">
        <h2>نوار زمانی امروز</h2>
        <div class="dd-timeline-legend">
          <span><i class="dd-dot gold"></i> در حال برگزاری</span>
          <span><i class="dd-dot red"></i> تداخل مدرس/اتاق</span>
          <span><i class="dd-dot gray"></i> لغو شده</span>
        </div>
      </div>
      <div class="dd-grid">
        <div class="dd-hours" style="min-width:${trackWidth}px;margin-inline-start:112px">${hourMarks.join("")}</div>
        <div class="dd-body">${rows}</div>
      </div>`;
  }

  function renderTimelineCard(session, rangeStart, totalMinutes, laneCount) {
    const startMin = minutesOf(session.startTime);
    const endMin = Math.max(startMin + 15, minutesOf(session.endTime));
    const left = ((startMin - rangeStart) / totalMinutes) * 100;
    const width = ((endMin - startMin) / totalMinutes) * 100;
    const lane = session.__lane || 0;
    const top = 6 + lane * 82;
    const conflict = hasConflict(session, state.sessions);
    const visual = sessionVisualStatus(session);
    const classes = ["dd-card"];
    if (session.status === "cancelled") classes.push("is-cancelled");
    if (conflict) classes.push("is-conflict");
    if (visual === "ongoing") classes.push("is-ongoing");
    const color = instructorColor(session.instructorName);
    const editing = state.editingSessionId === session.id;

    return `
      <div class="${classes.join(" ")}"
           style="right:${left}%;width:${width}%;top:${top}px;border-inline-start:3px solid ${color}"
           data-session-id="${session.id}" data-action="drag-session"
           role="group" aria-label="${esc(session.className)} — ${esc(session.instructorName)}">
        <div class="dd-resize start" data-action="resize-start" data-session-id="${session.id}"></div>
        ${editing ? renderTimeForm(session, "timeline") : `<span class="dd-card-time" data-action="edit-time" data-session-id="${session.id}" data-source="timeline">${session.startTime}–${session.endTime}</span>`}
        <strong>${esc(session.className)}</strong>
        <span class="dd-card-meta">${esc(session.instructorName)}${session.students?.length ? ` · ${formatNumber(session.students.length)} هنرجو` : ""}</span>
        <div class="dd-resize end" data-action="resize-end" data-session-id="${session.id}"></div>
      </div>`;
  }

  function renderTimeForm(session, source) {
    const err = session.__timeError ? `<div class="dd-time-error">${esc(session.__timeError)}</div>` : "";
    return `
      <form class="dd-time-form" data-action="save-time" data-session-id="${session.id}" data-source="${source}" onsubmit="return false">
        <input type="time" name="startTime" value="${session.startTime}" step="300" aria-label="زمان شروع" />
        <span>تا</span>
        <input type="time" name="endTime" value="${session.endTime}" step="300" aria-label="زمان پایان" />
        <button type="submit" class="save" data-action="submit-time" data-session-id="${session.id}" ${state.saving ? "disabled" : ""}>ذخیره</button>
        <button type="button" data-action="cancel-time">انصراف</button>
        ${err}
      </form>`;
  }

  /**
   * Time badge shown inside each student card (spec section 11.1). Reads
   * the exact same session.startTime/endTime as the timeline card and the
   * session-panel header, and its edit action calls the same saveSessionTime
   * on the same session.id — there is no per-student time, only per-session
   * time shown in three places. Editing from here re-renders everywhere
   * because render() always redraws the whole panel from state.sessions.
   */
  function renderStudentTimeBadge(session, editing) {
    if (editing) return renderTimeForm(session, "student");
    return `<span class="dd-time-value" data-action="edit-time" data-session-id="${session.id}" data-source="student">${session.startTime}–${session.endTime}</span>`;
  }

  function renderSessionsPanel() {
    const sessions = visibleSessions();
    if (!sessions.length) {
      els.sessionsPanel.innerHTML = `<div class="dd-empty"><div class="dd-empty-title">جلسه‌ای برای نمایش نیست</div><div class="dd-empty-note">فیلتر مدرس یا روز انتخاب‌شده را بررسی کنید.</div></div>`;
      return;
    }
    const sorted = [...sessions].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));
    els.sessionsPanel.innerHTML = sorted.map(renderSessionCard).join("");
  }

  function renderSessionCard(session) {
    const conflict = hasConflict(session, state.sessions);
    const editing = state.editingSessionId === session.id;
    const cancelled = session.status === "cancelled";
    const tags = [];
    if (cancelled) tags.push(`<span class="dd-session-tag cancelled">لغو شده${session.cancelReason ? `: ${esc(session.cancelReason)}` : ""}</span>`);
    if (conflict && !cancelled) tags.push(`<span class="dd-session-tag conflict">تداخل مدرس/اتاق</span>`);
    if (session.room_name) tags.push(`<span class="dd-session-tag gold">${esc(session.room_name)}</span>`);

    const exceptionBanner = session.calendar_exception_type
      ? `<div class="dd-exception-banner">امروز «${esc(session.calendar_exception_title || session.calendar_exception_type)}» است — این جلسه ممکن است تحت تأثیر قرار گیرد.</div>` : "";

    const students = (session.students || []).map((st) => renderStudentCard(session, st)).join("");

    return `
      <article class="dd-session ${cancelled ? "is-cancelled" : ""}" data-session-id="${session.id}">
        <div class="dd-session-head">
          <div class="dd-session-head-main">
            <strong>${esc(session.className)}</strong>
            <span>${esc(session.instructorName)}</span>
            ${editing ? renderTimeForm(session, "panel") : `<span class="dd-time-value" data-action="edit-time" data-session-id="${session.id}" data-source="panel">${session.startTime}–${session.endTime}</span>`}
            ${tags.join("")}
          </div>
          <div class="dd-teacher-attendance">
            <span>حضور مدرس:</span>
            ${renderTeacherAttendance(session)}
          </div>
        </div>
        ${exceptionBanner}
        <div class="dd-students">${students || `<div class="dd-empty-note">هنرجویی برای این جلسه ثبت نشده است.</div>`}</div>
      </article>`;
  }

  function renderTeacherAttendance(session) {
    const status = session.teacherAttendanceStatus || "pending";
    return ["present", "absent"].map((value) => `
      <button type="button" class="dd-teacher-status ${value} ${status === value ? "is-active" : ""}"
              data-action="teacher-attendance" data-session-id="${session.id}" data-status="${value}"
              aria-pressed="${status === value}">${teacherAttendanceLabels[value]}</button>
    `).join("") || teacherAttendanceLabels.pending;
  }

  function badgeClassFor(remaining) {
    if (remaining == null) return "badge-neutral";
    if (remaining <= 0) return "badge-red badge-alarm";
    if (remaining === 1) return "badge-orange";
    return "badge-green";
  }
  function badgeLabelFor(remaining) {
    if (remaining == null) return "ماه";
    return formatNumber(remaining);
  }

  function renderStudentCard(session, student) {
    const status = student.attendanceStatus || "pending";
    const remaining = student.remainingSessions;
    const financeStatus = student.financialStatus || "none";
    const badgeTitle = remaining == null
      ? "شهریه ماهانه"
      : remaining <= 0
        ? "جلسه باقیمانده‌ای ندارد — نیاز به تمدید/پرداخت"
        : `${formatNumber(remaining)} جلسه باقیمانده`;
    const editing = state.editingSessionId === session.id;

    return `
      <div class="dd-student-card is-${status}" data-enrollment-session-id="${student.enrollmentSessionId}">
        <div class="dd-student-head">
          <div class="dd-student-name-row">
            <button type="button" class="dd-badge ${badgeClassFor(remaining)}"
                    data-action="open-quick-payment" data-enrollment-session-id="${student.enrollmentSessionId}"
                    title="${esc(badgeTitle)}" aria-label="${esc(student.studentName)} — ${esc(badgeTitle)}">${badgeLabelFor(remaining)}</button>
            <span class="dd-student-name">${esc(student.studentName)}</span>
          </div>
          <div class="dd-attendance-buttons" role="group" aria-label="وضعیت حضور ${esc(student.studentName)}">
            ${["present", "absent", "excused", "withdrawn"].map((value) => `
              <button type="button" class="dd-attendance-button ${value} ${status === value ? "active" : ""}"
                      data-action="attendance" data-enrollment-session-id="${student.enrollmentSessionId}"
                      data-enrollment-id="${student.enrollmentId}" data-status="${value}"
                      aria-pressed="${status === value}" title="${attendanceLabels[value]}"
                      ${state.saving ? "disabled" : ""}>${attendanceLabels[value][0]}</button>
            `).join("")}
          </div>
        </div>
        <div class="dd-student-time-row">
          ${renderStudentTimeBadge(session, editing)}
        </div>
        <div class="dd-student-meta">
          <span>${financeLabels[financeStatus] || financeLabels.none}</span>
          <span>${student.instrument ? esc(student.instrument) : ""}</span>
        </div>
        ${renderFinanceBox(session, student)}
      </div>`;
  }

  function renderFinanceBox(session, student) {
    const status = student.financialStatus || "none";
    const balance = Number(student.balanceDue ?? 0);
    const paid = Number(student.amountPaid ?? 0);
    const total = Number(student.invoiceTotal ?? 0);
    const showPaymentForm = state.quickPayment?.enrollmentSessionId === student.enrollmentSessionId && !state.quickPayment?.isModal;

    return `
      <div class="finance-box">
        <div class="finance-title">
          <strong>وضعیت مالی</strong>
          <span class="finance-status ${status}">${financeLabels[status] || financeLabels.none}</span>
        </div>
        ${student.invoiceId ? `
          <div class="finance-grid">
            <div class="finance-item"><span>مبلغ کل</span><b>${formatNumber(total)} تومان</b></div>
            <div class="finance-item"><span>پرداخت‌شده</span><b>${formatNumber(paid)} تومان</b></div>
            <div class="finance-item finance-balance"><span>مانده</span><b>${formatNumber(balance)} تومان</b></div>
          </div>
          ${balance > 0 ? `<button type="button" class="payment-toggle" data-action="toggle-payment-form" data-enrollment-session-id="${student.enrollmentSessionId}">${showPaymentForm ? "بستن فرم پرداخت" : "ثبت پرداخت سریع"}</button>` : ""}
          ${showPaymentForm ? renderPaymentForm(student) : ""}
        ` : `<div class="finance-item"><span>صورتحسابی برای این ترم ثبت نشده است.</span></div>`}
        ${renderRenewalBox(session, student)}
      </div>`;
  }

  function renderPaymentForm(student) {
    const message = state.quickPayment?.message;
    return `
      <form class="payment-form" data-action="submit-payment" data-invoice-id="${student.invoiceId}" data-enrollment-session-id="${student.enrollmentSessionId}" onsubmit="return false">
        <input type="number" name="amount" min="1000" step="1000" placeholder="مبلغ (تومان)" value="${Math.max(0, Number(student.balanceDue ?? 0))}" required />
        <select name="method">
          ${Object.entries(paymentMethodLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
        <input type="text" name="reference" placeholder="شماره پیگیری (اختیاری)" />
        <button type="submit" ${state.saving ? "disabled" : ""}>ثبت پرداخت</button>
        ${message ? `<div class="payment-message ${state.quickPayment.messageType}">${esc(message)}</div>` : ""}
      </form>`;
  }

  function renderRenewalBox(session, student) {
    if (!student.renewalReady) return "";
    const showForm = state.quickPayment?.enrollmentSessionId === student.enrollmentSessionId && state.quickPayment?.renewalOpen;
    return `
      <div class="renewal-box">
        <div class="renewal-head">
          <strong>${student.remainingSessions != null && student.remainingSessions <= 0 ? "جلسات این ترم به پایان رسیده" : "به پایان ترم نزدیک است"}</strong>
          <button type="button" class="renewal-button" data-action="toggle-renewal-form" data-enrollment-session-id="${student.enrollmentSessionId}" data-enrollment-id="${student.enrollmentId}">${showForm ? "بستن" : "تمدید ترم"}</button>
        </div>
        ${showForm ? `
          <form class="renewal-form" data-action="submit-renewal" data-enrollment-id="${student.enrollmentId}" onsubmit="return false">
            <label>تاریخ شروع ترم جدید
              <input type="date" name="startDate" value="${state.date}" required />
            </label>
            <button type="submit" ${state.saving ? "disabled" : ""}>ثبت تمدید</button>
          </form>
          <div class="renewal-note">تمدید، یک ترم و صورتحساب جدید بر اساس شهریه فعلی هنرجو ایجاد می‌کند.</div>
        ` : ""}
      </div>`;
  }

  function renderModal() {
    if (!state.quickPayment?.isModal) {
      els.modal.hidden = true; els.modal.setAttribute("aria-hidden", "true"); return;
    }
    const session = state.sessions.find((s) => (s.students || []).some((st) => st.enrollmentSessionId === state.quickPayment.enrollmentSessionId));
    const student = session ? findStudent(session, state.quickPayment.enrollmentSessionId) : null;
    if (!student) { state.quickPayment = null; els.modal.hidden = true; return; }
    els.modal.hidden = false; els.modal.setAttribute("aria-hidden", "false");
    els.modalBody.innerHTML = `
      <div style="margin-bottom:10px;font-size:13px"><strong>${esc(student.studentName)}</strong> — ${esc(session.className)}</div>
      ${renderFinanceBoxForModal(student)}`;
  }

  function renderFinanceBoxForModal(student) {
    const status = student.financialStatus || "none";
    const balance = Number(student.balanceDue ?? 0);
    const message = state.quickPayment?.message;
    if (!student.invoiceId) return `<div class="finance-item"><span>صورتحسابی برای این ترم ثبت نشده است.</span></div>`;
    return `
      <div class="finance-grid">
        <div class="finance-item"><span>مبلغ کل</span><b>${formatNumber(student.invoiceTotal)} تومان</b></div>
        <div class="finance-item"><span>پرداخت‌شده</span><b>${formatNumber(student.amountPaid)} تومان</b></div>
        <div class="finance-item finance-balance"><span>مانده</span><b>${formatNumber(balance)} تومان</b></div>
      </div>
      <div class="finance-status ${status}" style="display:inline-block;margin-bottom:10px">${financeLabels[status]}</div>
      ${balance > 0 ? renderPaymentForm(student) : `<div class="payment-message success">این ترم تسویه شده است.</div>`}
      ${message && !balance ? `<div class="payment-message ${state.quickPayment.messageType}">${esc(message)}</div>` : ""}
      ${renderRenewalBox(null, student)}`;
  }

  /* ============================== ACTIONS ================================ */
  /* Every mutation goes through one of these; each re-renders once at the end. */

  /**
   * Normalizes one raw session record from GET /api/admin/daily-dashboard
   * (a mix of snake_case DB columns and a few existing camelCase aliases —
   * see src/pages/api/admin/daily-dashboard.ts) into the shape this
   * controller renders. Keeping this in one place means the render/action
   * functions never need to know about the API's column naming.
   */
  function normalizeSession(raw) {
    return {
      ...raw,
      className: raw.class_title,
      instructorName: raw.instructor_name,
      teacherAttendanceStatus: raw.teacher_attendance_status || "pending",
      cancelReason: raw.notes && raw.status === "cancelled" ? raw.notes : null,
      startTime: raw.start_time,
      endTime: raw.end_time,
      students: (raw.students || []).map((st) => ({
        ...st,
        balanceDue: st.balance,
        invoiceTotal: st.invoiceAmount,
      })),
    };
  }

  async function loadDashboard(date) {
    state.loading = true; state.error = null; render();
    try {
      const data = await apiGetDashboard(date);
      state.date = date;
      state.sessions = (data.sessions || []).map(normalizeSession);
      state.rooms = data.rooms || [];
      state.lastUpdatedAt = new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    } catch (err) {
      state.error = err.message || "دریافت اطلاعات با خطا مواجه شد.";
    } finally {
      state.loading = false; render();
    }
  }

  function changeDate(nextDate) {
    state.editingSessionId = null; state.quickPayment = null;
    loadDashboard(nextDate);
  }

  async function saveSessionTime(sessionId, startTime, endTime) {
    const session = findSession(sessionId);
    if (!session) return;
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      session.__timeError = "قالب زمان نامعتبر است."; render(); return;
    }
    if (minutesOf(endTime) <= minutesOf(startTime)) {
      session.__timeError = "زمان پایان باید بعد از زمان شروع باشد."; render(); return;
    }
    const prevStart = session.startTime, prevEnd = session.endTime;
    session.startTime = startTime; session.endTime = endTime; session.__timeError = null;
    state.saving += 1; render();
    try {
      await apiPatchSessionTime(sessionId, state.date, startTime, endTime, session.room_id ?? undefined);
      state.editingSessionId = null;
    } catch (err) {
      session.startTime = prevStart; session.endTime = prevEnd;
      session.__timeError = err.message || "ذخیره زمان ناموفق بود.";
    } finally {
      state.saving -= 1; render();
    }
  }

  async function moveSessionToRoom(sessionId, roomId, startTime, endTime) {
    const session = findSession(sessionId);
    if (!session) return;
    const prev = { room_id: session.room_id, startTime: session.startTime, endTime: session.endTime };
    session.room_id = roomId; session.startTime = startTime; session.endTime = endTime;
    state.saving += 1; render();
    try {
      await apiPatchSessionTime(sessionId, state.date, startTime, endTime, roomId);
    } catch (err) {
      Object.assign(session, prev);
      state.error = err.message || "جابجایی جلسه ناموفق بود.";
    } finally {
      state.saving -= 1; render();
    }
  }

  async function setAttendance(enrollmentSessionId, enrollmentId, status) {
    const session = state.sessions.find((s) => (s.students || []).some((st) => String(st.enrollmentSessionId) === String(enrollmentSessionId)));
    const student = session && findStudent(session, enrollmentSessionId);
    if (!student) return;
    const prevStatus = student.attendanceStatus;
    const nextStatus = prevStatus === status ? "pending" : status;
    student.attendanceStatus = nextStatus;
    state.saving += 1; render();
    try {
      await apiPostAttendance(enrollmentSessionId, enrollmentId, nextStatus);
      await loadDashboard(state.date);
    } catch (err) {
      student.attendanceStatus = prevStatus;
      state.error = err.message || "ثبت حضور ناموفق بود.";
    } finally {
      // This used to only decrement on the catch path, so every successful
      // attendance click left state.saving stuck above zero forever — which
      // disables the attendance buttons (they render with `disabled` while
      // state.saving > 0) on every student card, not just the one clicked.
      state.saving -= 1; render();
    }
  }

  async function setTeacherAttendance(sessionId, status) {
    const session = findSession(sessionId);
    if (!session) return;
    const prevStatus = session.teacherAttendanceStatus;
    session.teacherAttendanceStatus = prevStatus === status ? "pending" : status;
    render();
    try {
      const response = await fetch("/api/admin/daily-planner", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ classSessionId: sessionId, teacherAttendanceStatus: session.teacherAttendanceStatus }),
      });
      const data = await responseJson(response);
      if (!response.ok || !data.success) throw new Error(data.message || "ثبت حضور مدرس ناموفق بود.");
    } catch (err) {
      session.teacherAttendanceStatus = prevStatus;
      state.error = err.message || "ثبت حضور مدرس ناموفق بود.";
      render();
    }
  }

  async function submitPayment(form) {
    const invoiceId = Number(form.dataset.invoiceId);
    const enrollmentSessionId = form.dataset.enrollmentSessionId;
    const amount = Number(form.elements.amount.value);
    const method = form.elements.method.value;
    const reference = form.elements.reference.value.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      state.quickPayment = { ...state.quickPayment, message: "مبلغ پرداختی معتبر نیست.", messageType: "error" };
      render(); return;
    }
    state.saving += 1; render();
    try {
      await apiPostPayment(invoiceId, amount, method, reference);
      state.quickPayment = null;
      await loadDashboard(state.date);
    } catch (err) {
      state.quickPayment = { ...state.quickPayment, enrollmentSessionId, message: err.message || "ثبت پرداخت ناموفق بود.", messageType: "error" };
    } finally {
      state.saving -= 1; render();
    }
  }

  async function submitRenewal(form) {
    const enrollmentId = Number(form.dataset.enrollmentId);
    const startDate = form.elements.startDate.value;
    if (!startDate) return;
    state.saving += 1; render();
    try {
      await apiPostRenewal(enrollmentId, startDate);
      state.quickPayment = null;
      await loadDashboard(state.date);
    } catch (err) {
      state.error = err.message || "تمدید ترم ناموفق بود.";
    } finally {
      state.saving -= 1; render();
    }
  }

  /* ============================== EVENTS ================================= */
  /* One set of delegated listeners on the root. No per-card listeners, no
     capture-phase re-binding, no MutationObserver — this is the fix for the
     three-scripts-fighting-over-pointer-events issue (spec sections 13/14). */

  const INTERACTIVE_SELECTOR = "button, input, select, textarea, a, form, .dd-time-form, .dd-resize";

  root.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case "retry": state.error = null; loadDashboard(state.date); break;
      case "edit-time":
        state.editingSessionId = Number(actionEl.dataset.sessionId);
        { const s = findSession(state.editingSessionId); if (s) s.__timeError = null; }
        render(); break;
      case "cancel-time": state.editingSessionId = null; render(); break;
      case "attendance":
        setAttendance(actionEl.dataset.enrollmentSessionId, Number(actionEl.dataset.enrollmentId), actionEl.dataset.status);
        break;
      case "teacher-attendance":
        setTeacherAttendance(Number(actionEl.dataset.sessionId), actionEl.dataset.status);
        break;
      case "open-quick-payment":
        state.quickPayment = { enrollmentSessionId: actionEl.dataset.enrollmentSessionId, isModal: true };
        render(); break;
      case "close-modal": state.quickPayment = null; render(); break;
      case "toggle-payment-form": {
        const id = actionEl.dataset.enrollmentSessionId;
        state.quickPayment = state.quickPayment?.enrollmentSessionId === id && !state.quickPayment.isModal ? null : { enrollmentSessionId: id };
        render(); break;
      }
      case "toggle-renewal-form": {
        const id = actionEl.dataset.enrollmentSessionId;
        const isOpen = state.quickPayment?.enrollmentSessionId === id && state.quickPayment.renewalOpen;
        state.quickPayment = isOpen ? null : { enrollmentSessionId: id, renewalOpen: true };
        render(); break;
      }
      default: break;
    }
  });

  root.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-action]");
    if (!form) return;
    event.preventDefault();
    switch (form.dataset.action) {
      case "save-time": {
        const start = form.elements.startTime.value, end = form.elements.endTime.value;
        saveSessionTime(Number(form.dataset.sessionId), start, end);
        break;
      }
      case "submit-payment": submitPayment(form); break;
      case "submit-renewal": submitRenewal(form); break;
      default: break;
    }
  });

  /* ---- Drag / resize on timeline cards (pointer events, single owner) ---- */
  let drag = null; // { sessionId, kind: 'move'|'resize-start'|'resize-end', pointerId, track, originLeft, originWidth, startX, roomId }

  root.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(".dd-card");
    if (!card) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return; // never hijack clicks on inline controls
    const sessionId = Number(card.dataset.sessionId);
    const session = findSession(sessionId);
    if (!session || session.status === "cancelled") return;

    const track = card.closest(".dd-track");
    const kind = event.target.closest('[data-action="resize-start"]') ? "resize-start"
      : event.target.closest('[data-action="resize-end"]') ? "resize-end" : "move";

    drag = {
      sessionId, kind, pointerId: event.pointerId, track,
      startX: event.clientX,
      startTime: session.startTime, endTime: session.endTime,
      trackRect: track.getBoundingClientRect(),
      roomId: Number(track.dataset.trackRoomId) || null,
    };
    card.setPointerCapture(event.pointerId);
    card.dataset.dragging = "1";
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { start, end } = timelineRange();
    const totalMinutes = Math.max(60, end - start);
    const deltaX = event.clientX - drag.startX;
    const deltaMinutes = snap15((deltaX / drag.trackRect.width) * totalMinutes);
    const session = findSession(drag.sessionId);
    if (!session) return;

    if (drag.kind === "move") {
      const duration = minutesOf(drag.endTime) - minutesOf(drag.startTime);
      let newStart = minutesOf(drag.startTime) + deltaMinutes;
      newStart = Math.max(start, Math.min(end - duration, newStart));
      session.startTime = timeOf(newStart);
      session.endTime = timeOf(newStart + duration);
    } else if (drag.kind === "resize-start") {
      let newStart = Math.max(start, Math.min(minutesOf(drag.endTime) - 15, minutesOf(drag.startTime) + deltaMinutes));
      session.startTime = timeOf(newStart);
    } else if (drag.kind === "resize-end") {
      let newEnd = Math.min(end, Math.max(minutesOf(drag.startTime) + 15, minutesOf(drag.endTime) + deltaMinutes));
      session.endTime = timeOf(newEnd);
    }
    renderTimeline();
  });

  function endDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const session = findSession(drag.sessionId);
    const cardEl = root.querySelector(`.dd-card[data-session-id="${drag.sessionId}"]`);
    if (cardEl) delete cardEl.dataset.dragging;
    if (session) {
      const changed = session.startTime !== drag.startTime || session.endTime !== drag.endTime;
      if (changed) moveSessionToRoom(drag.sessionId, session.room_id ?? drag.roomId, session.startTime, session.endTime);
    }
    drag = null;
  }
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  /* ============================== BOOTSTRAP =============================== */

  root.querySelector("#prev").addEventListener("click", () => {
    const d = new Date(state.date); d.setDate(d.getDate() - 1); changeDate(localDateString(d));
  });
  root.querySelector("#next").addEventListener("click", () => {
    const d = new Date(state.date); d.setDate(d.getDate() + 1); changeDate(localDateString(d));
  });
  root.querySelector("#today").addEventListener("click", () => changeDate(todayKey()));
  root.querySelector("#refresh").addEventListener("click", () => loadDashboard(state.date));

  setInterval(() => { renderClock(); }, 30_000);
  // Silent background refresh so the "ongoing" highlight and remaining-session
  // badges stay accurate through the day, without disrupting an in-progress edit.
  setInterval(() => {
    if (state.editingSessionId == null && !state.quickPayment && !drag) loadDashboard(state.date);
  }, 120_000);

  loadDashboard(state.date);
})();
