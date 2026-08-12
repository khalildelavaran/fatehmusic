const loadButton = document.querySelector("#loadPosts");
const message = document.querySelector("#adminMessage");
const form = document.querySelector("#postForm");
const list = document.querySelector("#postsList");
let posts = [];

const request = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  if (response.status === 401) {
    window.location.assign(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("unauthorized");
  }
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "خطا در ارتباط با سرور.");
  return data;
};

const setMessage = (text) => { message.textContent = text; };

async function loadPosts() {
  try {
    const data = await request("/api/admin/posts");
    posts = data.posts;
    renderPosts();
    setMessage("نوشته‌ها بارگذاری شدند.");
  } catch (error) {
    if (error.message !== "unauthorized") setMessage(error.message);
  }
}

function renderPosts() {
  list.innerHTML = posts.map((post) => `<article class="admin-item"><h2>${post.title}</h2><p>${post.topic} — ${post.status === "published" ? "منتشر شده" : "پیش‌نویس"}</p><p dir="ltr">/blog/${post.slug}</p><div class="admin-item-actions"><button data-edit="${post.id}">ویرایش</button><button data-delete="${post.id}">حذف</button></div></article>`).join("");
}

loadButton?.addEventListener("click", loadPosts);
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(form));
    await request("/api/admin/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMessage("نوشته ذخیره شد.");
    form.reset();
    await loadPosts();
  } catch (error) {
    if (error.message !== "unauthorized") setMessage(error.message);
  }
});

list?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.edit;
  const deleteId = target.dataset.delete;
  if (editId) {
    const post = posts.find((item) => String(item.id) === editId);
    if (post) Object.entries(post).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; });
  }
  if (deleteId && confirm("این نوشته حذف شود؟")) {
    try {
      await request("/api/admin/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(deleteId) }) });
      setMessage("نوشته حذف شد.");
      await loadPosts();
    } catch (error) {
      if (error.message !== "unauthorized") setMessage(error.message);
    }
  }
});
