const loadButton = document.querySelector("#loadRegistrations");
const printButton = document.querySelector("#printRegistrations");
const message = document.querySelector("#adminMessage");
const body = document.querySelector("#registrationsBody");
const statusLabels = { pending: "در انتظار", contacted: "تماس گرفته شد", confirmed: "تأیید شد", cancelled: "لغو شد" };

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  if (response.status === 401) {
    window.location.assign(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("unauthorized");
  }
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "خطا در ارتباط با سرور.");
  return data;
}

async function loadRegistrations() {
  try {
    const data = await request("/api/admin/registrations");
    body.innerHTML = data.registrations.map((item) => `<tr><td>${item.tracking_code}</td><td>${item.student_first_name} ${item.student_last_name}<br>سن: ${item.student_age}</td><td>${item.student_mobile}</td><td>${item.instrument_title}</td><td>${item.instructor_name}</td><td>${item.schedule_weekday}<br>${item.schedule_duration || ""} دقیقه<br>${item.created_at}</td><td>${statusLabels[item.status] || item.status}</td><td class="no-print"><select data-id="${item.id}">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></td></tr>`).join("");
    message.textContent = "ثبت‌نام‌ها بارگذاری شدند.";
  } catch (error) {
    if (error.message !== "unauthorized") message.textContent = error.message;
  }
}

loadButton?.addEventListener("click", loadRegistrations);
printButton?.addEventListener("click", () => window.print());
body?.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  try {
    await request("/api/admin/registrations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(target.dataset.id), status: target.value }) });
    message.textContent = "وضعیت به‌روزرسانی شد.";
    await loadRegistrations();
  } catch (error) {
    if (error.message !== "unauthorized") message.textContent = error.message;
  }
});
