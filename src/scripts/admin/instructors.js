const body = document.querySelector("#instructorsBody");
const searchInput = document.querySelector("#instructorSearch");
const statusFilter = document.querySelector("#instructorStatusFilter");
const pagination = document.querySelector("#instructorsPagination");

let currentPage = 1;
const pageSize = 20;
let debounceTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function renderRows(instructors) {
  if (!body) return;

  if (instructors.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="admin-table-empty">مدرسی با این مشخصات یافت نشد.</td></tr>`;
    return;
  }

  body.innerHTML = instructors
    .map((inst) => {
      const name = `${escapeHtml(inst.firstName)} ${escapeHtml(inst.lastName)}`.trim() || "(بدون نام)";
      return `<tr>
        <td><a href="/admin/instructors?id=${encodeURIComponent(inst.id)}">${name}</a></td>
        <td>${escapeHtml(inst.specialty) || "-"}</td>
        <td dir="ltr">${escapeHtml(inst.phone) || "-"}</td>
        <td>${inst.studentCount}</td>
        <td><span class="admin-status-pill" data-status="${inst.isActive ? "active" : "inactive"}">${inst.isActive ? "فعال" : "غیرفعال"}</span></td>
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
    <span class="admin-pagination-label">صفحه ${page} از ${totalPages} · ${total} مدرس</span>
    <button type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>بعدی</button>
  `;
}

async function loadInstructors() {
  if (!body) return;
  body.innerHTML = `<tr><td colspan="5" class="admin-table-empty">در حال بارگذاری...</td></tr>`;

  const params = new URLSearchParams({ page: String(currentPage), pageSize: String(pageSize) });
  const search = searchInput?.value.trim();
  const status = statusFilter?.value;
  if (search) params.set("search", search);
  if (status) params.set("status", status);

  let response;
  try {
    response = await fetch(`/api/admin/instructors?${params.toString()}`, { credentials: "same-origin" });
  } catch {
    body.innerHTML = `<tr><td colspan="5" class="admin-table-empty">خطا در ارتباط با سرور.</td></tr>`;
    return;
  }

  if (response.status === 401) {
    location.assign("/admin/login");
    return;
  }

  const data = await response.json();
  if (!data.success) {
    body.innerHTML = `<tr><td colspan="5" class="admin-table-empty">${escapeHtml(data.message || "خطا در دریافت اطلاعات.")}</td></tr>`;
    return;
  }

  renderRows(data.instructors);
  renderPagination(data.total, data.page, data.pageSize);
}

searchInput?.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    currentPage = 1;
    loadInstructors();
  }, 350);
});

statusFilter?.addEventListener("change", () => {
  currentPage = 1;
  loadInstructors();
});

pagination?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || target.disabled) return;
  const page = Number(target.dataset.page);
  if (!page || page < 1) return;
  currentPage = page;
  loadInstructors();
});

loadInstructors();
