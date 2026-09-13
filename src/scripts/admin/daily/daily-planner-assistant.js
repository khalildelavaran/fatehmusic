(() => {
  const root = document.querySelector("#dailyDashboardRoot");
  const panel = document.querySelector("#dailyPlannerAssistant");
  if (!root || !panel) return;

  const select = panel.querySelector("[data-planner-session]");
  const loadButton = panel.querySelector("[data-planner-load]");
  const output = panel.querySelector("[data-planner-output]");
  let date = root.dataset.date || "";
  let sessions = [];

  const esc = (value) => {
    const el = document.createElement("div");
    el.textContent = String(value ?? "");
    return el.innerHTML;
  };

  async function json(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.message || "خطا در ارتباط با سرور.");
    return data;
  }

  function setOutput(html = "") {
    output.innerHTML = html;
    output.classList.toggle("is-empty", !html);
  }

  async function loadSessions() {
    date = root.dataset.date || date;
    if (!date) return;
    try {
      const response = await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(date)}`, {
        credentials: "same-origin", headers: { Accept: "application/json" },
      });
      const data = await json(response);
      sessions = (data.sessions || []).filter((item) => item.status !== "cancelled");
      select.innerHTML = sessions.length
        ? sessions.map((s) => `<option value="${Number(s.id)}">${esc(s.class_title || s.className || "کلاس")} — ${esc(s.start_time || s.startTime || "")} — ${esc(s.instructor_name || s.instructorName || "مدرس")}</option>`).join("")
        : `<option value="">جلسه‌ای برای جابه‌جایی نیست</option>`;
      loadButton.disabled = !sessions.length;
      setOutput("");
    } catch (error) {
      loadButton.disabled = true;
      setOutput(`<div class="planner-error">${esc(error.message || "دریافت جلسات ناموفق بود.")}</div>`);
    }
  }

  async function showSuggestions() {
    const sessionId = Number(select.value);
    if (!sessionId) return;
    loadButton.disabled = true;
    setOutput(`<div class="planner-loading">در حال محاسبه بهترین زمان‌های آزاد…</div>`);
    try {
      const response = await fetch(`/api/admin/daily-planner/suggestions?sessionId=${sessionId}&limit=8`, {
        credentials: "same-origin", headers: { Accept: "application/json" },
      });
      const data = await json(response);
      if (!data.candidates?.length) {
        setOutput(`<div class="planner-empty">برای این جلسه در بازه کاری تعریف‌شده زمان جایگزین مناسبی پیدا نشد.</div>`);
        return;
      }
      const session = data.session;
      output.innerHTML = `
        <div class="planner-context"><strong>${esc(session.class_name)}</strong><span>${esc(session.start_time)}–${esc(session.end_time)} · ${esc(session.instructor_name)}</span></div>
        <div class="planner-candidates">
          ${data.candidates.map((candidate, index) => `
            <article class="planner-candidate">
              <div><strong>گزینه ${index + 1}</strong><span>${esc(candidate.startTime)}–${esc(candidate.endTime)}</span><span>${candidate.roomName ? `اتاق ${esc(candidate.roomName)}` : "بدون اتاق"}</span></div>
              <div class="planner-reasons">${(candidate.reasons || []).map((reason) => `<span>${esc(reason)}</span>`).join("")}</div>
              <button type="button" data-planner-apply data-session-id="${session.id}" data-start="${esc(candidate.startTime)}" data-end="${esc(candidate.endTime)}" data-room-id="${candidate.roomId ?? ""}">تأیید و اعمال</button>
            </article>`).join("")}
        </div>`;
    } catch (error) {
      setOutput(`<div class="planner-error">${esc(error.message || "محاسبه پیشنهادها ناموفق بود.")}</div>`);
    } finally {
      loadButton.disabled = false;
    }
  }

  async function applyCandidate(button) {
    const sessionId = Number(button.dataset.sessionId);
    const startTime = button.dataset.start;
    const endTime = button.dataset.end;
    const roomId = button.dataset.roomId === "" ? null : Number(button.dataset.roomId);
    if (!sessionId || !startTime || !endTime) return;

    button.disabled = true;
    button.textContent = "در حال اعمال…";
    try {
      const response = await fetch("/api/admin/daily-planner", {
        method: "PATCH", credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sessionId, sessionDate: date, startTime, endTime, roomId }),
      });
      await json(response);
      setOutput(`<div class="planner-success">تغییر با موفقیت اعمال شد: <strong>${esc(startTime)}–${esc(endTime)}</strong>${roomId ? " · اتاق جدید" : ""}</div>`);
      await loadSessions();
      root.querySelector("#refresh")?.click();
    } catch (error) {
      button.disabled = false;
      button.textContent = "تأیید و اعمال";
      setOutput(`<div class="planner-error">${esc(error.message || "اعمال تغییر ناموفق بود.")}</div>`);
    }
  }

  loadButton.addEventListener("click", showSuggestions);
  output.addEventListener("click", (event) => {
    const button = event.target.closest("[data-planner-apply]");
    if (button) applyCandidate(button);
  });

  root.addEventListener("click", (event) => {
    const id = event.target.closest("#prev, #next, #today, #refresh")?.id;
    if (!id) return;
    window.setTimeout(() => loadSessions(), 350);
  });

  loadSessions();
})();
