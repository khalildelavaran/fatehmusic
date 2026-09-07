(() => {
  if (location.pathname !== "/admin/daily") return;
  if (document.querySelector("#dailyPlanner")) return;

  const shell = document.querySelector(".daily-shell");
  const summary = document.querySelector("#summary");
  if (!shell || !summary) return;

  const state = { date: localDateString(), instructor: "all", sessions: [], dragging: null, saving: 0 };
  const STORAGE_KEY = "fateh:daily-planner:v1:";
  const esc = (v) => { const d = document.createElement("div"); d.textContent = String(v ?? ""); return d.innerHTML; };
  const minutes = (value) => { const [h, m] = String(value).split(":").map(Number); return h * 60 + m; };
  const time = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const snap = (mins) => Math.round(mins / 15) * 15;
  const localDateString = (date = new Date()) => {
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const style = document.createElement("style");
  style.textContent = `
    #dailyPlanner{margin:0 0 24px;border:1px solid var(--border);border-radius:18px;background:var(--surface);overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.08)}
    .dp-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.025)}
    .dp-title{display:flex;align-items:center;gap:12px}.dp-title h2{margin:0;font-size:18px}.dp-title small{display:block;opacity:.6;margin-top:3px}
    .dp-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dp-select,.dp-btn{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12px}.dp-btn{cursor:pointer}.dp-btn:hover{border-color:var(--primary)}
    .dp-save{font-size:11px;opacity:.7;min-width:72px;text-align:center}.dp-save.is-saving{color:var(--gold-light);opacity:1}.dp-save.is-saved{color:#62b77b;opacity:1}.dp-save.is-error{color:#d66;opacity:1}
    .dp-scroll{overflow:auto;padding:0 18px 18px}.dp-grid{position:relative;min-width:900px;margin-top:14px}
    .dp-hours{height:36px;margin-inline-start:92px;position:relative;border-bottom:1px solid var(--border)}.dp-hour{position:absolute;top:7px;transform:translateX(-50%);font-size:11px;opacity:.55;font-variant-numeric:tabular-nums}
    .dp-body{position:relative;min-height:380px}.dp-row{position:relative;height:86px;border-bottom:1px solid rgba(255,255,255,.055)}.dp-row-label{position:absolute;inset-inline-start:0;top:16px;width:80px;font-size:12px;font-weight:800}.dp-row-label small{display:block;font-weight:400;opacity:.55;margin-top:4px}.dp-track{position:absolute;inset-inline-start:92px;inset-inline-end:0;top:0;bottom:0;background-image:repeating-linear-gradient(to right,transparent 0,transparent calc(3.125% - 1px),rgba(255,255,255,.045) calc(3.125% - 1px),rgba(255,255,255,.045) 3.125%)}
    .dp-card{position:absolute;top:9px;height:68px;border:1px solid var(--gold-light);border-radius:11px;background:linear-gradient(135deg,rgba(212,175,55,.20),rgba(255,255,255,.045));padding:9px 13px;box-sizing:border-box;cursor:grab;overflow:hidden;min-width:45px;user-select:none;box-shadow:0 8px 22px rgba(0,0,0,.12)}
    .dp-card:active{cursor:grabbing}.dp-card:hover{z-index:5;box-shadow:0 10px 28px rgba(0,0,0,.2)}.dp-card.is-saving{opacity:.65}.dp-card.is-conflict{border-color:#d66;background:rgba(160,40,40,.12)}
    .dp-card strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dp-card span{display:block;font-size:11px;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px}.dp-card time{position:absolute;bottom:7px;inset-inline-end:9px;font-size:10px;opacity:.55;direction:ltr}
    .dp-resize{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize}.dp-resize.start{inset-inline-start:0}.dp-resize.end{inset-inline-end:0}.dp-resize::after{content:"";position:absolute;top:23px;width:2px;height:22px;border-radius:2px;background:currentColor;opacity:.45;inset-inline-start:3px}
    .dp-empty{padding:28px;text-align:center;opacity:.55}.dp-legend{display:flex;align-items:center;gap:14px;padding:10px 18px;border-top:1px solid var(--border);font-size:11px;opacity:.65}.dp-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-inline-end:5px}.dp-dot.gold{background:var(--gold-light)}.dp-dot.gray{background:#777}.dp-dot.red{background:#c66}
    .dp-context{position:fixed;z-index:9999;min-width:180px;padding:6px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:0 18px 50px rgba(0,0,0,.28);display:none}.dp-context button{display:block;width:100%;border:0;background:transparent;color:var(--text);padding:9px 11px;text-align:right;border-radius:8px;font-family:inherit;cursor:pointer}.dp-context button:hover{background:rgba(212,175,55,.1)}.dp-context .danger{color:#d77}
    @media(max-width:700px){.dp-head{align-items:flex-start;flex-direction:column}.dp-controls{width:100%}.dp-select{flex:1}.dp-save{margin-inline-start:auto}}
  `;
  document.head.appendChild(style);

  const planner = document.createElement("section");
  planner.id = "dailyPlanner";
  planner.dir = "rtl";
  planner.innerHTML = `
    <header class="dp-head">
      <div class="dp-title"><div><h2>برنامه‌ریزی روزانه</h2><small>Timeline پانزده‌دقیقه‌ای · جابه‌جایی و تغییر طول کارت‌ها</small></div></div>
      <div class="dp-controls"><select id="dpInstructor" class="dp-select" aria-label="مدرس"><option value="all">همه مدرسان</option></select><span id="dpSave" class="dp-save">در حال آماده‌سازی</span></div>
    </header>
    <div class="dp-scroll"><div id="dpGrid" class="dp-grid"></div></div>
    <div class="dp-legend"><span><i class="dp-dot gold"></i>برنامه ثبت‌شده</span><span><i class="dp-dot gray"></i>شبکه ۱۵ دقیقه‌ای</span><span><i class="dp-dot red"></i>تداخل زمانی</span></div>
  `;
  summary.insertAdjacentElement("afterend", planner);

  const menu = document.createElement("div");
  menu.className = "dp-context";
  menu.innerHTML = `<button data-status="present">حضور</button><button data-status="excused">مرخصی</button><button data-status="absent">غیبت</button><button data-status="withdrawn" class="danger">انصراف</button>`;
  document.body.appendChild(menu);
  let contextStudent = null;

  function setSave(text, cls = "") { const el = document.querySelector("#dpSave"); if (!el) return; el.textContent = text; el.className = `dp-save ${cls}`; }
  function readLocal() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY + state.date) || "null"); } catch { return null; } }
  function writeLocal() { try { localStorage.setItem(STORAGE_KEY + state.date, JSON.stringify(state.sessions.map(s => ({ id:s.id,startTime:s.startTime,endTime:s.endTime })))); } catch {} }

  function range() {
    const starts = state.sessions.map(s => minutes(s.startTime));
    const ends = state.sessions.map(s => minutes(s.endTime));
    const min = Math.min(16 * 60, starts.length ? Math.min(...starts) - 30 : 16 * 60);
    const max = Math.max(22 * 60, ends.length ? Math.max(...ends) + 30 : 22 * 60);
    return { start: Math.floor(min / 60) * 60, end: Math.ceil(max / 60) * 60 };
  }

  function instructors() {
    const values = [...new Map(state.sessions.map(s => [s.instructor_id, s.instructor_name || `مدرس ${s.instructor_id}`])).entries()];
    const select = document.querySelector("#dpInstructor");
    const current = state.instructor;
    select.innerHTML = `<option value="all">همه مدرسان</option>` + values.map(([id,name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    select.value = values.some(([id]) => String(id) === String(current)) ? current : "all";
  }

  function filtered() { return state.instructor === "all" ? state.sessions : state.sessions.filter(s => String(s.instructor_id) === String(state.instructor)); }

  function hasConflict(item, all) {
    const a = minutes(item.startTime), b = minutes(item.endTime);
    return all.some(other => other.id !== item.id && other.instructor_id === item.instructor_id &&
      (item.room_id == null || other.room_id == null || item.room_id === other.room_id) &&
      minutes(other.startTime) < b && minutes(other.endTime) > a);
  }

  function render() {
    const grid = document.querySelector("#dpGrid");
    const items = filtered();
    const { start, end } = range();
    const total = end - start;
    const hours = [];
    for (let m = start; m <= end; m += 60) hours.push(`<span class="dp-hour" style="left:${((m-start)/total)*100}%">${time(m)}</span>`);
    const grouped = new Map();
    for (const item of items) { const key = `${item.instructor_id}`; if (!grouped.has(key)) grouped.set(key, { name:item.instructor_name || "مدرس", room:item.room_name || "اتاق آزاد", items:[] }); grouped.get(key).items.push(item); }
    const rows = [...grouped.entries()];
    grid.innerHTML = `<div class="dp-hours">${hours.join("")}</div><div class="dp-body">${rows.length ? rows.map(([key,row]) => {
      const cards = row.items.map(item => {
        const left = ((minutes(item.startTime)-start)/total)*100;
        const width = ((minutes(item.endTime)-minutes(item.startTime))/total)*100;
        const conflict = hasConflict(item, items);
        return `<article class="dp-card ${conflict ? "is-conflict" : ""}" draggable="true" data-session-id="${item.id}" style="left:${left}%;width:${width}%" title="کلیک راست: وضعیت هنرجو">
          <strong>${esc(item.student_names || item.class_title || "بدون هنرجو")}</strong>
          <span>${esc(item.course_names || item.class_title || "جلسه")} · ${esc(item.room_name || "اتاق")}</span>
          <time>${esc(item.startTime)}–${esc(item.endTime)}</time>
          <i class="dp-resize start" data-resize="start"></i><i class="dp-resize end" data-resize="end"></i>
        </article>`;
      }).join("");
      return `<div class="dp-row"><div class="dp-row-label">${esc(row.name)}<small>${esc(row.room)}</small></div><div class="dp-track">${cards}</div></div>`;
    }).join("") : `<div class="dp-empty">برای این روز جلسه زمان‌بندی‌شده‌ای پیدا نشد.</div>`}</div>`;
    bindCards();
  }

  async function saveSession(item, oldStart, oldEnd) {
    state.saving++;
    setSave("در حال ذخیره…", "is-saving");
    const card = document.querySelector(`[data-session-id="${item.id}"]`);
    card?.classList.add("is-saving");
    try {
      const response = await fetch("/api/admin/daily-planner", { method:"PATCH", credentials:"same-origin", headers:{"content-type":"application/json","accept":"application/json"}, body:JSON.stringify({sessionId:item.id,sessionDate:state.date,startTime:item.startTime,endTime:item.endTime}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "ذخیره ناموفق بود");
      writeLocal();
      setSave("ذخیره شد", "is-saved");
    } catch (error) {
      item.startTime = oldStart; item.endTime = oldEnd;
      setSave(error instanceof Error ? error.message : "ذخیره ناموفق بود", "is-error");
      render();
    } finally {
      state.saving = Math.max(0, state.saving - 1);
      if (!state.saving) setTimeout(() => setSave("ذخیره خودکار"), 1600);
    }
  }

  function getItem(id) { return state.sessions.find(s => String(s.id) === String(id)); }
  function updateFromPointer(event, card, mode) {
    const item = getItem(card.dataset.sessionId); if (!item) return;
    const track = card.parentElement; const rect = track.getBoundingClientRect();
    const { start, end } = range();
    const raw = start + ((event.clientX - rect.left) / rect.width) * (end - start);
    const value = Math.max(start, Math.min(end, snap(raw)));
    if (mode === "move") {
      const duration = minutes(item.endTime) - minutes(item.startTime);
      const nextStart = Math.max(start, Math.min(end-duration, value));
      item.startTime = time(nextStart); item.endTime = time(nextStart + duration);
    } else if (mode === "start") {
      const next = Math.max(start, Math.min(minutes(item.endTime)-15, value)); item.startTime = time(next);
    } else {
      const next = Math.max(minutes(item.startTime)+15, Math.min(end, value)); item.endTime = time(next);
    }
    render();
  }

  function bindCards() {
    document.querySelectorAll(".dp-card").forEach(card => {
      let mode = null; let oldStart = ""; let oldEnd = ""; let moved = false;
      card.addEventListener("pointerdown", e => {
        const item = getItem(card.dataset.sessionId); if (!item) return;
        mode = e.target.closest(".dp-resize")?.dataset.resize || "move";
        oldStart = item.startTime; oldEnd = item.endTime; moved = false;
        card.setPointerCapture?.(e.pointerId);
      });
      card.addEventListener("pointermove", e => { if (!mode) return; moved = true; updateFromPointer(e, card, mode); });
      card.addEventListener("pointerup", async () => { if (!mode) return; const item = getItem(card.dataset.sessionId); const changed = item && (item.startTime !== oldStart || item.endTime !== oldEnd); const current = mode; mode = null; if (changed) await saveSession(item, oldStart, oldEnd); if (current === "move" && !moved) return; });
      card.addEventListener("contextmenu", e => { e.preventDefault(); const item = getItem(card.dataset.sessionId); contextStudent = item?.students?.[0] || null; menu.style.display="block"; menu.style.left=`${Math.min(e.clientX,innerWidth-205)}px`; menu.style.top=`${Math.min(e.clientY,innerHeight-210)}px`; menu.dataset.sessionId=card.dataset.sessionId; });
    });
  }

  menu.addEventListener("click", async e => {
    const button = e.target.closest("button[data-status]"); if (!button) return;
    menu.style.display="none";
    const item = getItem(menu.dataset.sessionId); const student = contextStudent || item?.students?.[0];
    if (!student?.enrollmentSessionId) { setSave("این جلسه هنرجوی قابل تغییر ندارد", "is-error"); return; }
    const status = button.dataset.status;
    if (status === "withdrawn" && !confirm("انصراف این هنرجو ثبت شود؟")) return;
    try {
      const response = await fetch("/api/admin/daily-planner", { method:"POST", credentials:"same-origin", headers:{"content-type":"application/json"}, body:JSON.stringify({enrollmentSessionId:student.enrollmentSessionId,enrollmentId:student.enrollmentId,status}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "ثبت وضعیت ناموفق بود");
      setSave("وضعیت ذخیره شد", "is-saved");
      await load();
    } catch (error) { setSave(error instanceof Error ? error.message : "ثبت وضعیت ناموفق بود", "is-error"); }
  });

  document.addEventListener("click", e => { if (!menu.contains(e.target)) menu.style.display="none"; });
  document.querySelector("#dpInstructor")?.addEventListener("change", e => { state.instructor = e.target.value; render(); });

  async function load() {
    setSave("در حال بارگذاری…", "is-saving");
    try {
      const response = await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(state.date)}`, { credentials:"same-origin", headers:{accept:"application/json"} });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "دریافت برنامه ناموفق بود");
      state.sessions = (data.sessions || []).map(s => ({
        id:s.id, instructor_id:s.instructor_id, instructor_name:s.instructor_name, room_id:s.room_id, room_name:s.room_name,
        class_title:s.class_title, startTime:s.start_time, endTime:s.end_time,
        student_names:(s.students || []).map(x => x.studentName).join("، "),
        course_names:(s.students || []).map(x => x.courseName).filter(Boolean).join("، "),
        students:s.students || [],
      }));
      const local = readLocal();
      if (local?.length) for (const saved of local) { const item = getItem(saved.id); if (item) { item.startTime=saved.startTime; item.endTime=saved.endTime; } }
      instructors(); render(); setSave("ذخیره خودکار", "");
    } catch (error) {
      setSave(error instanceof Error ? error.message : "دریافت برنامه ناموفق بود", "is-error");
      document.querySelector("#dpGrid").innerHTML = `<div class="dp-empty">${esc(error instanceof Error ? error.message : "دریافت برنامه ناموفق بود")}</div>`;
    }
  }

  function updateDate(delta) {
    const [y,m,d] = state.date.split("-").map(Number); const date = new Date(y,m-1,d,12); date.setDate(date.getDate()+delta); state.date=localDateString(date);
    load();
  }
  document.querySelector("#prev")?.addEventListener("click", () => setTimeout(() => updateDate(-1), 80));
  document.querySelector("#next")?.addEventListener("click", () => setTimeout(() => updateDate(1), 80));
  document.querySelector("#today")?.addEventListener("click", () => setTimeout(() => { state.date=localDateString(); load(); }, 80));

  load();
})();
