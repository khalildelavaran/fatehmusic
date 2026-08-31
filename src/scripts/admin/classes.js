const body = document.querySelector("#classesBody");
const searchInput = document.querySelector("#classSearch");
const statusFilter = document.querySelector("#classStatusFilter");
const pagination = document.querySelector("#classesPagination");

const CLASS_TYPE_LABELS_FA = { individual: "خصوصی", group: "گروهی", workshop: "کارگاه", online: "آنلاین" };
const CLASS_STATUS_LABELS_FA = { active: "فعال", completed: "پایان‌یافته", cancelled: "لغوشده" };

let currentPage = 1;
const pageSize = 20;
let debounceTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderRows(classes) {
  if (!body) return;

  if (classes.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="admin-table-empty">کلاسی با این مشخصات یافت نشد.</td></tr>`;
    return;
  }

  body.innerHTML = classes
    .map((cls) => {
      return `<tr>
        <td><a href="/admin/classes?id=${encodeURIComponent(cls.id)}">${escapeHtml(cls.title)}</a></td>
        <td>${escapeHtml(cls.courseTitle)}</td>
        <td>${escapeHtml(cls.instructorName)}</td>
        <td>${CLASS_TYPE_LABELS_FA[cls.classType] || cls.classType}</td>
        <td>${cls.enrolledCount} / ${cls.capacity}</td>
        <td><span class="admin-status-pill" data-status="${cls.status}">${CLASS_STATUS_LABELS_FA[cls.status] || cls.status}</span></td>
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
    <span class="admin-pagination-label">صفحه ${page} از ${totalPages} · ${total} کلاس</span>
    <button type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>بعدی</button>
  `;
}

async function loadClasses() {
  if (!body) return;
  body.innerHTML = `<tr><td colspan="6" class="admin-table-empty">در حال بارگذاری...</td></tr>`;

  const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
  const search = searchInput?.value.trim();
  const status = statusFilter?.value;
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  let response;
  try {
    response = await fetch(`/api/admin/classes?${params.toString()}`, { credentials: "same-origin" });
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

  renderRows(data.classes);
  renderPagination(data.total, data.page, data.pageSize);
}

searchInput?.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    currentPage = 1;
    loadClasses();
  }, 350);
});

statusFilter?.addEventListener("change", () => {
  currentPage = 1;
  loadClasses();
});

pagination?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.disabled) return;
  const page = Number(target.dataset.page);
  if (!page || page < 1) return;
  currentPage = page;
  loadClasses();
});

loadClasses();
