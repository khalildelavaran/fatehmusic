import { formatJalaliDateTime } from "../../utils/format-date";

const message = document.querySelector("#adminMessage");
const form = document.querySelector("#postForm");
const clearFormButton = document.querySelector("#clearForm");
const list = document.querySelector("#postsList");
let posts = [];

const headers = () => ({ "Content-Type": "application/json" });
const setMessage = (text) => { message.textContent = text; };
const statusLabel = (status) => (status === "published" ? "منتشر شده" : "پیش‌نویس");
const formatDate = (value) => formatJalaliDateTime(value);

async function loadPosts() {
  const response = await fetch("/api/admin/posts", { credentials: "same-origin", headers: headers() });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) { setMessage(data.message); return; }
  posts = data.posts;
  renderPosts();
  setMessage(`${posts.length} نوشته بارگذاری شد.`);
}

function renderPosts() {
  if (posts.length === 0) {
    list.innerHTML = `<tr><td colspan="5" class="admin-table-empty">هنوز نوشته‌ای ثبت نشده است.</td></tr>`;
    return;
  }
  list.innerHTML = posts
    .map(
      (post) => `
    <tr>
      <td>
        <strong>${post.title}</strong>
        ${post.is_ai_generated ? '<span class="admin-ai-badge">تولید با هوش مصنوعی</span>' : ""}
        <div class="admin-table-subtext" dir="ltr">/blog/${post.slug}</div>
      </td>
      <td>${post.topic ?? "—"}</td>
      <td><span class="admin-status-pill" data-status="${post.status}">${statusLabel(post.status)}</span></td>
      <td>${formatDate(post.updated_at)}</td>
      <td class="admin-table-actions">
        <button type="button" data-edit="${post.id}">مشاهده / ویرایش</button>
        <button type="button" class="secondary" data-delete="${post.id}">حذف</button>
      </td>
    </tr>`
    )
    .join("");
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  setMessage("فرم برای نوشته‌ی جدید آماده است.");
  form.elements.title.focus();
}

loadPosts();
clearFormButton.addEventListener("click", resetForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/admin/posts", { method: "POST", headers: headers(), credentials: "same-origin", body: JSON.stringify(payload) });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  setMessage(data.success ? "نوشته ذخیره شد." : data.message);
  if (data.success) { resetForm(); await loadPosts(); }
});

list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.edit;
  const deleteId = target.dataset.delete;

  if (editId) {
    const post = posts.find((item) => String(item.id) === editId);
    if (post) {
      Object.entries(post).forEach(([key, value]) => {
        if (form.elements[key]) form.elements[key].value = value ?? "";
      });
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      setMessage(`در حال ویرایش: ${post.title}`);
    }
  }

  if (deleteId && confirm("این نوشته حذف شود؟")) {
    const response = await fetch("/api/admin/posts", { method: "DELETE", headers: headers(), credentials: "same-origin", body: JSON.stringify({ id: Number(deleteId) }) });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const data = await response.json();
    setMessage(data.success ? "نوشته حذف شد." : data.message);
    if (data.success) await loadPosts();
  }
});
