import { formatJalaliDateTime } from "../../utils/format-date";
import { isHtmlArticleContent, sanitizeArticleHtml } from "../../utils/sanitize-article-html";

const message = document.querySelector("#adminMessage");
const generateButton = document.querySelector("#generateNowButton");
const generateStatus = document.querySelector("#generateStatus");
const form = document.querySelector("#postForm");
const clearFormButton = document.querySelector("#clearForm");
const list = document.querySelector("#postsList");
const postsStatus = document.querySelector("#postsStatus");
const tabButtons = [...document.querySelectorAll("[data-posts-tab]")];
const tabPanels = {
  posts: document.querySelector("#postsPanel"),
  write: document.querySelector("#writePanel")
};
const visualEditor = document.querySelector("#contentEditor");
const htmlSource = document.querySelector("#contentSource");
const preview = document.querySelector("#contentPreview");
const contentValue = document.querySelector("#contentValue");
const editorToolbar = document.querySelector(".rich-editor-toolbar");
const editorModeButtons = [...document.querySelectorAll("[data-editor-mode]")];
const editorWordCount = document.querySelector("#editorWordCount");
const editorStatus = document.querySelector("#editorStatus");
let posts = [];
let currentEditorMode = "visual";
let previousEditingMode = "visual";
let savedSelection = null;

const headers = () => ({ "Content-Type": "application/json" });
const setMessage = (text) => { if (message) message.textContent = text; };
const statusLabel = (status) => (status === "published" ? "منتشر شده" : "پیش‌نویس");
const formatDate = (value) => formatJalaliDateTime(value);

function activateTab(name) {
  if (!Object.hasOwn(tabPanels, name)) return;
  for (const button of tabButtons) {
    const active = button.dataset.postsTab === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  }
  for (const [panelName, panel] of Object.entries(tabPanels)) {
    const active = panelName === name;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.postsTab));
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownInline(value) {
  let html = escapeHtml(value);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\u0060([^\u0060]+)\u0060/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
  return html;
}

function markdownToHtml(value) {
  const lines = String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push("<p>" + markdownInline(paragraph.join(" ")) + "</p>");
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const tag = listType === "ol" ? "ol" : "ul";
    blocks.push("<" + tag + ">" + list.map((item) => "<li>" + markdownInline(item) + "</li>").join("") + "</" + tag + ">");
    list = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length === 1 ? 2 : Math.min(4, heading[1].length);
      blocks.push("<h" + level + ">" + markdownInline(heading[2]) + "</h" + level + ">");
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextType = numbered ? "ol" : "ul";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      list.push((bullet || numbered)[1]);
      continue;
    }
    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push("<hr>");
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks.join("\n");
}

function updateEditorWordCount(html) {
  if (!editorWordCount) return;
  const text = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&(?:amp|lt|gt|quot|#39);/gi, " ")
    .trim();
  const count = text ? text.split(/\s+/).length : 0;
  editorWordCount.textContent = count.toLocaleString("fa-IR") + " کلمه";
}

function currentHtml() {
  return currentEditorMode === "html" || (currentEditorMode === "preview" && previousEditingMode === "html")
    ? htmlSource.value
    : visualEditor.innerHTML;
}

function normalizeEditorHtml(raw) {
  const clean = sanitizeArticleHtml(raw);
  if (!clean.trim()) return "";
  return isHtmlArticleContent(clean) ? clean : "<div>" + clean + "</div>";
}

function syncContent() {
  const html = normalizeEditorHtml(currentHtml());
  contentValue.value = html;
  updateEditorWordCount(html);
  return html;
}

function setEditorMode(name) {
  if (!["visual", "html", "preview"].includes(name)) return;

  if (name === "html") {
    if (currentEditorMode === "visual" || (currentEditorMode === "preview" && previousEditingMode === "visual")) {
      htmlSource.value = visualEditor.innerHTML;
    }
    previousEditingMode = "html";
  } else if (name === "visual") {
    if (currentEditorMode === "html" || (currentEditorMode === "preview" && previousEditingMode === "html")) {
      visualEditor.innerHTML = sanitizeArticleHtml(htmlSource.value);
    }
    previousEditingMode = "visual";
  } else {
    if (currentEditorMode !== "preview") previousEditingMode = currentEditorMode;
    const source = previousEditingMode === "html" ? htmlSource.value : visualEditor.innerHTML;
    preview.innerHTML = sanitizeArticleHtml(source);
  }

  currentEditorMode = name;
  visualEditor.hidden = name !== "visual";
  htmlSource.hidden = name !== "html";
  preview.hidden = name !== "preview";
  editorToolbar.hidden = name !== "visual";
  for (const button of editorModeButtons) {
    const active = button.dataset.editorMode === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  syncContent();
}

editorModeButtons.forEach((button) => {
  button.addEventListener("click", () => setEditorMode(button.dataset.editorMode));
});

function setEditorContent(value) {
  const raw = String(value ?? "");
  visualEditor.innerHTML = isHtmlArticleContent(raw) ? sanitizeArticleHtml(raw) : markdownToHtml(raw);
  htmlSource.value = "";
  preview.innerHTML = "";
  currentEditorMode = "visual";
  previousEditingMode = "visual";
  visualEditor.hidden = false;
  htmlSource.hidden = true;
  preview.hidden = true;
  editorToolbar.hidden = false;
  for (const button of editorModeButtons) {
    const active = button.dataset.editorMode === "visual";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  syncContent();
}

function saveSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (visualEditor.contains(range.commonAncestorContainer)) savedSelection = range.cloneRange();
}

function restoreSelection() {
  visualEditor.focus();
  if (!savedSelection) return;
  try {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection);
  } catch {
    savedSelection = null;
  }
}

function applyInlineStyle(property, value) {
  restoreSelection();
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    if (editorStatus) editorStatus.textContent = "برای تغییر اندازه یا قلم، ابتدا بخشی از متن را انتخاب کنید.";
    return;
  }
  const span = document.createElement("span");
  span.style.setProperty(property, value);
  span.append(range.extractContents());
  range.insertNode(span);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  selection.addRange(nextRange);
  savedSelection = nextRange.cloneRange();
  syncContent();
}

editorToolbar.addEventListener("mousedown", (event) => {
  saveSelection();
  if (event.target instanceof Element && event.target.closest("button")) event.preventDefault();
});

editorToolbar.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("[data-editor-command], [data-editor-insert]") : null;
  if (!target) return;
  const command = target.dataset.editorCommand;
  const insert = target.dataset.editorInsert;
  restoreSelection();

  if (insert === "link") {
    const url = window.prompt("نشانی لینک (https:// یا مسیر داخلی مانند /courses):");
    if (url && /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(url.trim())) {
      document.execCommand("createLink", false, url.trim());
    } else if (url) {
      if (editorStatus) editorStatus.textContent = "نشانی لینک معتبر نیست؛ از https:// یا مسیر داخلی سایت استفاده کنید.";
    }
  } else if (insert === "image") {
    const url = window.prompt("نشانی تصویر (URL یا مسیر فایل در سایت):");
    const alt = url ? window.prompt("متن جایگزین تصویر برای دسترس‌پذیری:", "تصویر مقاله") : null;
    if (url && /^(https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(url.trim())) {
      document.execCommand("insertHTML", false, '<img src="' + escapeHtml(url.trim()) + '" alt="' + escapeHtml(alt || "") + '" />');
    } else if (url) {
      if (editorStatus) editorStatus.textContent = "نشانی تصویر معتبر نیست.";
    }
  } else if (insert === "table") {
    const rows = Math.max(1, Math.min(20, Number(window.prompt("تعداد ردیف جدول؟", "3")) || 3));
    const cols = Math.max(1, Math.min(10, Number(window.prompt("تعداد ستون جدول؟", "2")) || 2));
    let html = '<table border="1" cellpadding="6" cellspacing="0"><tbody>';
    for (let row = 0; row < rows; row += 1) {
      html += "<tr>";
      for (let col = 0; col < cols; col += 1) html += row === 0 ? "<th>عنوان</th>" : "<td>متن</td>";
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    document.execCommand("insertHTML", false, html);
  } else if (command) {
    document.execCommand(command, false);
  }

  syncContent();
});

editorToolbar.querySelectorAll("[data-editor-font]").forEach((select) => {
  select.addEventListener("mousedown", saveSelection);
  select.addEventListener("change", () => {
    if (select.value) applyInlineStyle("font-family", select.value);
    select.value = "";
  });
});

editorToolbar.querySelectorAll("[data-editor-size]").forEach((select) => {
  select.addEventListener("mousedown", saveSelection);
  select.addEventListener("change", () => {
    if (select.value) applyInlineStyle("font-size", select.value);
    select.value = "";
  });
});

editorToolbar.querySelectorAll("[data-editor-block]").forEach((select) => {
  select.addEventListener("mousedown", saveSelection);
  select.addEventListener("change", () => {
    restoreSelection();
    if (select.value) document.execCommand("formatBlock", false, "<" + select.value + ">");
    select.value = "p";
    syncContent();
  });
});

editorToolbar.querySelectorAll("[data-editor-color]").forEach((input) => {
  input.addEventListener("mousedown", saveSelection);
  input.addEventListener("input", () => {
    restoreSelection();
    document.execCommand(input.dataset.editorColor, false, input.value);
    syncContent();
  });
});

visualEditor.addEventListener("mouseup", saveSelection);
visualEditor.addEventListener("keyup", saveSelection);
visualEditor.addEventListener("input", () => {
  saveSelection();
  syncContent();
  if (editorStatus) editorStatus.textContent = "تغییرات و قالب‌بندی در فرم ذخیره‌نشده‌اند؛ برای ثبت مقاله روی «ذخیره نوشته» بزنید.";
});
htmlSource.addEventListener("input", () => {
  syncContent();
  if (editorStatus) editorStatus.textContent = "کد HTML تغییر کرده است؛ پیش‌نمایش را بررسی کنید و سپس نوشته را ذخیره کنید.";
});

async function loadPosts() {
  const response = await fetch("/api/admin/posts", { credentials: "same-origin", headers: headers() });
  if (response.status === 401) { window.location.assign("/admin/login"); return; }
  const data = await response.json();
  if (!data.success) {
    postsStatus.textContent = data.message || "بارگذاری نوشته‌ها ناموفق بود.";
    postsStatus.className = "admin-ai-status is-error";
    return;
  }
  posts = data.posts;
  renderPosts();
  postsStatus.textContent = posts.length.toLocaleString("fa-IR") + " نوشته بارگذاری شد.";
  postsStatus.className = "admin-ai-status";
}

function renderPosts() {
  if (posts.length === 0) {
    list.innerHTML = '<tr><td colspan="5" class="admin-table-empty">هنوز نوشته‌ای ثبت نشده است.</td></tr>';
    return;
  }

  list.innerHTML = posts.map((post) => [
    "<tr><td><strong>", escapeHtml(post.title), "</strong>",
    '<div class="admin-post-meta-row"><div class="admin-table-subtext" dir="ltr">/blog/', escapeHtml(post.slug), "</div>",
    post.is_ai_generated ? '<span class="admin-ai-badge">تولید با هوش مصنوعی</span>' : "",
    "</div></td><td>", escapeHtml(post.topic ?? "—"), "</td><td>",
    '<span class="admin-status-pill" data-status="', escapeHtml(post.status), '">', statusLabel(post.status), "</span></td><td>",
    escapeHtml(formatDate(post.updated_at)), '</td><td class="admin-table-actions">',
    '<button type="button" data-edit="', escapeHtml(post.id), '">مشاهده / ویرایش</button>',
    '<button type="button" class="secondary" data-delete="', escapeHtml(post.id), '">حذف</button>',
    "</td></tr>"
  ].join("")).join("");
}

function resetForm() {
  form.reset();
  form.elements.id.value = "";
  setEditorContent("");
  setMessage("فرم برای نوشته‌ی جدید آماده است.");
  form.elements.title.focus();
}

loadPosts();
clearFormButton.addEventListener("click", resetForm);

generateButton.addEventListener("click", async () => {
  generateButton.disabled = true;
  generateButton.textContent = "در حال تولید... (تا ۳۰ ثانیه طول می‌کشد)";
  generateStatus.textContent = "";
  generateStatus.className = "admin-ai-status";
  try {
    const response = await fetch("/api/admin/generate-post", { method: "POST", credentials: "same-origin" });
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const data = await response.json();
    generateStatus.textContent = data.message;
    generateStatus.className = "admin-ai-status" + (data.success ? " is-success" : " is-error");
    if (data.success) await loadPosts();
  } catch {
    generateStatus.textContent = "خطای شبکه هنگام تماس با سرور.";
    generateStatus.className = "admin-ai-status is-error";
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "تولید همین الان (تست)";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = syncContent();
  if (!content.trim()) {
    if (editorStatus) editorStatus.textContent = "متن مقاله را وارد کنید.";
    setEditorMode("visual");
    visualEditor.focus();
    return;
  }

  const payload = Object.fromEntries(new FormData(form));
  payload.content = content;
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
        if (key !== "content" && form.elements[key]) form.elements[key].value = value ?? "";
      });
      setEditorContent(post.content ?? "");
      activateTab("write");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      setMessage("در حال ویرایش: " + post.title);
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
