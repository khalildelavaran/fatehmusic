const evalForm = document.querySelector("#evaluationForm");
const evalStatusEl = document.querySelector("#evaluationFormStatus");
const assignForm = document.querySelector("#assignmentForm");
const assignStatusEl = document.querySelector("#assignmentFormStatus");
const evaluationsBody = document.querySelector("#evaluationsBody");
const assignmentsBody = document.querySelector("#assignmentsBody");

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ASSIGNMENT_STATUS_LABELS = { assigned: "محول‌شده", in_progress: "در حال انجام", completed: "انجام‌شده", reviewed: "بررسی‌شده" };

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

async function loadAssignments() {
  const enrollmentId = assignmentsBody?.dataset.enrollmentId;
  if (!enrollmentId) return;
  const response = await fetch(`/api/admin/assignments?enrollmentId=${encodeURIComponent(enrollmentId)}`, { credentials: "same-origin" });
  const data = await response.json();
  if (!data.success) {
    assignmentsBody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${esc(data.message || "خطا در دریافت اطلاعات")}</td></tr>`;
    return;
  }
  if (!data.assignments.length) {
    assignmentsBody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">هنوز تمرینی ثبت نشده است.</td></tr>`;
    return;
  }
  assignmentsBody.innerHTML = data.assignments
    .map(
      (a) => `<tr>
        <td>${esc(a.title)}</td>
        <td>${a.dueDate ? formatJalali(a.dueDate) : "-"}</td>
        <td><span class="admin-status-pill" data-status="${esc(a.status)}">${esc(ASSIGNMENT_STATUS_LABELS[a.status] || a.status)}</span></td>
        <td>${esc(a.studentComment)}</td>
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

assignForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = assignForm.querySelector('button[type="submit"]');
  const enrollmentId = Number(assignForm.dataset.enrollmentId);
  const data = new FormData(assignForm);

  const body = {
    enrollmentId,
    title: String(data.get("title") || "").trim(),
    description: String(data.get("description") || "").trim(),
    dueDate: data.get("dueDate") ? String(data.get("dueDate")) : null,
  };

  submitButton?.setAttribute("disabled", "true");
  setStatus(assignStatusEl, "در حال ثبت...");
  try {
    const response = await fetch("/api/admin/assignments", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "ثبت تمرین انجام نشد.");
    setStatus(assignStatusEl, "تمرین با موفقیت ثبت شد.");
    assignForm.reset();
    await loadAssignments();
  } catch (error) {
    setStatus(assignStatusEl, error.message || "خطایی رخ داد.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

loadEvaluations();
loadAssignments();
