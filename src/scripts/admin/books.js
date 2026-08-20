const form = document.querySelector("#bookForm");
const formStatus = document.querySelector("#formStatus");
const list = document.querySelector("#booksList");
const filterButtons = document.querySelectorAll("[data-course-filter]");
const submitBtn = document.querySelector("#submitBtn");
const clearBtn = document.querySelector("#clearForm");

const fields = {
  id: document.querySelector("#bookId"),
  course_slug: document.querySelector("#courseSlug"),
  title: document.querySelector("#title"),
  author: document.querySelector("#author"),
  level: document.querySelector("#level"),
  cover_image: document.querySelector("#coverImage"),
  display_order: document.querySelector("#displayOrder")
};

let books = [];
let currentFilter = "";

function setStatus(text, isError = false) {
  formStatus.textContent = text;
  formStatus.className = "admin-ai-status" + (text ? (isError ? " is-error" : " is-success") : "");
}

function resetForm() {
  fields.id.value = "";
  form.reset();
  fields.display_order.value = 0;
  submitBtn.textContent = "افزودن کتاب";
}

async function loadBooks() {
  const qs = currentFilter ? `?course_slug=${encodeURIComponent(currentFilter)}` : "";
  const response = await fetch(`/api/admin/books${qs}`, { credentials: "same-origin" });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) { list.innerHTML = `<tr><td colspan="6" class="admin-table-empty">${data.message}</td></tr>`; return; }
  books = data.books;
  renderBooks();
}

function renderBooks() {
  if (books.length === 0) {
    list.innerHTML = `<tr><td colspan="6" class="admin-table-empty">کتابی برای این دوره ثبت نشده — از فرم بالا اضافه کنید.</td></tr>`;
    return;
  }
  list.innerHTML = books
    .map((b) => `
    <tr>
      <td>${b.cover_image ? `<img class="admin-book-cover" src="/images/books/${b.cover_image}" alt="" loading="lazy" />` : "—"}</td>
      <td>${b.course_slug}</td>
      <td>${b.title}</td>
      <td>${b.author ?? "—"}</td>
      <td>${b.level ?? "—"}</td>
      <td class="admin-table-actions">
        <button type="button" data-edit="${b.id}">ویرایش</button>
        <button type="button" class="danger" data-delete="${b.id}">حذف</button>
      </td>
    </tr>`)
    .join("");
}

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    currentFilter = btn.dataset.courseFilter ?? "";
    loadBooks();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    course_slug: fields.course_slug.value,
    title: fields.title.value.trim(),
    author: fields.author.value.trim() || null,
    level: fields.level.value || null,
    cover_image: fields.cover_image.value.trim() || null,
    display_order: Number(fields.display_order.value) || 0
  };
  const editingId = fields.id.value;
  const method = editingId ? "PATCH" : "POST";
  if (editingId) payload.id = Number(editingId);

  const response = await fetch("/api/admin/books", {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  setStatus(data.success ? (editingId ? "کتاب ویرایش شد." : "کتاب اضافه شد.") : data.message, !data.success);
  if (data.success) {
    resetForm();
    await loadBooks();
  }
});

clearBtn.addEventListener("click", resetForm);

list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const editId = target.dataset.edit;
  if (editId) {
    const book = books.find((b) => String(b.id) === editId);
    if (!book) return;
    fields.id.value = book.id;
    fields.course_slug.value = book.course_slug;
    fields.title.value = book.title;
    fields.author.value = book.author ?? "";
    fields.level.value = book.level ?? "";
    fields.cover_image.value = book.cover_image ?? "";
    fields.display_order.value = book.display_order ?? 0;
    submitBtn.textContent = "ذخیره ویرایش";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const deleteId = target.dataset.delete;
  if (deleteId && confirm("این کتاب حذف شود؟")) {
    const response = await fetch("/api/admin/books", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: Number(deleteId) })
    });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    await loadBooks();
  }
});

loadBooks();
