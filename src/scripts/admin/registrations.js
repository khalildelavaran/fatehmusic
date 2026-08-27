import { formatJalaliDate, formatJalaliTime } from "../../utils/format-date";

const liveStatus = document.querySelector("#liveStatus");
const printButton = document.querySelector("#printRegistrations");
const body = document.querySelector("#registrationsBody");
const statusLabels = { pending: "در انتظار", contacted: "تماس گرفته شد", confirmed: "تأیید شد", cancelled: "لغو شد" };
const headers = () => ({ "Content-Type": "application/json" });
const POLL_INTERVAL_MS = 30_000;
let pollTimer = null;

function setLiveStatus(text) {
  if (liveStatus) liveStatus.textContent = text;
}

async function loadRegistrations({ silent = false } = {}) {
  if (!silent) setLiveStatus("در حال به‌روزرسانی...");
  let response;
  try {
    response = await fetch("/api/admin/registrations", { credentials: "same-origin", headers: headers() });
  } catch {
    setLiveStatus("خطا در ارتباط با سرور. تلاش مجدد در ۳۰ ثانیه...");
    return;
  }
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) { setLiveStatus(data.message); return; }

  body.innerHTML = data.registrations.length === 0
    ? `<tr><td colspan="9" class="admin-table-empty">هنوز ثبت‌نامی وجود ندارد.</td></tr>`
    : data.registrations
        .map(
          (item) => `<tr>
            <td>${item.tracking_code}</td>
            <td>${item.student_first_name} ${item.student_last_name}<br><span class="admin-table-subtext">سن: ${item.student_age}</span></td>
            <td dir="ltr">${item.student_national_code || "-"}</td>
            <td dir="ltr">${item.student_mobile}</td>
            <td>${item.instrument_title}</td>
            <td>${item.instructor_name}</td>
            <td>${item.schedule_weekday}<br><span class="admin-table-subtext">${item.schedule_duration || ""} دقیقه · ${formatJalaliDate(item.created_at)}</span></td>
            <td><span class="admin-status-pill" data-status="${item.status}">${statusLabels[item.status] || item.status}</span></td>
            <td class="no-print admin-registration-actions">
              <select data-id="${item.id}">
                ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
              <button type="button" class="admin-document-btn" data-print-contract="${item.id}">چاپ قرارداد</button>
              <a class="admin-document-btn" href="/admin/certificates?registration_id=${encodeURIComponent(item.id)}">گواهینامه</a>
            </td>
          </tr>`
        )
        .join("");

  const now = formatJalaliTime(new Date());
  setLiveStatus(`${data.registrations.length} ثبت‌نام · آخرین به‌روزرسانی: ${now}`);
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => loadRegistrations({ silent: true }), POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPolling();
  else { loadRegistrations({ silent: true }); startPolling(); }
});

printButton?.addEventListener("click", () => window.print());

body.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-print-contract]");
  if (!(target instanceof HTMLButtonElement)) return;

  const registrationId = Number(target.dataset.printContract);
  if (!registrationId) return;
  target.disabled = true;
  const originalText = target.textContent;
  target.textContent = "در حال تولید...";

  try {
    const response = await fetch("/api/admin/contract-generate", {
      method: "POST",
      headers: headers(),
      credentials: "same-origin",
      body: JSON.stringify({ registration_id: registrationId })
    });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: "تولید قرارداد شکست خورد." }));
      setLiveStatus(data.message || "تولید قرارداد شکست خورد.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setLiveStatus("PDF قرارداد در تب جدید باز شد.");
  } catch {
    setLiveStatus("خطای شبکه هنگام تولید قرارداد.");
  } finally {
    target.disabled = false;
    target.textContent = originalText;
  }
});

body.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const response = await fetch("/api/admin/registrations", { method: "PATCH", headers: headers(), credentials: "same-origin", body: JSON.stringify({ id: Number(target.dataset.id), status: target.value }) });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) setLiveStatus(data.message);
  await loadRegistrations({ silent: true });
});

loadRegistrations();
startPolling();
