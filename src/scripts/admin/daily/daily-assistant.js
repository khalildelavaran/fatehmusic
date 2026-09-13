(() => {
  const root = document.querySelector("#dailyAssistant");
  if (!root) return;

  const form = root.querySelector("form");
  const input = root.querySelector("textarea");
  const submit = root.querySelector("button[type=submit]");
  const output = root.querySelector("[data-assistant-output]");
  const dashboard = document.querySelector("#dailyDashboardRoot");

  function localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  let selectedDate = dashboard?.dataset?.date || localDateString();
  if (dashboard) dashboard.dataset.date = selectedDate;

  function shiftDate(value, days) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return localDateString(date);
  }

  function setSelectedDate(value) {
    selectedDate = value;
    if (dashboard) dashboard.dataset.date = value;
  }

  function setBusy(busy) {
    submit.disabled = busy;
    input.disabled = busy;
    submit.textContent = busy ? "در حال بررسی…" : "پرسش از دستیار";
  }

  document.querySelector("#prev")?.addEventListener("click", () => {
    setSelectedDate(shiftDate(selectedDate, -1));
  });
  document.querySelector("#next")?.addEventListener("click", () => {
    setSelectedDate(shiftDate(selectedDate, 1));
  });
  document.querySelector("#today")?.addEventListener("click", () => {
    setSelectedDate(localDateString());
  });

  /*
   * Attendance is owned by daily-dashboard.js. We intentionally do not
   * replace or intercept that controller. After a receptionist marks a
   * student absent/excused, wait briefly for the attendance request and the
   * dashboard refresh, then ask the auto planner to recalculate the day.
   *
   * The planner itself decides whether the whole session is removable, so a
   * group class is not deleted merely because one student is absent.
   */
  dashboard?.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="attendance"]');
    if (!button) return;
    const status = button.dataset.status;
    if (status !== "absent" && status !== "excused") return;

    const sessionCard = button.closest("[data-session-id]");
    const sessionId = Number(sessionCard?.dataset.sessionId);
    if (!Number.isInteger(sessionId) || sessionId <= 0) return;

    const run = window.fatehDailyAutoPlanAfterAttendance;
    if (typeof run !== "function") return;

    window.setTimeout(() => {
      run(sessionId);
    }, 1200);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    setBusy(true);
    output.className = "daily-ai-output is-loading";
    output.textContent = "در حال بررسی برنامه روزانه…";

    try {
      const response = await fetch("/api/admin/daily-assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ date: selectedDate, question }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "پاسخ دستیار دریافت نشد.");
      output.className = "daily-ai-output";
      output.textContent = data.message;
    } catch (error) {
      output.className = "daily-ai-output is-error";
      output.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      setBusy(false);
    }
  });
})();
