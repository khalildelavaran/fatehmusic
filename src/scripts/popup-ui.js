// public/scripts/popup-ui.js

let popupEl = null;
let overlayEl = null;

export const showPopup = (data) => {
  if (!data) return;

  if (!overlayEl) {
    overlayEl = document.createElement("div");
    overlayEl.className = "faq-popup-overlay";
    document.body.appendChild(overlayEl);
  }

  if (!popupEl) {
    popupEl = document.createElement("div");
    popupEl.className = "faq-popup";
    popupEl.innerHTML = `
      <div class="faq-popup-header">
        <h3 class="faq-popup-title"></h3>
        <button class="faq-popup-close" type="button">×</button>
      </div>
      <div class="faq-popup-body">
        <pre class="faq-popup-text"></pre>
      </div>
    `;
    document.body.appendChild(popupEl);

    popupEl.querySelector(".faq-popup-close")?.addEventListener("click", hidePopup);
    overlayEl.addEventListener("click", hidePopup);
  }

  popupEl.querySelector(".faq-popup-title").textContent = data.title || "پاسخ آموزشگاه";
  popupEl.querySelector(".faq-popup-text").textContent = data.text || data.answer || "";

  overlayEl.classList.add("visible");
  popupEl.classList.add("visible");
};

export const hidePopup = () => {
  overlayEl?.classList.remove("visible");
  popupEl?.classList.remove("visible");
};

// ⭐ اینجا لیسنر رویداد را اضافه می‌کنیم
window.addEventListener("faq-popup", (event) => {
  showPopup(event.detail);
});