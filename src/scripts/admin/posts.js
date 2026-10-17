import { formatJalaliDateTime } from "../../utils/format-date";
import { expandEmmetAbbreviation, formatHtmlSource } from "../../utils/emmet";
import { isHtmlArticleContent, sanitizeArticleHtml } from "../../utils/sanitize-article-html";
import { summarizeArticleContent } from "../../utils/article-summary.js";

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
const codeEditorView = document.querySelector("#codeEditorView");
const sourceHighlight = document.querySelector("#contentSourceHighlight");
const sourceHighlightCode = document.querySelector("#contentSourceHighlightCode");
const codeLineNumbers = document.querySelector("#codeLineNumbers");
const editorCursorPosition = document.querySelector("#editorCursorPosition");
const editorLineCount = document.querySelector("#editorLineCount");
const expandEmmetButton = document.querySelector("#expandEmmetButton");
const formatHtmlButton = document.querySelector("#formatHtmlButton");
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

const AUTO_FILLED_FIELDS = [
  "slug", "topic", "related_course_slug", "related_course_title",
  "meta_title", "excerpt", "meta_description"
];
const autoFilledValues = new Map();
const manuallyEditedFields = new Set();
let articleSeoTimer = null;
let articleSeoController = null;
let articleSeoRequestId = 0;

function clearAutoFilledState() {
  if (articleSeoTimer !== null) window.clearTimeout(articleSeoTimer);
  articleSeoTimer = null;
  if (articleSeoController) articleSeoController.abort();
  articleSeoController = null;
  articleSeoRequestId += 1;
  autoFilledValues.clear();
  manuallyEditedFields.clear();
}

function applyAutoFilledValue(name, value) {
  const field = form.elements.namedItem(name);
  if (!field || !("value" in field) || manuallyEditedFields.has(name)) return;

  const nextValue = String(value ?? "");
  const currentValue = String(field.value ?? "");
  const lastGeneratedValue = autoFilledValues.get(name);
  const canReplace = !currentValue.trim() ||
    (lastGeneratedValue !== undefined && currentValue === lastGeneratedValue);
  if (!canReplace) return;

  if (currentValue !== nextValue) field.value = nextValue;
  if (nextValue) autoFilledValues.set(name, nextValue);
  else autoFilledValues.delete(name);
}

function updateArticleSummary() {
  const article = contentValue?.value || "";
  applyAutoFilledValue("excerpt", summarizeArticleContent(article, 230));
  applyAutoFilledValue("meta_description", summarizeArticleContent(article, 160));
}

async function requestArticleSeoSuggestions() {
  const titleField = form.elements.namedItem("title");
  const topicField = form.elements.namedItem("topic");
  const title = String(titleField?.value ?? "").trim();
  const visibleTopic = String(topicField?.value ?? "").trim();
  const generatedTopic = autoFilledValues.get("topic");
  // Do not send an old generated topic as if the editor had chosen it manually.
  const topic = generatedTopic && visibleTopic === generatedTopic && !manuallyEditedFields.has("topic")
    ? ""
    : visibleTopic;

  if (articleSeoController) articleSeoController.abort();
  const controller = new AbortController();
  articleSeoController = controller;
  const requestId = ++articleSeoRequestId;

  try {
    const response = await fetch("/api/admin/article-seo-suggestions", {
      method: "POST",
      headers: headers(),
      credentials: "same-origin",
      signal: controller.signal,
      body: JSON.stringify({ title, topic })
    });
    if (requestId !== articleSeoRequestId) return;
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return;
    }
    const data = await response.json();
    if (!response.ok || !data.success || !data.fields) return;

    const fields = data.fields;
    applyAutoFilledValue("topic", fields.topic);
    applyAutoFilledValue("slug", fields.slug);
    applyAutoFilledValue("related_course_slug", fields.related_course_slug);
    applyAutoFilledValue("related_course_title", fields.related_course_title);
    applyAutoFilledValue("meta_title", fields.meta_title);
  } catch (error) {
    if (error?.name !== "AbortError") console.error("Article SEO suggestion request failed:", error);
  } finally {
    if (requestId === articleSeoRequestId) articleSeoController = null;
  }
}

function queueArticleSeoSuggestions() {
  if (articleSeoTimer !== null) window.clearTimeout(articleSeoTimer);
  articleSeoTimer = window.setTimeout(() => {
    articleSeoTimer = null;
    void requestArticleSeoSuggestions();
  }, 300);
}

for (const name of AUTO_FILLED_FIELDS) {
  const field = form.elements.namedItem(name);
  field?.addEventListener("input", () => {
    const currentValue = String(field.value ?? "");
    const generatedValue = autoFilledValues.get(name);
    if (generatedValue === undefined ? Boolean(currentValue.trim()) : currentValue !== generatedValue) {
      manuallyEditedFields.add(name);
    }
  });
}
for (const name of ["title", "topic"]) {
  form.elements.namedItem(name)?.addEventListener("input", queueArticleSeoSuggestions);
}


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


function highlightHtml(source) {
  let highlighted = escapeHtml(source);
  highlighted = highlighted.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="code-token-comment">$1</span>');
  highlighted = highlighted.replace(/(&lt;\/?)([a-z][\w:-]*)([\s\S]*?)(\/?&gt;)/gi, (_all, open, tag, attributes, close) => {
    const styledAttributes = attributes.replace(/(\s)([a-z_:][\w:.-]*)(\s*=\s*)(&quot;.*?&quot;|&#39;.*?&#39;)/gi, '$1<span class="code-token-attribute">$2</span>$3<span class="code-token-string">$4</span>');
    return '<span class="code-token-punctuation">' + open + '</span><span class="code-token-tag">' + tag + '</span>' + styledAttributes + '<span class="code-token-punctuation">' + close + '</span>';
  });
  highlighted = highlighted.replace(/(&amp;#(?:x[0-9a-f]+|\d+);|&amp;(?:nbsp|amp|lt|gt|quot);)/gi, '<span class="code-token-entity">$1</span>');
  return highlighted || " ";
}

function updateCodeEditor(source = htmlSource.value) {
  if (!sourceHighlightCode) return;
  const lines = String(source ?? "").split("\n");
  sourceHighlightCode.innerHTML = highlightHtml(source);
  codeLineNumbers.textContent = lines.map((_line, index) => String(index + 1)).join("\n");
  editorLineCount.textContent = lines.length.toLocaleString("fa-IR") + " خط";
  syncCodeScroll();
  updateCursorPosition();
}

function syncCodeScroll() {
  if (!sourceHighlight || !htmlSource) return;
  sourceHighlight.scrollTop = htmlSource.scrollTop;
  sourceHighlight.scrollLeft = htmlSource.scrollLeft;
  codeLineNumbers.style.transform = "translateY(" + (-htmlSource.scrollTop) + "px)";
}

function updateCursorPosition() {
  if (!editorCursorPosition) return;
  const position = htmlSource.selectionStart || 0;
  const beforeCaret = htmlSource.value.slice(0, position);
  const lines = beforeCaret.split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  editorCursorPosition.textContent = "سطر " + line.toLocaleString("fa-IR") + "، ستون " + column.toLocaleString("fa-IR");
}

function expandEmmetAtCursor() {
  const cursor = htmlSource.selectionStart ?? 0;
  const lineStart = htmlSource.value.lastIndexOf("\n", cursor - 1) + 1;
  const lineEndAt = htmlSource.value.indexOf("\n", cursor);
  const lineEnd = lineEndAt < 0 ? htmlSource.value.length : lineEndAt;
  const line = htmlSource.value.slice(lineStart, lineEnd);
  const leading = line.match(/^\s*/)?.[0] ?? "";
  const abbreviation = line.trim();
  const expanded = expandEmmetAbbreviation(abbreviation);
  if (!expanded) {
    editorStatus.textContent = "مخفف Emmet شناخته نشد. نمونه: ul.nav>li.nav-item$*4>a";
    return false;
  }
  const indented = expanded.split("\n").map((item) => leading + item).join("\n");
  htmlSource.setRangeText(indented, lineStart, lineEnd, "select");
  htmlSource.selectionStart = lineStart + indented.length;
  htmlSource.selectionEnd = htmlSource.selectionStart;
  updateCodeEditor();
  syncContent();
  editorStatus.textContent = "مخفف Emmet به HTML گسترش یافت.";
  return true;
}

function indentCodeSelection() {
  const start = htmlSource.selectionStart;
  const end = htmlSource.selectionEnd;
  const selection = htmlSource.value.slice(start, end);
  if (selection.includes("\n")) {
    const indented = selection.split("\n").map((line) => "  " + line).join("\n");
    htmlSource.setRangeText(indented, start, end, "select");
  } else {
    htmlSource.setRangeText("  ", start, end, "end");
  }
  updateCodeEditor();
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
  updateArticleSummary();
  return html;
}

function setEditorMode(name) {
  if (!["visual", "html", "preview"].includes(name)) return;

  if (name === "html") {
    if (currentEditorMode === "visual" || (currentEditorMode === "preview" && previousEditingMode === "visual")) {
      htmlSource.value = visualEditor.innerHTML;
    }
    previousEditingMode = "html";
    updateCodeEditor(htmlSource.value);
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
  codeEditorView.hidden = name !== "html";
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
  codeEditorView.hidden = true;
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


htmlSource.addEventListener("input", () => {
  updateCodeEditor();
  syncContent();
  if (editorStatus) editorStatus.textContent = "کد تغییر کرده است؛ پیش‌نمایش را بررسی کنید و سپس نوشته را ذخیره کنید.";
});
htmlSource.addEventListener("scroll", syncCodeScroll);
htmlSource.addEventListener("keyup", updateCursorPosition);
htmlSource.addEventListener("click", updateCursorPosition);
htmlSource.addEventListener("select", updateCursorPosition);
htmlSource.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const cursor = htmlSource.selectionStart ?? 0;
    const lineStart = htmlSource.value.lastIndexOf("\n", cursor - 1) + 1;
    const lineEndAt = htmlSource.value.indexOf("\n", cursor);
    const lineEnd = lineEndAt < 0 ? htmlSource.value.length : lineEndAt;
    const beforeCaret = htmlSource.value.slice(lineStart, cursor).trim();
    const afterCaret = htmlSource.value.slice(cursor, lineEnd).trim();
    if (!event.shiftKey && beforeCaret && !afterCaret && !beforeCaret.includes("<")) {
      if (expandEmmetAtCursor()) return;
    }
    indentCodeSelection();
    syncContent();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    form.requestSubmit();
  }
});
expandEmmetButton.addEventListener("click", expandEmmetAtCursor);
formatHtmlButton.addEventListener("click", () => {
  const cursor = htmlSource.selectionStart ?? 0;
  htmlSource.value = formatHtmlSource(htmlSource.value);
  htmlSource.setSelectionRange(Math.min(cursor, htmlSource.value.length), Math.min(cursor, htmlSource.value.length));
  updateCodeEditor();
  syncContent();
  editorStatus.textContent = "کد HTML مرتب‌سازی شد؛ ساختار را قبل از ذخیره بررسی کنید.";
});

function getRangeElement(range) {
  let node = range?.startContainer;
  if (!node) return visualEditor;
  if (node.nodeType === Node.TEXT_NODE) return node.parentElement || visualEditor;
  if (node instanceof Element && (node === visualEditor || node.childNodes.length)) {
    const child = node.childNodes[range.startOffset] || node.childNodes[Math.max(0, range.startOffset - 1)];
    if (child?.nodeType === Node.TEXT_NODE) return child.parentElement || node;
    if (child instanceof Element) return child;
  }
  return node instanceof Element ? node : visualEditor;
}

function closestEditorElement(element, selector) {
  let current = element;
  while (current && current !== visualEditor) {
    if (current.matches(selector)) return current;
    current = current.parentElement;
  }
  return visualEditor;
}

function setVisibleSelectValue(select, value, label) {
  if (!select || value === undefined || value === null) return;
  const text = String(value);
  let option = [...select.options].find((item) => item.value === text);
  if (!option) {
    for (const previous of [...select.options]) {
      if (previous.dataset.generatedSelectionOption === "true") previous.remove();
    }
    option = document.createElement("option");
    option.value = text;
    option.textContent = String(label ?? text);
    option.dataset.generatedSelectionOption = "true";
    select.add(option);
  }
  select.value = text;
  select.title = String(label ?? option.textContent ?? text);
}

function updateToolbarControlsFromSelection(range = savedSelection) {
  if (currentEditorMode !== "visual") return;
  if (!range || !visualEditor.contains(range.commonAncestorContainer)) {
    const activeSelection = window.getSelection();
    if (!activeSelection?.rangeCount) return;
    const activeRange = activeSelection.getRangeAt(0);
    if (!visualEditor.contains(activeRange.commonAncestorContainer)) return;
    range = activeRange;
  }

  const selectedElement = getRangeElement(range);
  const block = closestEditorElement(selectedElement, "p,div,h1,h2,h3,h4,h5,h6,blockquote,pre,li");
  const rawTag = block === visualEditor ? "p" : block.tagName.toLowerCase();
  const blockTag = rawTag === "div" || rawTag === "li" ? "p" : rawTag;
  const blockLabels = {
    p: "پاراگراف", h1: "عنوان ۱", h2: "عنوان ۲", h3: "عنوان ۳",
    h4: "عنوان ۴", h5: "عنوان ۵", h6: "عنوان ۶", blockquote: "نقل‌قول", pre: "کد"
  };
  const blockSelect = editorToolbar.querySelector("[data-editor-block]");
  setVisibleSelectValue(blockSelect, blockTag, blockLabels[blockTag] || "پاراگراف");

  const computed = window.getComputedStyle(selectedElement);
  const fontSelect = editorToolbar.querySelector("[data-editor-font]");
  const computedFamily = String(computed.fontFamily || "Vazirmatn");
  const primaryFamily = computedFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const normalizedFamily = (value) => String(value).toLowerCase().replace(/["']/g, "").trim();
  const matchingFamily = [...fontSelect.options].find((option) =>
    option.value && normalizedFamily(option.value) === normalizedFamily(primaryFamily)
  );
  setVisibleSelectValue(fontSelect, matchingFamily?.value || primaryFamily || "Vazirmatn", matchingFamily?.textContent || primaryFamily || "وزیر");

  const weightSelect = editorToolbar.querySelector("[data-editor-weight]");
  const weight = String(Number.parseInt(computed.fontWeight, 10) || 400);
  setVisibleSelectValue(weightSelect, weight, weight);

  const sizeSelect = editorToolbar.querySelector("[data-editor-size]");
  const size = Number.parseFloat(computed.fontSize);
  if (Number.isFinite(size) && size > 0) {
    const sizeValue = String(Number(size.toFixed(2))) + "px";
    const matchingSize = [...sizeSelect.options].find((option) => Math.abs(Number.parseFloat(option.value) - size) < 0.1);
    const selectedSize = matchingSize?.value || sizeValue;
    const sizeLabel = matchingSize?.textContent || new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(size) + "px";
    setVisibleSelectValue(sizeSelect, selectedSize, sizeLabel);
  }
}

function saveSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (visualEditor.contains(range.commonAncestorContainer)) {
    savedSelection = range.cloneRange();
    updateToolbarControlsFromSelection(savedSelection);
  }
}

function restoreSelection() {
  visualEditor.focus();
  if (!savedSelection) return false;
  try {
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(savedSelection);
    return true;
  } catch {
    savedSelection = null;
    return false;
  }
}

function applyInlineStyle(property, value) {
  restoreSelection();
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    if (editorStatus) editorStatus.textContent = "ابتدا بخشی از متن را در ویرایشگر انتخاب کنید.";
    return false;
  }
  const sourceRange = selection.getRangeAt(0).cloneRange();
  if (sourceRange.collapsed) {
    if (editorStatus) editorStatus.textContent = "برای تغییر قلم یا اندازه، ابتدا بخشی از متن را انتخاب کنید.";
    updateToolbarControlsFromSelection(sourceRange);
    return false;
  }

  const textNodes = [];
  const walker = document.createTreeWalker(visualEditor, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue || !node.nodeValue.length || !sourceRange.intersectsNode(node)) continue;
    const startOffset = node === sourceRange.startContainer ? sourceRange.startOffset : 0;
    const endOffset = node === sourceRange.endContainer ? sourceRange.endOffset : node.nodeValue.length;
    if (endOffset > startOffset) textNodes.push({ node, start: startOffset, end: endOffset });
  }

  if (!textNodes.length) {
    if (editorStatus) editorStatus.textContent = "متن انتخاب‌شده قابل قالب‌بندی نیست.";
    return false;
  }

  // Wrap text nodes from end to start so offsets in earlier nodes remain valid
  // and never place inline spans around block-level elements.
  const wrapped = [];
  for (const part of textNodes.reverse()) {
    const segment = document.createRange();
    try {
      segment.setStart(part.node, part.start);
      segment.setEnd(part.node, part.end);
      const fragment = segment.extractContents();
      if (!fragment.textContent) continue;
      const span = document.createElement("span");
      span.style.setProperty(property, value);
      span.append(fragment);
      segment.insertNode(span);
      wrapped.push(span);
    } catch {
      // Continue with other valid fragments rather than dropping selected content.
    }
  }

  if (!wrapped.length) {
    if (editorStatus) editorStatus.textContent = "اعمال قالب‌بندی روی این انتخاب ممکن نشد.";
    return false;
  }

  const first = wrapped[wrapped.length - 1];
  const last = wrapped[0];
  const nextRange = document.createRange();
  nextRange.setStartBefore(first);
  nextRange.setEndAfter(last);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  savedSelection = nextRange.cloneRange();
  syncContent();
  updateToolbarControlsFromSelection(savedSelection);
  if (editorStatus) editorStatus.textContent = "قالب‌بندی روی متن انتخاب‌شده اعمال شد.";
  return true;
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

for (const selector of ["[data-editor-font]", "[data-editor-size]", "[data-editor-weight]", "[data-editor-block]"]) {
  editorToolbar.querySelectorAll(selector).forEach((select) => {
    select.addEventListener("pointerdown", saveSelection);
    select.addEventListener("mousedown", saveSelection);
    select.addEventListener("focus", () => {
      // Keyboard users may enter a dropdown without a mouse event.
      if (window.getSelection()?.rangeCount) saveSelection();
    });
  });
}

editorToolbar.querySelectorAll("[data-editor-font]").forEach((select) => {
  select.addEventListener("change", () => {
    const selectedValue = select.value;
    applyInlineStyle("font-family", selectedValue);
    // Retain the actual chosen font in the control.
    select.value = selectedValue;
  });
});

editorToolbar.querySelectorAll("[data-editor-size]").forEach((select) => {
  select.addEventListener("change", () => {
    const selectedValue = select.value;
    if (selectedValue) applyInlineStyle("font-size", selectedValue);
    select.value = selectedValue;
  });
});

editorToolbar.querySelectorAll("[data-editor-weight]").forEach((select) => {
  select.addEventListener("change", () => {
    const selectedValue = select.value;
    applyInlineStyle("font-weight", selectedValue);
    select.value = selectedValue;
  });
});

editorToolbar.querySelectorAll("[data-editor-block]").forEach((select) => {
  select.addEventListener("change", () => {
    const selectedValue = select.value;
    const hasSavedRange = restoreSelection();
    const selection = window.getSelection();
    if (!hasSavedRange && (!selection || !selection.rangeCount)) {
      if (editorStatus) editorStatus.textContent = "ابتدا مکان‌نما را داخل پاراگراف یا متن موردنظر قرار دهید.";
      select.value = selectedValue;
      return;
    }
    if (selectedValue) {
      const formatted = document.execCommand("formatBlock", false, "<" + selectedValue + ">");
      if (!formatted && editorStatus) editorStatus.textContent = "مرورگر این قالب پاراگراف را نپذیرفت.";
    }
    const activeSelection = window.getSelection();
    if (activeSelection?.rangeCount && visualEditor.contains(activeSelection.getRangeAt(0).commonAncestorContainer)) {
      savedSelection = activeSelection.getRangeAt(0).cloneRange();
    }
    syncContent();
    updateToolbarControlsFromSelection(savedSelection);
    if (!savedSelection) select.value = selectedValue;
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

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!visualEditor.contains(range.commonAncestorContainer)) return;
  // Don't overwrite a saved text range with a transient collapsed range when
  // focus moves from the editor into a native dropdown.
  if (range.collapsed && document.activeElement !== visualEditor) return;
  savedSelection = range.cloneRange();
  updateToolbarControlsFromSelection(savedSelection);
});

visualEditor.addEventListener("mouseup", saveSelection);
visualEditor.addEventListener("keyup", saveSelection);
visualEditor.addEventListener("input", () => {
  saveSelection();
  syncContent();
  updateToolbarControlsFromSelection(savedSelection);
  if (editorStatus) editorStatus.textContent = "تغییرات و قالب‌بندی در فرم ذخیره‌نشده‌اند؛ برای ثبت مقاله روی «ذخیره نوشته» بزنید.";
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
  clearAutoFilledState();
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
      clearAutoFilledState();
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
