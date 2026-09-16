(() => {
  if (location.pathname !== "/admin/daily") return;
  const root = document.querySelector("#dailyDashboardRoot");
  const summary = document.querySelector("#summary");
  if (!root || !summary) return;

  let date = new Date().toLocaleDateString("en-CA");
  let lastMetrics = null;
  let lastCommand = null;

  const esc = (value) => {
    const el = document.createElement("div");
    el.textContent = String(value ?? "");
    return el.innerHTML;
  };
  const num = (value) => Number(value ?? 0).toLocaleString("fa-IR");
  const ids = (value) => new Set((Array.isArray(value) ? value : []).map((id) => String(id)));

  async function getJson(url) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || `خطا (${response.status})`);
    return data;
  }

  function renderAuthoritativeSummary() {
    if (!lastMetrics) return;
    const sessions = lastCommand?.sessions || [];
    const active = sessions.filter((session) => session.status !== "cancelled").length;
    const cancelled = sessions.filter((session) => session.status === "cancelled").length;
    const unique = Number(lastMetrics.unique_students ?? 0);
    const present = Number(lastMetrics.unique_present_students ?? 0);
    const pending = Number(lastMetrics.unique_pending_students ?? 0);
    summary.querySelectorAll(".dd-authoritative-kpi").forEach((node) => node.remove());
    const box = document.createElement("div");
    box.className = "dd-authoritative-kpi";
    box.innerHTML = `
      <div class="dd-stat"><strong>${num(active)}</strong><span>جلسه امروز${cancelled ? ` (${num(cancelled)} لغو شده)` : ""}</span></div>
      <div class="dd-stat"><strong>${num(unique)}</strong><span>هنرجوی یکتا</span></div>
      <div class="dd-stat"><strong>${num(present)} / ${num(unique)}</strong><span>حضور ثبت‌شده یکتا${pending ? ` — ${num(pending)} در انتظار` : ""}</span></div>`;
    summary.innerHTML = box.innerHTML;
  }

  function decorateConflicts() {
    const instructor = ids(lastCommand?.instructor_conflict_session_ids);
    const room = ids(lastCommand?.room_conflict_session_ids);
    document.querySelectorAll("#timeline [data-session-id], #sessionsPanel [data-session-id]").forEach((node) => {
      const id = String(node.dataset.sessionId || "");
      node.querySelectorAll("[data-authoritative-conflict]").forEach((badge) => badge.remove());
      const badges = [];
      if (instructor.has(id)) badges.push("<span class=\"dd-session-tag conflict-instructor\">تداخل مدرس</span>");
      if (room.has(id)) badges.push("<span class=\"dd-session-tag conflict-room\">تداخل اتاق</span>");
      if (!badges.length) return;
      const wrap = document.createElement("div");
      wrap.dataset.authoritativeConflict = "1";
      wrap.className = "dcc-conflict-badges";
      wrap.innerHTML = badges.join("");
      node.querySelector(".dd-session-head-main")?.append(wrap);
    });
  }

  async function load() {
    try {
      const [dashboard, command] = await Promise.all([
        getJson(`/api/admin/daily-dashboard?date=${encodeURIComponent(date)}`),
        getJson(`/api/admin/daily-command-center?date=${encodeURIComponent(date)}`),
      ]);
      lastMetrics = dashboard.metrics || command.metrics || null;
      lastCommand = command;
      renderAuthoritativeSummary();
      decorateConflicts();
    } catch (error) {
      console.warn("[daily-authoritative-overrides]", error);
    }
  }

  document.querySelectorAll("#prev,#next,#today,#refresh").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.id === "today") date = new Date().toLocaleDateString("en-CA");
      else if (button.id === "prev" || button.id === "next") {
        const value = new Date(`${date}T12:00:00`);
        value.setDate(value.getDate() + (button.id === "prev" ? -1 : 1));
        date = value.toLocaleDateString("en-CA");
      }
      setTimeout(load, 900);
    });
  });

  setTimeout(load, 1200);
  setInterval(decorateConflicts, 2500);
})();
