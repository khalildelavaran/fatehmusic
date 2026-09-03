function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  if (response.status === 401) {
    location.assign("/admin/login");
    throw new Error("AUTH_REQUIRED");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "عملیات با خطا مواجه شد.");
  return data;
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
    const result = await api("/api/admin/classes", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!id && result.profile?.class?.id) {
      location.assign(`/admin/classes?id=${encodeURIComponent(result.profile.class.id)}`);
      return;
    }

    setFormStatus("تغییرات ذخیره شد.");
  } catch (error) {
    if (error.message !== "AUTH_REQUIRED") setFormStatus(error.message || "خطای شبکه هنگام ذخیره‌سازی.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});

// ---------------------------------------------------------------
// Operational class settings: delivery, room, term and schedule
// ---------------------------------------------------------------

const classId = form?.dataset.id ? Number(form.dataset.id) : null;
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function operationalMarkup() {
  return `<section class="admin-card" id="operationalSettings" style="grid-column:1/-1">
    <h2>تنظیمات عملیاتی کلاس</h2>
    <p class="admin-table-subtext">برنامه هفتگی فقط الگوی تکرارشونده است؛ جلسه واقعی هر روز به‌صورت ClassSession ثبت می‌شود.</p>

    <form id="deliveryForm" class="admin-form">
      <label>شیوه برگزاری
        <select name="deliveryMode">
          <option value="in_person">حضوری</option>
          <option value="online">آنلاین</option>
          <option value="hybrid">ترکیبی</option>
        </select>
      </label>
      <label>اتاق پیش‌فرض
        <select name="defaultRoomId"><option value="">بدون اتاق پیش‌فرض</option></select>
      </label>
      <div class="admin-form-actions"><button type="submit">ذخیره شیوه برگزاری</button><span class="admin-live-status" data-delivery-status></span></div>
    </form>

    <hr style="margin:22px 0;border:0;border-top:1px solid var(--border)" />
    <h3>چرخه آموزشی و شهریه</h3>
    <form id="termSettingsForm" class="admin-form">
      <label>نوع محاسبه
        <select name="billingType"><option value="session_based">جلسه‌ای</option><option value="monthly">ماهانه</option></select>
      </label>
      <label>تعداد جلسات هر ترم<input name="plannedSessions" type="number" min="1" placeholder="مثلاً 8 یا 10" /></label>
      <label>شهریه<input name="tuitionAmount" type="number" min="0" placeholder="مبلغ" /></label>
      <label>مهلت شهریه از شروع ترم (روز)<input name="tuitionDueDays" type="number" min="0" /></label>
      <div class="admin-form-actions"><button type="submit">ذخیره تنظیمات ترم</button><span class="admin-live-status" data-term-status></span></div>
    </form>

    <hr style="margin:22px 0;border:0;border-top:1px solid var(--border)" />
    <h3>برنامه هفتگی</h3>
    <form id="scheduleForm" class="admin-form">
      <label>روز هفته<select name="dayOfWeek">${WEEKDAYS.map((day, index) => `<option value="${index}">${day}</option>`).join("")}</select></label>
      <label>شروع<input name="startTime" type="time" required /></label>
      <label>پایان<input name="endTime" type="time" required /></label>
      <label>اتاق<select name="roomId"><option value="">اتاق پیش‌فرض کلاس</option></select></label>
      <label>از تاریخ<input name="effectiveFrom" type="date" /></label>
      <label>تا تاریخ<input name="effectiveTo" type="date" /></label>
      <div class="admin-form-actions"><button type="submit">افزودن برنامه</button><span class="admin-live-status" data-schedule-status></span></div>
    </form>
    <div id="scheduleList" style="margin-top:16px"></div>
  </section>`;
}

async function initOperationalSettings() {
  if (!classId || !form) return;
  const grid = form.closest(".admin-profile-grid");
  if (!grid || document.querySelector("#operationalSettings")) return;
  grid.insertAdjacentHTML("beforeend", operationalMarkup());

  const deliveryForm = document.querySelector("#deliveryForm");
  const termForm = document.querySelector("#termSettingsForm");
  const scheduleForm = document.querySelector("#scheduleForm");
  const roomSelects = [deliveryForm?.elements.defaultRoomId, scheduleForm?.elements.roomId].filter(Boolean);

  try {
    const [classData, roomsData, termData] = await Promise.all([
      api(`/api/admin/classes?id=${classId}`),
      api("/api/admin/rooms"),
      api(`/api/admin/class-term-settings?classId=${classId}`)
    ]);

    const classRecord = classData.profile?.class;
    const rooms = roomsData.rooms ?? [];
    for (const select of roomSelects) {
      const initial = select.innerHTML;
      select.innerHTML = initial + rooms.map((room) => `<option value="${room.id}">${escapeHtml(room.name)} (${room.capacity})</option>`).join("");
    }

    if (classRecord) {
      deliveryForm.elements.deliveryMode.value = classRecord.deliveryMode || "in_person";
      deliveryForm.elements.defaultRoomId.value = classRecord.defaultRoomId == null ? "" : String(classRecord.defaultRoomId);
    }

    const settings = termData.settings;
    if (settings) {
      termForm.elements.billingType.value = settings.billingType;
      termForm.elements.plannedSessions.value = settings.plannedSessions ?? "";
      termForm.elements.tuitionAmount.value = settings.tuitionAmount ?? "";
      termForm.elements.tuitionDueDays.value = settings.tuitionDueDays ?? "";
    }
    togglePlannedSessions();
    await loadSchedules();
  } catch (error) {
    const target = document.querySelector("[data-schedule-status]");
    if (target && error.message !== "AUTH_REQUIRED") {
      target.textContent = error.message;
      target.classList.add("is-error");
    }
  }

  function togglePlannedSessions() {
    const monthly = termForm.elements.billingType.value === "monthly";
    termForm.elements.plannedSessions.disabled = monthly;
    if (monthly) termForm.elements.plannedSessions.value = "";
  }

  termForm?.elements.billingType.addEventListener("change", togglePlannedSessions);

  deliveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = deliveryForm.querySelector("[data-delivery-status]");
    status.textContent = "در حال ذخیره...";
    status.classList.remove("is-error");
    try {
      await api("/api/admin/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: classId,
          deliveryMode: deliveryForm.elements.deliveryMode.value,
          defaultRoomId: deliveryForm.elements.defaultRoomId.value ? Number(deliveryForm.elements.defaultRoomId.value) : null
        })
      });
      status.textContent = "ذخیره شد.";
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }
  });

  termForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = termForm.querySelector("[data-term-status]");
    status.textContent = "در حال ذخیره...";
    status.classList.remove("is-error");
    const billingType = termForm.elements.billingType.value;
    try {
      await api("/api/admin/class-term-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          billingType,
          plannedSessions: billingType === "monthly" || !termForm.elements.plannedSessions.value ? null : Number(termForm.elements.plannedSessions.value),
          tuitionAmount: termForm.elements.tuitionAmount.value === "" ? null : Number(termForm.elements.tuitionAmount.value),
          tuitionDueDays: termForm.elements.tuitionDueDays.value === "" ? null : Number(termForm.elements.tuitionDueDays.value)
        })
      });
      status.textContent = "ذخیره شد؛ ترم‌های جدید از این تنظیمات snapshot می‌گیرند.";
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }
  });

  scheduleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = scheduleForm.querySelector("[data-schedule-status]");
    status.textContent = "در حال ثبت...";
    status.classList.remove("is-error");
    try {
      await api("/api/admin/class-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          dayOfWeek: Number(scheduleForm.elements.dayOfWeek.value),
          startTime: scheduleForm.elements.startTime.value,
          endTime: scheduleForm.elements.endTime.value,
          roomId: scheduleForm.elements.roomId.value ? Number(scheduleForm.elements.roomId.value) : null,
          effectiveFrom: scheduleForm.elements.effectiveFrom.value || null,
          effectiveTo: scheduleForm.elements.effectiveTo.value || null
        })
      });
      status.textContent = "برنامه اضافه شد.";
      scheduleForm.elements.startTime.value = "";
      scheduleForm.elements.endTime.value = "";
      await loadSchedules();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    }
  });

  document.querySelector("#scheduleList")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-schedule-id]");
    if (!button) return;
    button.disabled = true;
    try {
      await api("/api/admin/class-schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(button.dataset.scheduleId), action: "deactivate" })
      });
      await loadSchedules();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  });

  async function loadSchedules() {
    const list = document.querySelector("#scheduleList");
    if (!list) return;
    const data = await api(`/api/admin/class-schedules?classId=${classId}`);
    const schedules = (data.schedules ?? []).filter((item) => item.status === "active");
    list.innerHTML = schedules.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>روز</th><th>ساعت</th><th>بازه اعتبار</th><th></th></tr></thead><tbody>${schedules.map((item) => `<tr><td>${WEEKDAYS[item.dayOfWeek] ?? item.dayOfWeek}</td><td dir="ltr">${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</td><td>${escapeHtml(item.effectiveFrom || "—")} تا ${escapeHtml(item.effectiveTo || "—")}</td><td><button type="button" class="admin-withdraw-btn" data-schedule-id="${item.id}">غیرفعال</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="admin-table-subtext">هنوز برنامه هفتگی فعالی ثبت نشده است.</p>`;
  }
}

initOperationalSettings();

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
  const data = await api(`/api/admin/students?${params.toString()}`);
  if (!data.students?.length) {
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
  enrollDebounce = setTimeout(() => searchStudents(enrollSearch.value.trim(), classId).catch(() => {}), 350);
});

enrollResults?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const studentId = Number(target.dataset.studentId);
  const classId = Number(target.dataset.classId);
  target.setAttribute("disabled", "true");
  if (enrollStatus) enrollStatus.textContent = "در حال افزودن...";

  try {
    await api("/api/admin/class-students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, studentId })
    });
    location.reload();
  } catch (error) {
    if (enrollStatus) {
      enrollStatus.textContent = error.message || "افزودن هنرجو با خطا مواجه شد.";
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
    await api("/api/admin/class-students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, studentId, status: "withdrawn" })
    });
    location.reload();
  } catch (error) {
    alert(error.message || "ثبت انصراف با خطا مواجه شد.");
    target.removeAttribute("disabled");
  }
});
