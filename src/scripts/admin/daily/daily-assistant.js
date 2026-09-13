(() => {
  const root = document.querySelector("#dailyAssistant");
  if (!root) return;

  const form = root.querySelector("form");
  const input = root.querySelector("textarea");
  const submit = root.querySelector("button[type=submit]");
  const output = root.querySelector("[data-assistant-output]");
  const dateSource = document.querySelector("#dailyDashboardRoot");

  function currentDate() {
    const value = dateSource?.dataset?.date;
    if (value) return value;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function setBusy(busy) {
    submit.disabled = busy;
    input.disabled = busy;
    submit.textContent = busy ? "در حال بررسی…" : "پرسش از دستیار";
  }

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
        body: JSON.stringify({ date: currentDate(), question }),
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
