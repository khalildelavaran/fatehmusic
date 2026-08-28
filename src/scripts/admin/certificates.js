const searchInput = document.querySelector("#studentSearch");
const resultsBox = document.querySelector("#searchResults");
const formSection = document.querySelector("#certFormSection");
const selectedSummary = document.querySelector("#selectedSummary");
const certForm = document.querySelector("#certForm");
const certStatus = document.querySelector("#certStatus");
const cancelBtn = document.querySelector("#cancelSelection");
const generateBtn = document.querySelector("#generateBtn");
const bookSelect = document.querySelector("#bookId");
const registrationIdField = document.querySelector("#registrationId");

let allRegistrations = [];
let selected = null;

function setStatus(text, isError = false) {
  certStatus.textContent = text;
  certStatus.className = "admin-ai-status" + (text ? (isError ? " is-error" : " is-success") : "");
}

async function loadRegistrations() {
  const response = await fetch("/api/admin/registrations", { credentials: "same-origin" });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (data.success) allRegistrations = data.registrations;
}

function renderResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) { resultsBox.innerHTML = ""; return; }
  const matches = allRegistrations
    .filter((r) =>
      `${r.student_first_name} ${r.student_last_name}`.toLowerCase().includes(q) ||
      (r.tracking_code ?? "").toLowerCase().includes(q)
    )
    .slice(0, 15);

  if (matches.length === 0) {
    resultsBox.innerHTML = `<div class="admin-cert-result-empty">موردی پیدا نشد.</div>`;
    return;
  }
  resultsBox.innerHTML = matches
    .map(
      (r) => `
    <button type="button" class="admin-cert-result" data-id="${r.id}">
      <strong>${r.student_first_name} ${r.student_last_name}</strong>
      <span>${r.instrument_title} — ${r.tracking_code}</span>
    </button>`
    )
    .join("");
}

async function selectRegistration(id) {
  selected = allRegistrations.find((r) => String(r.id) === String(id));
  if (!selected) return;

  registrationIdField.value = selected.id;
  selectedSummary.innerHTML = `
    <strong>${selected.student_first_name} ${selected.student_last_name}</strong>
    <span>${selected.instrument_title} · مدرس: ${selected.instructor_name} · کد پیگیری: ${selected.tracking_code}</span>`;

  const nationalIdField = document.querySelector("#nationalId");
  const nationalIdHint = document.querySelector("#nationalIdHint");
  if (selected.student_national_code) {
    nationalIdField.value = selected.student_national_code;
    nationalIdHint.hidden = false;
    nationalIdHint.classList.remove("is-warning");
    nationalIdHint.textContent = "این کد از فرم ثبت‌نام هنرجو دریافت شد.";
  } else {
    nationalIdField.value = "";
    nationalIdHint.hidden = false;
    nationalIdHint.classList.add("is-warning");
    nationalIdHint.textContent = "کد ملی در ثبت‌نام این هنرجو ثبت نشده؛ لطفاً به‌صورت دستی وارد کنید.";
  }

  bookSelect.innerHTML = `<option value="">— بدون ذکر کتاب مشخص —</option>`;
  try {
    const response = await fetch(`/api/admin/books?course_slug=${encodeURIComponent(selected.instrument_slug)}`, { credentials: "same-origin" });
    const data = await response.json();
    if (data.success) {
      for (const book of data.books) {
        const opt = document.createElement("option");
        opt.value = book.id;
        opt.textContent = book.level ? `${book.title} (${book.level})` : book.title;
        bookSelect.appendChild(opt);
      }
    }
  } catch {
    // book list is optional -- generation still works without it
  }

  resultsBox.innerHTML = "";
  searchInput.value = "";
  formSection.hidden = false;
  setStatus("");
  formSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

searchInput.addEventListener("input", () => renderResults(searchInput.value));

resultsBox.addEventListener("click", (event) => {
  const target = event.target.closest("[data-id]");
  if (target) selectRegistration(target.dataset.id);
});

cancelBtn.addEventListener("click", () => {
  selected = null;
  formSection.hidden = true;
  certForm.reset();
  const nationalIdHint = document.querySelector("#nationalIdHint");
  nationalIdHint.hidden = true;
  nationalIdHint.classList.remove("is-warning");
  setStatus("");
});

certForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selected) return;

  const payload = {
    registration_id: Number(registrationIdField.value),
    book_id: bookSelect.value ? Number(bookSelect.value) : undefined,
    national_id: document.querySelector("#nationalId").value.trim(),
    completion_date_jalali: document.querySelector("#completionDate").value.trim(),
    level: document.querySelector("#level").value || undefined,
    curriculum_note: document.querySelector("#curriculumNote").value.trim() || undefined
  };

  generateBtn.disabled = true;
  generateBtn.textContent = "در حال تولید...";
  setStatus("");

  try {
    const response = await fetch("/api/admin/certificate-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ message: "خطای نامشخص" }));
      setStatus(errData.message || "تولید PDF شکست خورد.", true);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setStatus("PDF ساخته شد و در تب جدید باز شد.");
  } catch (err) {
    setStatus("خطای شبکه هنگام تولید PDF.", true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "تولید PDF گواهینامه";
  }
});

async function init() {
  await loadRegistrations();
  const registrationId = new URLSearchParams(window.location.search).get("registration_id");
  if (registrationId) await selectRegistration(registrationId);
}

init();
