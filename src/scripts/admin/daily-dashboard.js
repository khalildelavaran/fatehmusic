const localDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const state = { date: localDate() };
const $ = (selector) => document.querySelector(selector);
const labels = {
  pending: ["yellow", "ثبت نشده"],
  present: ["green", "حاضر"],
  absent: ["red", "غایب"],
  excused: ["white", "مرخصی"],
};
const teacherLabels = { pending: "ثبت نشده", present: "حاضر", absent: "غایب" };
const financialLabels = {
  none: "بدون صورتحساب",
  paid: "تسویه",
  pending: "پرداخت‌نشده",
  partial: "پرداخت ناقص",
  overdue: "سررسید گذشته",
};

function esc(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function money(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}

function showError(message) {
  const box = $("#error");
  if (!box) return;
  box.textContent = message;
  box.hidden = false;
}

function render(data) {
  const sessions = data.sessions ?? [];
  const students = sessions.flatMap((session) => session.students ?? []);
  const dateLabel = $("#dateLabel");
  if (dateLabel) dateLabel.textContent = data.date;

  const counts = { pending: 0, present: 0, absent: 0, excused: 0 };
  students.forEach((student) => {
    const status = student.attendanceStatus in counts ? student.attendanceStatus : "pending";
    counts[status] += 1;
  });

  const summary = $("#summary");
  if (summary) {
    summary.innerHTML = `<div class="stat">جلسه<strong>${sessions.length}</strong></div><div class="stat">هنرجو<strong>${students.length}</strong></div><div class="stat">غایب<strong>${counts.absent}</strong></div><div class="stat warning">ثبت‌نشده<strong>${counts.pending}</strong></div>`;
  }

  const container = $("#sessions");
  if (!container) return;

  container.innerHTML = sessions.map((session) => {
    const teacher = session.teacher_attendance_status ?? "pending";
    const cancelled = session.status === "cancelled";
    const calendar = session.calendar_exception_title
      ? `<div class="calendar-warning">تقویم: ${esc(session.calendar_exception_title)} — این هشدار به‌تنهایی جلسه را لغو نمی‌کند.</div>`
      : "";
    const cancelledBox = cancelled
      ? `<div class="cancelled-warning">این جلسه لغو شده است؛ حضورغیاب و مصرف ترم برای آن ثبت نمی‌شود.</div>`
      : "";

    const studentCards = (session.students ?? []).map((student) => {
      const [color, label] = labels[student.attendanceStatus] ?? labels.pending;
      const balance = Number(student.balance || 0);
      const finance = financialLabels[student.financialStatus] ?? student.financialStatus ?? "";
      const attendanceButtons = ["present", "absent", "excused"].map((status) =>
        `<button class="attendance-action ${status === student.attendanceStatus ? "active" : ""}" ${cancelled ? "disabled" : ""} data-enrollment="${student.enrollmentSessionId}" data-status="${status}">${labels[status][1]}</button>`
      ).join("");

      const makeupButton = !cancelled && student.attendanceStatus === "excused"
        ? `<button class="makeup-action" data-makeup-enrollment="${student.enrollmentSessionId}" data-instructor="${session.instructor_id}" data-room="${session.room_id ?? ""}" data-location="${esc(session.location_type || "in_person")}" data-start="${esc(session.start_time)}" data-end="${esc(session.end_time)}">ساخت جلسه جبرانی</button>`
        : "";
      const paymentButton = student.invoiceId && balance > 0
        ? `<button class="payment-action" data-invoice="${student.invoiceId}" data-balance="${balance}">ثبت پرداخت</button>`
        : "";
      const renewalButton = student.remainingSessions === 0
        ? `<button class="renew-action" data-renew-enrollment="${student.enrollmentId}">شروع ترم جدید</button>`
        : "";

      return `<article class="student">
        <div class="student-top"><span class="light ${color}" title="${label}"></span><span class="student-name">${esc(student.studentName)}</span></div>
        <div class="student-meta"><span>گذرانده: ${student.consumedSessions}</span><span>باقی: ${student.remainingSessions ?? "—"}</span></div>
        ${student.invoiceId ? `<div class="finance-meta">شهریه: ${esc(finance)}${balance > 0 ? ` · مانده ${money(balance)}` : ""}</div>` : ""}
        ${student.tuitionWarning ? `<div class="calendar-warning">${student.tuitionDueDate ? `هشدار شهریه: ${esc(student.tuitionDueDate)}` : "هشدار تمدید ترم"}</div>` : ""}
        <div class="attendance-actions">${attendanceButtons}</div>
        <div class="secondary-actions">${makeupButton}${paymentButton}${renewalButton}</div>
      </article>`;
    }).join("") || `<div class="empty">هنرجویی برای این جلسه ثبت نشده است.</div>`;

    return `<article class="session ${cancelled ? "cancelled" : ""}">
      <header class="session-head">
        <div class="session-title"><strong>${esc(session.class_title)}</strong><span>${esc(session.start_time)} — ${esc(session.end_time)}</span></div>
        <div class="session-meta">${esc(session.instructor_name)} · ${esc(session.room_name || "بدون اتاق")}${session.type === "makeup" ? " · جبرانی" : ""}</div>
      </header>
      ${calendar}${cancelledBox}
      <div class="teacher-row"><b>حضور استاد:</b><span>${esc(teacherLabels[teacher] || teacher)}</span><button class="teacher-action" ${cancelled ? "disabled" : ""} data-session="${session.id}" data-instructor="${session.instructor_id}" data-status="present">حاضر</button><button class="teacher-action" ${cancelled ? "disabled" : ""} data-session="${session.id}" data-instructor="${session.instructor_id}" data-status="absent">غایب</button></div>
      <div class="students">${studentCards}</div>
    </article>`;
  }).join("") || `<div class="empty">برای این روز جلسه‌ای ثبت نشده است.</div>`;
}

async function load() {
  try {
    const errorBox = $("#error");
    if (errorBox) errorBox.hidden = true;
    const response = await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(state.date)}`, { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "خطا در دریافت داشبورد");
    render(data);
  } catch (error) {
    showError(error instanceof Error ? error.message : "خطا در دریافت داشبورد");
  }
}

async function request(url, method, body) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "ثبت عملیات ناموفق بود");
  return data;
}

async function put(url, body) {
  await request(url, "PUT", body);
  await load();
}

async function createMakeup(button) {
  const date = prompt("تاریخ جلسه جبرانی (YYYY-MM-DD):", state.date);
  if (!date) return;
  const startTime = prompt("ساعت شروع:", button.dataset.start || "");
  if (!startTime) return;
  const endTime = prompt("ساعت پایان:", button.dataset.end || "");
  if (!endTime) return;

  const locationType = button.dataset.location || "in_person";
  let meetingUrl = null;
  if (locationType === "online" || locationType === "hybrid") {
    meetingUrl = prompt("لینک جلسه آنلاین:", "");
    if (!meetingUrl) return;
  }

  await request("/api/admin/student-session", "POST", {
    originalEnrollmentSessionId: Number(button.dataset.makeupEnrollment),
    sessionDate: date,
    startTime,
    endTime,
    instructorId: Number(button.dataset.instructor),
    roomId: button.dataset.room ? Number(button.dataset.room) : null,
    locationType,
    meetingUrl,
  });
  await load();
}

async function recordPayment(button) {
  const balance = Number(button.dataset.balance || 0);
  const raw = prompt("مبلغ پرداخت:", String(balance));
  if (!raw) return;
  const amount = Number(String(raw).replace(/[,٬،\s]/g, ""));
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("مبلغ پرداخت معتبر نیست.");
  const methodInput = prompt("روش پرداخت: cash / pos / transfer / online", "pos");
  if (methodInput === null) return;
  await request("/api/admin/payments", "POST", { invoiceId: Number(button.dataset.invoice), amount, method: methodInput });
  await load();
}

async function renewTerm(button) {
  const date = prompt("تاریخ شروع ترم جدید (YYYY-MM-DD):", state.date);
  if (!date) return;
  if (!confirm(`ترم فعلی بسته و ترم جدید از ${date} شروع شود؟`)) return;
  await request("/api/admin/enrollment-term-renew", "POST", {
    enrollmentId: Number(button.dataset.renewEnrollment),
    startDate: date,
  });
  await load();
}

const sessionsContainer = $("#sessions");
sessionsContainer?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("button");
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;

  button.disabled = true;
  try {
    if (button.dataset.makeupEnrollment) await createMakeup(button);
    else if (button.dataset.invoice) await recordPayment(button);
    else if (button.dataset.renewEnrollment) await renewTerm(button);
    else if (button.dataset.enrollment) await put("/api/admin/attendance", { enrollmentSessionId: Number(button.dataset.enrollment), status: button.dataset.status });
    else if (button.dataset.session) await put("/api/admin/teacher-attendance", { sessionId: Number(button.dataset.session), instructorId: Number(button.dataset.instructor), status: button.dataset.status });
  } catch (error) {
    showError(error instanceof Error ? error.message : "ثبت عملیات ناموفق بود");
  } finally {
    button.disabled = false;
  }
});

function shift(days) {
  const [y, m, d] = state.date.split("-").map(Number);
  const value = new Date(y, m - 1, d + days, 12);
  state.date = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  load();
}

const prev = $("#prev");
const next = $("#next");
const today = $("#today");
if (prev) prev.addEventListener("click", () => shift(-1));
if (next) next.addEventListener("click", () => shift(1));
if (today) today.addEventListener("click", () => { state.date = localDate(); load(); });

load();
