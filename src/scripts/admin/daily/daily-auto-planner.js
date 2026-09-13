(() => {
  const root = document.querySelector("#dailyDashboardRoot");
  if (!root) return;

  const assistant = document.querySelector("#dailyAssistant");
  if (!assistant) return;

  const box = document.createElement("div");
  box.className = "daily-auto-plan-box";
  box.innerHTML = `
    <div class="daily-planner-head">
      <div>
        <strong>چینش هوشمند روز</strong>
        <span>برنامه را بر اساس سوابق زمانی هنرجویان، اتاق، استاد و وضعیت حضور بررسی می‌کند و فقط تغییرهای نیازمند تأیید را پیشنهاد می‌دهد.</span>
      </div>
      <button type="button" data-auto-plan>ساخت چینش هوشمند</button>
    </div>
    <div data-auto-plan-status class="daily-planner-status" aria-live="polite"></div>
    <div data-auto-plan-results class="daily-planner-results"></div>
  `;
  assistant.appendChild(box);

  const runButton = box.querySelector("[data-auto-plan]");
  const status = box.querySelector("[data-auto-plan-status]");
  const results = box.querySelector("[data-auto-plan-results]");

  const esc = (value) => {
    const el = document.createElement("div");
    el.textContent = String(value ?? "");
    return el.innerHTML;
  };

  const currentDate = () => {
    const label = root.querySelector("#dateLabel");
    return root.dataset.date || label?.dataset?.date || new Date().toISOString().slice(0, 10);
  };

  async function loadPlan(removeIds = []) {
    runButton.disabled = true;
    status.textContent = "در حال تحلیل برنامه، سوابق هنرجویان، اتاق‌ها و زمان‌های آزاد…";
    results.innerHTML = "";
    const params = new URLSearchParams({ date: currentDate() });
    if (removeIds.length) params.set("removeSessionIds", removeIds.join(","));

    try {
      const response = await fetch(`/api/admin/daily-planner/auto?${params}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "ساخت چینش ناموفق بود.");

      const plan = data.plan;
      status.textContent = plan.summary;
      results.innerHTML = [
        ...(plan.removedSessionIds || []).map((id) => `
          <div class="daily-planner-candidate" data-auto-removed="${esc(id)}">
            <div><strong>جلسه ${esc(id)} از بازچینی حذف شد</strong><small>وضعیت حضور نشان می‌دهد همه هنرجویان این جلسه غیبت/مرخصی دارند.</small></div>
          </div>
        `),
        ...(plan.changes || []).map((change) => `
          <div class="daily-planner-candidate" data-auto-change="${esc(change.sessionId)}">
            <div>
              <strong>${esc(change.className)} · ${esc(change.instructorName)}</strong>
              <small>${esc(change.from.startTime)}–${esc(change.from.endTime)} → ${esc(change.to.startTime)}–${esc(change.to.endTime)} · ${esc(change.to.roomName ? `اتاق ${change.to.roomName}` : "بدون اتاق")}</small>
              <small>${esc((change.reasons || []).join(" · "))}</small>
            </div>
          </div>
        `),
        ...(plan.questions || []).map((question) => `
          <div class="daily-planner-candidate">
            <div><strong>نیازمند تصمیم منشی</strong><small>${esc(question.message)}</small></div>
          </div>
        `),
      ].join("") || '<div class="daily-planner-status">چینش فعلی مناسب است و تغییری پیشنهاد نشد.</div>';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      runButton.disabled = false;
    }
  }

  runButton.addEventListener("click", () => loadPlan());

  // Expose a small hook for the attendance UI: after the receptionist marks a
  // session's students absent/excused, the dashboard can request a cascade plan.
  window.fatehDailyAutoPlanAfterRemoval = (sessionId) => loadPlan([Number(sessionId)]);
})();
