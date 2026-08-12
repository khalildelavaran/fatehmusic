const loadButton = document.querySelector("#loadRegistrations");
const printButton = document.querySelector("#printRegistrations");
const message = document.querySelector("#adminMessage");
const body = document.querySelector("#registrationsBody");
const statusLabels = { pending: "در انتظار", contacted: "تماس گرفته شد", confirmed: "تأیید شد", cancelled: "لغو شد" };
const headers = () => ({ "Content-Type": "application/json" });

async function loadRegistrations() {
  const response = await fetch("/api/admin/registrations", { credentials: "same-origin", headers: headers() });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) { message.textContent = data.message; return; }
  body.innerHTML = data.registrations.map((item) => `<tr><td>${item.tracking_code}</td><td>${item.student_first_name} ${item.student_last_name}<br>سن: ${item.student_age}</td><td>${item.student_mobile}</td><td>${item.instrument_title}</td><td>${item.instructor_name}</td><td>${item.schedule_weekday}<br>${item.schedule_duration || ""} دقیقه<br>${item.created_at}</td><td>${statusLabels[item.status] || item.status}</td><td class="no-print"><select data-id="${item.id}">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></td></tr>`).join("");
  message.textContent = "ثبت‌نام‌ها بارگذاری شدند.";
}

loadButton.addEventListener("click", loadRegistrations);
printButton.addEventListener("click", () => window.print());
body.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const response = await fetch("/api/admin/registrations", { method: "PATCH", headers: headers(), credentials: "same-origin", body: JSON.stringify({ id: Number(target.dataset.id), status: target.value }) });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  message.textContent = data.success ? "وضعیت به‌روزرسانی شد." : data.message;
  if (data.success) await loadRegistrations();
});
