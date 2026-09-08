(() => {
  if (location.pathname !== "/admin/daily") return;

  const localDateString = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const shell = document.querySelector(".daily-shell");
  const summary = document.querySelector("#summary");
  if (!shell || !summary || document.querySelector("#dailyPlanner")) return;

  const state = { date: localDateString(), instructor: "all", sessions: [], saving: 0 };
  const esc = (value) => {
    const el = document.createElement("div");
    el.textContent = String(value ?? "");
    return el.innerHTML;
  };
  const minutes = (value) => {
    const [h, m] = String(value || "00:00").split(":").map(Number);
    return h * 60 + m;
  };
  const time = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const snap = (value) => Math.round(value / 15) * 15;

  const planner = document.createElement("section");
  planner.id = "dailyPlanner";
  planner.dir = "rtl";
  planner.innerHTML = `
    <header class="dp-head">
      <div class="dp-title"><div><h2>برنامه‌ریزی روزانه</h2><small>برنامه جلسات و هنرجویان · شبکه ۱۵ دقیقه‌ای</small></div></div>
      <div class="dp-controls"><select id="dpInstructor" class="dp-select" aria-label="مدرس"><option value="all">همه مدرسان</option></select><span id="dpSave" class="dp-save">در حال بارگذاری…</span></div>
    </header>
    <div class="dp-scroll"><div id="dpGrid" class="dp-grid"></div></div>
    <div class="dp-legend"><span><i class="dp-dot gold"></i>جلسه</span><span><i class="dp-dot gray"></i>شبکه ۱۵ دقیقه‌ای</span><span><i class="dp-dot red"></i>تداخل زمانی</span></div>
  `;
  summary.insertAdjacentElement("afterend", planner);

  const menu = document.createElement("div");
  menu.className = "dp-context";
  menu.innerHTML = `<button data-status="present">حضور</button><button data-status="excused">مرخصی</button><button data-status="absent">غیبت</button><button data-status="withdrawn" class="danger">انصراف</button>`;
  document.body.appendChild(menu);
  let contextStudent = null;

  const setSave = (text, cls = "") => {
    const el = document.querySelector("#dpSave");
    if (el) { el.textContent = text; el.className = `dp-save ${cls}`; }
  };
  const filtered = () => state.instructor === "all" ? state.sessions : state.sessions.filter(s => String(s.instructor_id) === String(state.instructor));

  function range() {
    const starts = state.sessions.map(s => minutes(s.startTime));
    const ends = state.sessions.map(s => minutes(s.endTime));
    const start = Math.floor(Math.min(16 * 60, ...(starts.length ? [Math.min(...starts) - 30] : [])) / 60) * 60;
    const end = Math.ceil(Math.max(22 * 60, ...(ends.length ? [Math.max(...ends) + 30] : [])) / 60) * 60;
    return { start, end };
  }

  function fillInstructors() {
    const select = document.querySelector("#dpInstructor");
    if (!select) return;
    const values = [...new Map(state.sessions.map(s => [s.instructor_id, s.instructor_name || `مدرس ${s.instructor_id}`])).entries()];
    select.innerHTML = `<option value="all">همه مدرسان</option>` + values.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    select.value = values.some(([id]) => String(id) === String(state.instructor)) ? state.instructor : "all";
  }

  function conflict(item, all) {
    return all.some(other => other.id !== item.id && String(other.instructor_id) === String(item.instructor_id) &&
      (item.room_id == null || other.room_id == null || String(item.room_id) === String(other.room_id)) &&
      minutes(other.startTime) < minutes(item.endTime) && minutes(other.endTime) > minutes(item.startTime));
  }

  // Put overlapping sessions into separate visual lanes. This allows one instructor
  // to teach in two rooms, and also allows multiple students in the same room/time,
  // without cards painting over each other.
  function assignLanes(items) {
    const sorted = [...items].sort((a, b) => {
      const byStart = minutes(a.startTime) - minutes(b.startTime);
      return byStart || (minutes(a.endTime) - minutes(b.endTime));
    });
    const lanes = [];
    for (const item of sorted) {
      const start = minutes(item.startTime);
      let lane = 0;
      while (lane < lanes.length && lanes[lane] > start) lane++;
      if (lane === lanes.length) lanes.push(minutes(item.endTime));
      else lanes[lane] = minutes(item.endTime);
      item.__lane = lane;
    }
    return lanes.length;
  }

  function render() {
    const grid = document.querySelector("#dpGrid");
    if (!grid) return;
    const items = filtered();
    const { start, end } = range();
    const total = Math.max(60, end - start);
    const hours = [];
    for (let m = start; m <= end; m += 60) hours.push(`<span class="dp-hour" style="left:${((m - start) / total) * 100}%">${time(m)}</span>`);

    const grouped = new Map();
    for (const item of items) {
      const key = String(item.instructor_id);
      if (!grouped.has(key)) grouped.set(key, { name: item.instructor_name || "مدرس", room: item.room_name || "اتاق آزاد", items: [] });
      grouped.get(key).items.push(item);
    }

    const rows = [...grouped.values()];
    grid.innerHTML = `<div class="dp-hours">${hours.join("")}</div><div class="dp-body">${rows.length ? rows.map(row => {
      const laneCount = assignLanes(row.items);
      const rowHeight = Math.max(94, laneCount * 84 + 10);
      return `
      <div class="dp-row" style="height:${rowHeight}px">
        <div class="dp-row-label">${esc(row.name)}<small>${esc(row.room)}${laneCount > 1 ? ` · ${laneCount} برنامه همزمان` : ""}</small></div>
        <div class="dp-track">${row.items.map(item => {
          const left = ((minutes(item.startTime) - start) / total) * 100;
          const width = Math.max(2, ((minutes(item.endTime) - minutes(item.startTime)) / total) * 100);
          const lane = item.__lane || 0;
          const students = Array.isArray(item.students) ? item.students : [];
          const names = students.map(s => s.studentName).filter(Boolean).join("، ") || item.student_names || "بدون هنرجو";
          const courses = students.map(s => s.courseName).filter(Boolean).join("، ") || item.course_names || item.class_title || "جلسه";
          return `<article class="dp-card ${conflict(item, items) ? "is-conflict" : ""}" data-session-id="${esc(item.id)}" style="left:${left}%;width:${width}%;top:${10 + lane * 84}px" title="برای جابه‌جایی بکشید">
            <strong>${esc(names)}</strong>
            <span>${esc(courses)} · ${esc(item.room_name || "اتاق")}</span>
            <time>${esc(item.startTime)}–${esc(item.endTime)}</time>
            <i class="dp-resize start" data-resize="start"></i><i class="dp-resize end" data-resize="end"></i>
          </article>`;
        }).join("")}</div>
      </div>`;
    }).join("") : `<div class="dp-empty">برای این روز جلسه زمان‌بندی‌شده‌ای پیدا نشد.</div>`}</div>`;
    bindCards();
  }

  async function load() {
    setSave("در حال بارگذاری…", "is-saving");
    try {
      const response = await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(state.date)}`, { credentials: "same-origin", headers: { accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "دریافت برنامه ناموفق بود");
      state.sessions = (data.sessions || []).map(s => ({
        ...s,
        startTime: s.start_time || s.startTime,
        endTime: s.end_time || s.endTime,
        students: Array.isArray(s.students) ? s.students : [],
        student_names: s.student_names || (Array.isArray(s.students) ? s.students.map(x => x.studentName).filter(Boolean).join("، ") : ""),
        course_names: s.course_names || (Array.isArray(s.students) ? s.students.map(x => x.courseName).filter(Boolean).join("، ") : "")
      })).filter(s => s.startTime && s.endTime);
      fillInstructors();
      render();
      setSave(`${state.sessions.length} جلسه · ذخیره خودکار`, "is-saved");
    } catch (error) {
      setSave(error instanceof Error ? error.message : "خطا در دریافت برنامه", "is-error");
      const grid = document.querySelector("#dpGrid");
      if (grid) grid.innerHTML = `<div class="dp-empty">دریافت برنامه روزانه انجام نشد. صفحه را دوباره بارگذاری کنید.</div>`;
    }
  }

  async function save(item, oldStart, oldEnd) {
    state.saving++;
    setSave("در حال ذخیره…", "is-saving");
    try {
      const response = await fetch("/api/admin/daily-planner", { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ sessionId: item.id, sessionDate: state.date, startTime: item.startTime, endTime: item.endTime }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "ذخیره ناموفق بود");
      setSave("ذخیره شد", "is-saved");
    } catch (error) {
      item.startTime = oldStart;
      item.endTime = oldEnd;
      render();
      setSave(error instanceof Error ? error.message : "ذخیره ناموفق بود", "is-error");
    } finally {
      state.saving = Math.max(0, state.saving - 1);
    }
  }

  function bindCards() {
    document.querySelectorAll(".dp-card").forEach(card => {
      let mode = null;
      let pointerId = null;
      let oldStart = "";
      let oldEnd = "";
      card.addEventListener("pointerdown", event => {
        const item = state.sessions.find(s => String(s.id) === String(card.dataset.sessionId));
        if (!item) return;
        mode = event.target.closest(".dp-resize")?.dataset.resize || "move";
        pointerId = event.pointerId;
        oldStart = item.startTime;
        oldEnd = item.endTime;
        card.setPointerCapture?.(pointerId);
        card.dataset.dragging = "1";
      });
      card.addEventListener("pointermove", event => {
        if (!mode || event.pointerId !== pointerId) return;
        const item = state.sessions.find(s => String(s.id) === String(card.dataset.sessionId));
        if (!item) return;
        const track = card.parentElement;
        const rect = track.getBoundingClientRect();
        const { start, end } = range();
        const raw = start + ((event.clientX - rect.left) / Math.max(1, rect.width)) * (end - start);
        const value = Math.max(start, Math.min(end, snap(raw)));
        if (mode === "move") {
          const duration = minutes(item.endTime) - minutes(item.startTime);
          const next = Math.max(start, Math.min(end - duration, value));
          item.startTime = time(next);
          item.endTime = time(next + duration);
        } else if (mode === "start") {
          item.startTime = time(Math.max(start, Math.min(minutes(item.endTime) - 15, value)));
        } else {
          item.endTime = time(Math.max(minutes(item.startTime) + 15, Math.min(end, value)));
        }
        const left = ((minutes(item.startTime) - start) / (end - start)) * 100;
        const width = ((minutes(item.endTime) - minutes(item.startTime)) / (end - start)) * 100;
        card.style.left = `${left}%`;
        card.style.width = `${Math.max(2, width)}%`;
        const timeEl = card.querySelector("time");
        if (timeEl) timeEl.textContent = `${item.startTime}–${item.endTime}`;
      });
      card.addEventListener("pointerup", async event => {
        if (!mode || event.pointerId !== pointerId) return;
        const item = state.sessions.find(s => String(s.id) === String(card.dataset.sessionId));
        const changed = item && (item.startTime !== oldStart || item.endTime !== oldEnd);
        mode = null;
        pointerId = null;
        delete card.dataset.dragging;
        if (changed) await save(item, oldStart, oldEnd);
      });
      card.addEventListener("pointercancel", () => { mode = null; pointerId = null; delete card.dataset.dragging; });
      card.addEventListener("contextmenu", event => {
        event.preventDefault();
        const item = state.sessions.find(s => String(s.id) === String(card.dataset.sessionId));
        const student = item?.students?.[0];
        if (!student) return;
        contextStudent = student;
        menu.style.display = "block";
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
      });
    });
  }

  menu.addEventListener("click", async event => {
    const button = event.target.closest("button[data-status]");
    if (!button || !contextStudent) return;
    const status = button.dataset.status;
    try {
      const response = await fetch("/api/admin/daily-planner", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ enrollmentSessionId: contextStudent.enrollmentSessionId, enrollmentId: contextStudent.enrollmentId, status }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "ثبت وضعیت ناموفق بود");
      await load();
    } catch (error) {
      setSave(error instanceof Error ? error.message : "ثبت وضعیت ناموفق بود", "is-error");
    } finally {
      menu.style.display = "none";
      contextStudent = null;
    }
  });

  document.addEventListener("click", () => { menu.style.display = "none"; });
  document.querySelector("#dpInstructor")?.addEventListener("change", event => { state.instructor = event.target.value; render(); });
  document.querySelector("#dpDate")?.addEventListener("change", event => {
    if (!event.target.value) return;
    state.date = event.target.value;
    load();
  });

  load();
})();
