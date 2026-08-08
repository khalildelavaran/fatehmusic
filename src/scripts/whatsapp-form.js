/**
 * ============================================================
 * Fateh Music Academy — Quick Contact Form
 * src/scripts/whatsapp-form.js
 * ============================================================
 *
 * Two independent behaviours:
 * 1) While typing in "topic" or "message", show an instant,
 *    data-grounded answer (day/price/teacher/address/...) so
 *    repeat questions get answered before the form is even sent.
 * 2) On submit, build the WhatsApp message and redirect, as before.
 */

import { ask } from "./faq-bot.js";
import { renderAssistant, hideAssistant } from "./popup-ui.js";

const ASSISTANT_DEBOUNCE_MS = 450;

const initWhatsappForm = () => {
  const form = document.getElementById("quickMessageForm");
  const status = document.getElementById("quickMessageStatus");
  const assistant = document.getElementById("faqAssistant");

  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = "true";

  const whatsappNumber = form.dataset.whatsapp;
  const topicField = document.getElementById("qmTopic");
  const messageField = document.getElementById("qmMessage");

  let debounceTimer = null;

  const runAssistant = () => {
    const combined = `${topicField?.value || ""} ${messageField?.value || ""}`.trim();
    renderAssistant(assistant, ask(combined));
  };

  const scheduleAssistant = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(runAssistant, ASSISTANT_DEBOUNCE_MS);
  };

  topicField?.addEventListener("input", scheduleAssistant);
  messageField?.addEventListener("input", scheduleAssistant);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const get = (key) => (data.get(key) || "").toString().trim();

    const name = get("name");
    const topic = get("topic");
    const message = get("message");

    const lines = [
      "درخواست ثبت‌نام از سایت آموزشگاه موسیقی فاتح",
      "",
      `نام: ${name}`,
      topic ? `موضوع: ${topic}` : "",
      "",
      message,
      "",
      "لینک ثبت‌نام:",
      "https://fatehmusic.ir/register"
    ];

    const text = lines.join("\n");
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

    if (status) status.textContent = "در حال انتقال به واتساپ...";

    window.clearTimeout(debounceTimer);
    hideAssistant(assistant);
    form.reset();

    setTimeout(() => {
      window.location.href = url;
    }, 1500);
  });
};

initWhatsappForm();
document.addEventListener("astro:page-load", initWhatsappForm);
