const evalForm = document.querySelector("#evaluationForm");
const evalStatusEl = document.querySelector("#evaluationFormStatus");
const evaluationsBody = document.querySelector("#evaluationsBody");

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function setStatus(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("is-error", isError);
}

function formatJalali(iso) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

async function loadEvaluations() {
  const enrollmentId = evaluationsBody?.dataset.enrollmentId;
  if (!enrollmentId) return;
  const response = await fetch(`/api/admin/evaluations?enrollmentId=${encodeURIComponent(enrollmentId)}`, { credentials: "same-origin" });
  const data = await response.json();
  if (!data.success) {
    evaluationsBody.innerHTML = `<tr><td colspan="8" class="admin-table-empty">${esc(data.message || "خطا در دریافت اطلاعات")}</td></tr>`;
    return;
  }
  if (!data.evaluations.length) {
    evaluationsBody.innerHTML = `<tr><td colspan="8" class="admin-table-empty">هنوز ارزیابی‌ای ثبت نشده است.</td></tr>`;
    return;
  }
  evaluationsBody.innerHTML = data.evaluations
    .map(
      (e) => `<tr>
        <td>${formatJalali(e.createdAt)}</td>
        <td><strong>${esc(e.overall)}</strong></td>
        <td>${e.technique ?? "-"}</td>
        <td>${e.rhythm ?? "-"}</td>
        <td>${e.theory ?? "-"}</td>
        <td>${e.performance ?? "-"}</td>
        <td>${e.discipline ?? "-"}</td>
        <td>${esc(e.comment)}</td>
      </tr>`
    )
    .join("");
}

evalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = evalForm.querySelector('button[type="submit"]');
  const enrollmentId = Number(evalForm.dataset.enrollmentId);
  const data = new FormData(evalForm);
  const numOrNull = (key) => (data.get(key) ? Number(data.get(key)) : null);

  const body = {
    enrollmentId,
    technique: numOrNull("technique"),
    rhythm: numOrNull("rhythm"),
    theory: numOrNull("theory"),
    performance: numOrNull("performance"),
    discipline: numOrNull("discipline"),
    overall: Number(data.get("overall")),
    comment: String(data.get("comment") || "").trim(),
  };

  submitButton?.setAttribute("disabled", "true");
  setStatus(evalStatusEl, "در حال ثبت...");
  try {
    const response = await fetch("/api/admin/evaluations", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "ثبت ارزیابی انجام نشد.");
    setStatus(evalStatusEl, "ارزیابی با موفقیت ثبت شد.");
    evalForm.reset();
    await loadEvaluations();
  } catch (error) {
    setStatus(evalStatusEl, error.message || "خطایی رخ داد.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

loadEvaluations();
