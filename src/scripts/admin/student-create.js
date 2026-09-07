const form = document.querySelector("#studentCreateForm");
const statusEl = document.querySelector("#studentCreateStatus");
const DAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

function addSelectField(name, labelText) {
  const wrapper = document.createElement("label");
  wrapper.dataset.studentEnrollmentField = name;
  const label = document.createTextNode(labelText);
  const select = document.createElement("select");
  select.name = name;
  select.required = true;
  wrapper.append(label, select);
  const statusLabel = form.querySelector('label:has(select[name="status"])');
  form.insertBefore(wrapper, statusLabel || form.firstElementChild);
  return select;
}

let courseSelect;
let instructorSelect;
let daySelect;
let classId = null;
let classOptions = [];

function option(select, value, text, disabled = false) {
  const item = document.createElement("option");
  item.value = String(value);
  item.textContent = text;
  item.disabled = disabled;
  select.appendChild(item);
}

function uniqueBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const value = String(item[key] ?? "");
    if (value && !map.has(value)) map.set(value, item);
  }
  return [...map.values()];
}

function populateCourses() {
  courseSelect.replaceChildren();
  option(courseSelect, "", "انتخاب دوره...", true);
  for (const item of uniqueBy(classOptions, "courseId")) {
    option(courseSelect, item.courseId, item.courseTitle);
  }
  courseSelect.value = "";
  populateInstructors();
}

function populateInstructors() {
  instructorSelect.replaceChildren();
  option(instructorSelect, "", "ابتدا دوره را انتخاب کنید...", true);
  const courseId = Number(courseSelect.value);
  if (!courseId) {
    instructorSelect.value = "";
    populateDays();
    return;
  }
  const filtered = classOptions.filter((item) => Number(item.courseId) === courseId);
  for (const item of uniqueBy(filtered, "instructorId")) {
    option(instructorSelect, item.instructorId, item.instructorName);
  }
  instructorSelect.value = "";
  populateDays();
}

function populateDays() {
  daySelect.replaceChildren();
  option(daySelect, "", "ابتدا استاد را انتخاب کنید...", true);
  classId = null;
  const courseId = Number(courseSelect.value);
  const instructorId = Number(instructorSelect.value);
  if (!courseId || !instructorId) return;

  const schedules = [];
  for (const item of classOptions.filter((row) => Number(row.courseId) === courseId && Number(row.instructorId) === instructorId)) {
    for (const schedule of item.schedules || []) {
      if (schedule.status !== "inactive") schedules.push({ ...schedule, classId: item.id });
    }
  }

  const seen = new Set();
  for (const schedule of schedules) {
    const key = `${schedule.classId}-${schedule.dayOfWeek}-${schedule.startTime}-${schedule.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = `${DAYS_FA[Number(schedule.dayOfWeek)] ?? "روز نامشخص"} — ${schedule.startTime} تا ${schedule.endTime}`;
    option(daySelect, key, text);
  }

  if (!schedules.length) option(daySelect, "", "برای این استاد و دوره برنامه‌ای ثبت نشده است.", true);
  daySelect.dataset.scheduleMap = JSON.stringify(schedules.map((item) => ({
    key: `${item.classId}-${item.dayOfWeek}-${item.startTime}-${item.endTime}`,
    classId: item.classId
  })));
}

function resolveClassId() {
  const map = JSON.parse(daySelect.dataset.scheduleMap || "[]");
  const match = map.find((item) => item.key === daySelect.value);
  classId = match ? Number(match.classId) : null;
  return classId;
}

async function loadEnrollmentOptions() {
  try {
    const response = await fetch("/api/admin/classes?status=active&page=1&pageSize=100", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "دریافت کلاس‌ها ناموفق بود.");
    classOptions = Array.isArray(result.classes) ? result.classes : [];
    populateCourses();
    if (!classOptions.length) setStatus("هیچ کلاس فعالی برای انتخاب دوره و استاد وجود ندارد.", true);
  } catch (error) {
    console.error("[admin/students] enrollment options failed", error);
    setStatus("فهرست دوره‌ها و برنامه کلاس‌ها دریافت نشد. ابتدا کلاس‌های فعال را بررسی کنید.", true);
    courseSelect.disabled = true;
    instructorSelect.disabled = true;
    daySelect.disabled = true;
  }
}

if (form) {
  courseSelect = addSelectField("courseId", "دوره");
  instructorSelect = addSelectField("instructorId", "استاد");
  daySelect = addSelectField("scheduleKey", "روز و ساعت کلاس");

  courseSelect.addEventListener("change", populateInstructors);
  instructorSelect.addEventListener("change", populateDays);
  daySelect.addEventListener("change", resolveClassId);
  loadEnrollmentOptions();
}

function collectBody(form) {
  const data = new FormData(form);
  const rawBirthYear = data.get("birthYear") ? Number(data.get("birthYear")) : null;
  const selectedClassId = resolveClassId();
  if (!selectedClassId) throw new Error("دوره، استاد و روز کلاس را انتخاب کنید.");
  return {
    nationalCode: String(data.get("nationalCode") || "").trim(),
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    fatherName: String(data.get("fatherName") || "").trim(),
    birthYear: Number.isFinite(rawBirthYear) ? rawBirthYear : null,
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    occupation: String(data.get("occupation") || "").trim(),
    idIssuePlace: String(data.get("idIssuePlace") || "").trim(),
    emergencyContact: String(data.get("emergencyContact") || "").trim(),
    status: String(data.get("status") || "active"),
    address: String(data.get("address") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
    classId: selectedClassId
  };
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  let body;
  try {
    body = collectBody(form);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "دوره، استاد و روز کلاس را انتخاب کنید.", true);
    return;
  }

  submitButton?.setAttribute("disabled", "true");
  setStatus("در حال ثبت...");

  try {
    const response = await fetch("/api/admin/students", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const result = await response.json().catch(() => ({ success: false, message: "پاسخ نامعتبر از سرور." }));

    if (!response.ok || !result.success) {
      setStatus(result.message || `ثبت هنرجو انجام نشد (${response.status}).`, true);
      return;
    }

    if (result.profile?.student?.id) {
      location.assign(`/admin/students?id=${encodeURIComponent(result.profile.student.id)}`);
      return;
    }

    setStatus("هنرجو با موفقیت ثبت شد.");
    form.reset();
  } catch (error) {
    console.error("[admin/students] create failed", error);
    setStatus(error instanceof Error ? error.message : "ارتباط با سرور برقرار نشد.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
