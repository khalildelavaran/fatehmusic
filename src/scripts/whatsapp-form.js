// public/scripts/whatsapp-form.js

import { popup } from "./faq-bot.js";

const initWhatsappForm = () => {
  const form = document.getElementById("quickMessageForm");
  const status = document.getElementById("quickMessageStatus");

  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = "true";

  const whatsappNumber = form.dataset.whatsapp;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const get = (key) => (data.get(key) || "").toString().trim();

    const name = get("name");
    const topic = get("topic");
    const message = get("message");

    const result = popup(message);

    // ⭐ پاپ‌آپ را نمایش بده
    if (result && result.intent !== "unknown") {
      window.dispatchEvent(new CustomEvent("faq-popup", { detail: result }));
    }

    // ⭐ واتساپ را با کمی تأخیر باز کن (یا اگر خواستی، کلاً حذف کن)
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

    form.reset();

    setTimeout(() => {
      window.location.href = url;
    }, 1500); // اگر نمی‌خواهی تأخیر، این را بردار
  });
};

initWhatsappForm();
document.addEventListener("astro:page-load", initWhatsappForm);