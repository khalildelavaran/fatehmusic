import { formatJalaliDate } from "../../utils/format-date";

const body = document.querySelector("#studentsBody");
const searchInput = document.querySelector("#studentSearch");
const statusFilter = document.querySelector("#studentStatusFilter");
const pagination = document.querySelector("#studentsPagination");

const STATUS_LABELS_FA = { active: "فعال", inactive: "غیرفعال", graduated: "فارغ‌التحصیل" };

let currentPage = 1;
const pageSize = 20;
let debounceTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderRows(students) {
  if (!body) return;

  if (students.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="admin-table-empty">هنرجویی با این مشخصات یافت نشد.</td></tr>`;
    return;
  }

  body.innerHTML = students
    .map((student) => {
      const name = `${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}`.trim() || "(بدون نام)";
      const latest = student.latestRegistrationAt ? formatJalaliDate(student.latestRegistrationAt) : "-";
      return `<tr>
        <td><a href="/admin/students?id=${encodeURIComponent(student.id)}">${name}</a></td>
        <td dir="ltr">${escapeHtml(student.nationalCode) || "-"}</td>
        <td dir="ltr">${escapeHtml(student.phone) || "-"}</td>
        <td>${student.termCount}</td>
        <td>${latest}</td>
        <td><span class="admin-status-pill" data-status="${student.status}">${STATUS_LABELS_FA[student.status] || student.status}</span></td>
      </tr>`;
    })
    .join("");
}

function renderPagination(total, page, size) {
  if (!pagination) return;
  const totalPages = Math.max(1, Math.ceil(total / size));

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  pagination.innerHTML = `
    <button type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>قبلی</button>
    <span class="admin-pagination-label">صفحه ${page} از ${totalPages} · ${total} هنرجو</span>
    <button type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>بعدی</button>
  `;
}

async function loadStudents() {
  if (!body) return;
  body.innerHTML = `<tr><td colspan="6" class="admin-table-empty">در حال بارگذاری...</td></tr>`;

  const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
  const search = searchInput?.value.trim();
  const status = statusFilter?.value;
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  let response;
  try {
    response = await fetch(`/api/admin/students?${params.toString()}`, { credentials: "same-origin" });
  } catch {
    body.innerHTML = `<tr><td colspan="6" class="admin-table-empty">خطا در ارتباط با سرور.</td></tr>`;
    return;
  }

  if (response.status === 401) {
    location.assign("/admin/login");
    return;
  }

  const data = await response.json();
  if (!data.success) {
    body.innerHTML = `<tr><td colspan="6" class="admin-table-empty">${escapeHtml(data.message || "خطا در دریافت اطلاعات.")}</td></tr>`;
    return;
  }

  renderRows(data.students);
  renderPagination(data.total, data.page, data.pageSize);
}

searchInput?.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    currentPage = 1;
    loadStudents();
  }, 350);
});

statusFilter?.addEventListener("change", () => {
  currentPage = 1;
  loadStudents();
});

pagination?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.disabled) return;
  const page = Number(target.dataset.page);
  if (!page || page < 1) return;
  currentPage = page;
  loadStudents();
});

loadStudents();
