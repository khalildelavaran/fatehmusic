type PrintOptions = {
  title?: string;
  orientation?: "portrait" | "landscape";
};

/**
 * Global print manager.
 *
 * Usage from any button:
 * <button type="button" data-print-target="#section-id">چاپ</button>
 *
 * Or directly:
 * PrintManager.print("#section-id", { title: "رسید ثبت‌نام" });
 */
class PrintManager {
  private static active = false;

  static bind(root: ParentNode = document) {
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLElement>("[data-print-target]");
      if (!button) return;

      const selector = button.dataset.printTarget?.trim();
      if (!selector) return;

      event.preventDefault();
      void PrintManager.print(selector, {
        title: button.dataset.printTitle || undefined,
        orientation: button.dataset.printOrientation === "landscape" ? "landscape" : "portrait"
      });
    });
  }

  static async print(target: string | Element, options: PrintOptions = {}) {
    if (PrintManager.active) return;

    const source = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
    if (!(source instanceof HTMLElement)) {
      console.warn(`[PrintManager] Print target not found: ${String(target)}`);
      return;
    }

    PrintManager.active = true;
    const sheet = source.cloneNode(true) as HTMLElement;
    sheet.classList.add("global-print-sheet");
    sheet.removeAttribute("id");
    sheet.removeAttribute("hidden");
    sheet.removeAttribute("aria-hidden");

    sheet.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    sheet.querySelectorAll(".no-print, [data-no-print], [data-print-exclude]").forEach((element) => element.remove());
    sheet.querySelectorAll("input, textarea, select").forEach((field) => {
      const original = source.querySelector(`[name="${CSS.escape(field.getAttribute("name") || "")}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!original) return;

      if (field instanceof HTMLInputElement && original instanceof HTMLInputElement) {
        field.checked = original.checked;
        field.value = original.value;
      } else if (field instanceof HTMLTextAreaElement && original instanceof HTMLTextAreaElement) {
        field.value = original.value;
        field.textContent = original.value;
      } else if (field instanceof HTMLSelectElement && original instanceof HTMLSelectElement) {
        field.value = original.value;
      }
    });

    const frame = document.createElement("div");
    frame.className = "global-print-frame";
    frame.dataset.printOrientation = options.orientation || "portrait";
    if (options.title) frame.dataset.printTitle = options.title;
    frame.appendChild(sheet);
    document.body.appendChild(frame);

    document.documentElement.classList.add("is-printing-global");

    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      window.print();
    } finally {
      const cleanup = () => {
        document.documentElement.classList.remove("is-printing-global");
        frame.remove();
        PrintManager.active = false;
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup, { once: true });

      // Safari/WebView can omit afterprint; keep the temporary DOM bounded.
      window.setTimeout(cleanup, 1500);
    }
  }
}

if (typeof document !== "undefined") {
  PrintManager.bind();
}

export { PrintManager };
