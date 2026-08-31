function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

// ---------------------------------------------------------------
// Edit / create form
// ---------------------------------------------------------------

const form = document.querySelector("#classForm");
const formStatus = document.querySelector("#classFormStatus");

function setFormStatus(text, isError = false) {
  if (!formStatus) return;
  formStatus.textContent = text;
  formStatus.classList.toggle("is-error", isError);
}

function collectFormBody(form) {
  const data = new FormData(form);
  const body = {
    title: String(data.get("title") || "").trim(),
    classType: String(data.get("classType") || "individual"),
    capacity: Number(data.get("capacity")) || 1,
    room: String(data.get("room") || "").trim(),
    level: String(data.get("level") || "").trim(),
    startDate: data.get("startDate") ? String(data.get("startDate")) : null,
    endDate: data.get("endDate") ? String(data.get("endDate")) : null,
    notes: String(data.get("notes") || "").trim()
  };

  if (data.get("courseId")) body.courseId = Number(data.get("courseId"));
  if (data.get("instructorId")) body.instructorId = Number(data.get("instructorId"));
  if (data.get("status")) body.status = String(data.get("status"));

  return body;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const id = form.dataset.id ? Number(form.dataset.id) : null;
  const body = id ? { id, ...collectFormBody(form) } : collectFormBody(form);

  submitButton?.setAttribute("disabled", "true");
  setFormStatus(id ? "در حال ذخیره..." : "در حال ثبت...");

  try {
    const response = await fetch("/api/admin/classes", {
      method: id ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const result = await response.json();
    if (!result.success) {
      setFormStatus(result.message || "ذخیره‌سازی با خطا مواجه شد.", true);
      return;
    }

    if (!id && result.profile?.class?.id) {
      location.assign(`/admin/classes?id=${encodeURIComponent(result.profile.class.id)}`);
      return;
    }

    setFormStatus("تغییرات ذخیره شد.");
  } catch {
    setFormStatus("خطای شبکه هنگام ذخیره‌سازی.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

// ---------------------------------------------------------------
// Enroll-student search widget
// ---------------------------------------------------------------

const enrollSearch = document.querySelector("#enrollStudentSearch");
const enrollResults = document.querySelector("#enrollStudentResults");
const enrollStatus = document.querySelector("#enrollStatus");
let enrollDebounce = null;

async function searchStudents(query, classId) {
  if (!enrollResults) return;
  if (!query) {
    enrollResults.innerHTML = "";
    return;
  }

  const params = new URLSearchParams({ search: query, pageSize: "5" });
  const response = await fetch(`/api/admin/students?${params.toString()}`, { credentials: "same-origin" });
  if (response.status === 401) {
    location.assign("/admin/login");
    return;
  }

  const data = await response.json();
  if (!data.success || data.students.length === 0) {
    enrollResults.innerHTML = `<p class="admin-table-subtext">نتیجه‌ای یافت نشد.</p>`;
    return;
  }

  enrollResults.innerHTML = data.students
    .map((s) => {
      const name = `${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}`.trim() || "(بدون نام)";
      return `<div class="admin-enroll-result">
        <span>${name} <span dir="ltr" class="admin-table-subtext">${escapeHtml(s.nationalCode)}</span></span>
        <button type="button" data-student-id="${s.id}" data-class-id="${classId}">افزودن</button>
      </div>`;
    })
    .join("");
}

enrollSearch?.addEventListener("input", () => {
  clearTimeout(enrollDebounce);
  const classId = enrollSearch.dataset.classId;
  enrollDebounce = setTimeout(() => searchStudents(enrollSearch.value.trim(), classId), 350);
});

enrollResults?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const studentId = Number(target.dataset.studentId);
  const classId = Number(target.dataset.classId);
  target.setAttribute("disabled", "true");
  if (enrollStatus) enrollStatus.textContent = "در حال افزودن...";

  try {
    const response = await fetch("/api/admin/class-students", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, studentId })
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const result = await response.json();
    if (!result.success) {
      if (enrollStatus) {
        enrollStatus.textContent = result.message || "افزودن هنرجو با خطا مواجه شد.";
        enrollStatus.classList.add("is-error");
      }
      target.removeAttribute("disabled");
      return;
    }

    location.reload();
  } catch {
    if (enrollStatus) {
      enrollStatus.textContent = "خطای شبکه هنگام افزودن هنرجو.";
      enrollStatus.classList.add("is-error");
    }
    target.removeAttribute("disabled");
  }
});

// ---------------------------------------------------------------
// Withdraw buttons on the enrolled-students table
// ---------------------------------------------------------------

const studentsBody = document.querySelector("#classStudentsBody");

studentsBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.classList.contains("admin-withdraw-btn")) return;

  if (!confirm("انصراف این هنرجو از کلاس ثبت شود؟")) return;

  const classId = Number(studentsBody.dataset.classId);
  const studentId = Number(target.dataset.studentId);
  target.setAttribute("disabled", "true");

  try {
    const response = await fetch("/api/admin/class-students", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, studentId, status: "withdrawn" })
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const result = await response.json();
    if (!result.success) {
      alert(result.message || "ثبت انصراف با خطا مواجه شد.");
      target.removeAttribute("disabled");
      return;
    }

    location.reload();
  } catch {
    alert("خطای شبکه هنگام ثبت انصراف.");
    target.removeAttribute("disabled");
  }
});
