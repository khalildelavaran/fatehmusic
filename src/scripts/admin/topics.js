import { formatJalaliDateTime } from "../../utils/format-date";

const generateButton = document.querySelector("#generateTopicsButton");
const generateStatus = document.querySelector("#generateStatus");
const list = document.querySelector("#topicsList");
const filterButtons = document.querySelectorAll("[data-filter]");
const exportLink = document.querySelector("#exportCsvLink");

let topics = [];
let currentFilter = "approved";

const headers = () => ({ "Content-Type": "application/json" });

const STATUS_LABELS = { candidate: "در انتظار بررسی", approved: "تأییدشده", rejected: "ردشده", used: "استفاده‌شده" };
const INTENT_LABELS = { informational: "آموزشی", commercial: "مقایسه‌ای", transactional: "تراکنشی", navigational: "برند" };

function setGenerateStatus(text, isError = false) {
  generateStatus.textContent = text;
  generateStatus.className = "admin-ai-status" + (text ? (isError ? " is-error" : " is-success") : "");
}

async function loadTopics() {
  const qs = currentFilter ? `?status=${encodeURIComponent(currentFilter)}` : "";
  const response = await fetch(`/api/admin/topics${qs}`, { credentials: "same-origin", headers: headers() });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) { list.innerHTML = `<tr><td colspan="7" class="admin-table-empty">${data.message}</td></tr>`; return; }
  topics = data.topics;
  renderTopics();
}

function scoreClass(score) {
  if (score >= 55) return "is-high";
  if (score >= 35) return "is-mid";
  return "is-low";
}

function renderTopics() {
  if (topics.length === 0) {
    list.innerHTML = `<tr><td colspan="7" class="admin-table-empty">موضوعی در این وضعیت یافت نشد.</td></tr>`;
    return;
  }
  list.innerHTML = topics
    .map((topic) => {
      const courseOrCategory = topic.related_course_title || topic.category || "—";
      const actions = [];
      if (topic.status !== "approved") actions.push(`<button type="button" data-action="approved" data-id="${topic.id}">تأیید</button>`);
      if (topic.status !== "rejected") actions.push(`<button type="button" class="secondary" data-action="rejected" data-id="${topic.id}">رد</button>`);
      actions.push(`<button type="button" class="danger" data-delete="${topic.id}">حذف</button>`);
      return `
    <tr>
      <td>
        <strong title="${(topic.reasoning ?? "").replace(/"/g, "&quot;")}">${topic.title}</strong>
        <div class="admin-table-subtext">${INTENT_LABELS[topic.intent] ?? topic.intent}</div>
      </td>
      <td>${courseOrCategory}</td>
      <td>${topic.modifier_type}</td>
      <td>${INTENT_LABELS[topic.intent] ?? topic.intent}</td>
      <td><span class="admin-score-pill ${scoreClass(topic.score_total)}">${Math.round(topic.score_total)}</span></td>
      <td><span class="admin-status-pill" data-status="${topic.status}">${STATUS_LABELS[topic.status] ?? topic.status}</span></td>
      <td class="admin-table-actions">${actions.join("")}</td>
    </tr>`;
    })
    .join("");
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentFilter = btn.dataset.filter ?? "";
    exportLink.href = currentFilter ? `/api/admin/topics-export?status=${encodeURIComponent(currentFilter)}` : "/api/admin/topics-export";
    loadTopics();
  });
});

generateButton.addEventListener("click", async () => {
  generateButton.disabled = true;
  generateButton.textContent = "در حال تولید...";
  setGenerateStatus("");
  try {
    const response = await fetch("/api/admin/topics-generate", { method: "POST", credentials: "same-origin" });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const data = await response.json();
    setGenerateStatus(data.message, !data.success);
    if (data.success) await loadTopics();
  } catch (err) {
    setGenerateStatus("خطای شبکه هنگام تماس با سرور.", true);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "تولید موضوعات جدید";
  }
});

list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const status = target.dataset.action;
  const deleteId = target.dataset.delete;

  if (status) {
    const id = Number(target.dataset.id);
    const response = await fetch("/api/admin/topics", {
      method: "PATCH", headers: headers(), credentials: "same-origin",
      body: JSON.stringify({ id, status })
    });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    await loadTopics();
  }

  if (deleteId && confirm("این موضوع حذف شود؟")) {
    const response = await fetch("/api/admin/topics", {
      method: "DELETE", headers: headers(), credentials: "same-origin",
      body: JSON.stringify({ id: Number(deleteId) })
    });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    await loadTopics();
  }
});

loadTopics();
