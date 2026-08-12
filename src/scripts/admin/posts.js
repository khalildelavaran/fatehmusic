const loadButton = document.querySelector("#loadPosts");
const message = document.querySelector("#adminMessage");
const form = document.querySelector("#postForm");
const list = document.querySelector("#postsList");
let posts = [];

const headers = () => ({ "Content-Type": "application/json" });
const setMessage = (text) => { message.textContent = text; };

async function loadPosts() {
  const response = await fetch("/api/admin/posts", { credentials: "same-origin", headers: headers() });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) { setMessage(data.message); return; }
  posts = data.posts;
  renderPosts();
  setMessage("نوشته‌ها بارگذاری شدند.");
}

function renderPosts() {
  list.innerHTML = posts.map((post) => `<article class="admin-item"><h2>${post.title}</h2><p>${post.topic} — ${post.status === "published" ? "منتشر شده" : "پیش‌نویس"}</p><p dir="ltr">/blog/${post.slug}</p><div class="admin-item-actions"><button data-edit="${post.id}">ویرایش</button><button data-delete="${post.id}">حذف</button></div></article>`).join("");
}

loadButton.addEventListener("click", loadPosts);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch("/api/admin/posts", { method: "POST", headers: headers(), credentials: "same-origin", body: JSON.stringify(payload) });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  setMessage(data.success ? "نوشته ذخیره شد." : data.message);
  if (data.success) { form.reset(); await loadPosts(); }
});
list.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.edit;
  const deleteId = target.dataset.delete;
  if (editId) {
    const post = posts.find((item) => String(item.id) === editId);
    if (post) Object.entries(post).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; });
  }
  if (deleteId && confirm("این نوشته حذف شود؟")) {
    const response = await fetch("/api/admin/posts", { method: "DELETE", headers: headers(), credentials: "same-origin", body: JSON.stringify({ id: Number(deleteId) }) });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const data = await response.json();
    setMessage(data.success ? "نوشته حذف شد." : data.message);
    if (data.success) await loadPosts();
  }
});
