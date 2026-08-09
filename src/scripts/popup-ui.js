/**
 * ============================================================
 * Fateh Music Academy — FAQ Assistant Renderer
 * src/scripts/popup-ui.js
 * ============================================================
 *
 * Renders faq-bot.js results into an inline panel that lives
 * inside the contact form (not a page-covering modal). A modal
 * would steal focus while the visitor is mid-typing and would
 * disappear the moment the WhatsApp redirect fires — an inline,
 * in-flow panel stays visible, updates live and never blocks
 * the form.
 */

/**
 * Builds (once) and returns the panel's internal element refs.
 *
 * @param {HTMLElement} container
 * @returns {{heading:HTMLElement, lines:HTMLElement, links:HTMLElement}}
 */
function ensureElements(container) {
  if (container.dataset.ready) {
    return {
      heading: container.querySelector(".faq-assistant__heading"),
      lines: container.querySelector(".faq-assistant__lines"),
      links: container.querySelector(".faq-assistant__links")
    };
  }

  container.classList.add("faq-assistant");
  container.innerHTML = `
    <div class="faq-assistant__header">
      <strong class="faq-assistant__heading"></strong>
      <button type="button" class="faq-assistant__close" aria-label="بستن پاسخ">×</button>
    </div>
    <div class="faq-assistant__lines"></div>
    <div class="faq-assistant__links"></div>
  `;

  container.querySelector(".faq-assistant__close").addEventListener("click", () => {
    hideAssistant(container);
  });

  container.dataset.ready = "true";

  return {
    heading: container.querySelector(".faq-assistant__heading"),
    lines: container.querySelector(".faq-assistant__lines"),
    links: container.querySelector(".faq-assistant__links")
  };
}

/**
 * Appends one part of a line to a parent element: plain text as
 * a text node, or a { text, href } part as a bold inline link.
 * DOM APIs only (never innerHTML), so nothing here can inject
 * markup, including the real names/titles pulled from data.
 *
 * @param {HTMLElement} parent
 * @param {string|{text:string, href:string}} part
 */
function appendPart(parent, part) {
  if (typeof part === "string") {
    parent.appendChild(document.createTextNode(part));
    return;
  }

  const a = document.createElement("a");
  a.href = part.href;
  a.textContent = part.text;
  a.className = "faq-assistant__inline-link";
  a.target = "_blank";
  a.rel = "noopener";
  parent.appendChild(a);
}

/**
 * Builds a single answer line, which is either plain text or an
 * array mixing text with one or more inline links (e.g. a course
 * name and an instructor name both linked within the same sentence).
 *
 * @param {string|(string|{text:string,href:string})[]} line
 * @returns {HTMLParagraphElement}
 */
function renderLine(line) {
  const p = document.createElement("p");

  if (typeof line === "string") {
    p.textContent = line;
  } else {
    line.forEach((part) => appendPart(p, part));
  }

  return p;
}

/**
 * Fills the heading: plain text, or a single { text, href } link
 * to the matched course/instructor page.
 *
 * @param {HTMLElement} headingEl
 * @param {string|{text:string, href:string}} heading
 */
function renderHeading(headingEl, heading) {
  headingEl.innerHTML = "";
  if (typeof heading === "string") {
    headingEl.textContent = heading;
    return;
  }
  appendPart(headingEl, heading);
}

/**
 * Renders a faq-bot.js result (found answer, hint, or nothing)
 * into the panel. Safe to call on every keystroke.
 *
 * @param {HTMLElement|null} container
 * @param {{found:boolean, heading?:(string|object), lines?:(string|object)[], links?:object[], hint?:string}} result
 */
export function renderAssistant(container, result) {
  if (!container || !result) return;

  if (!result.found && !result.hint) {
    hideAssistant(container);
    return;
  }

  const refs = ensureElements(container);
  container.classList.toggle("is-hint", !result.found);

  renderHeading(refs.heading, result.found ? result.heading || "پاسخ آموزشگاه" : "راهنما");

  refs.lines.innerHTML = "";
  const textLines = result.found ? result.lines || [] : [result.hint];
  textLines.forEach((line) => {
    refs.lines.appendChild(renderLine(line));
  });

  refs.links.innerHTML = "";
  (result.links || []).forEach((link) => {
    const a = document.createElement("a");
    a.href = link.href;
    a.textContent = link.label;
    a.className = "faq-assistant__link";
    a.target = "_blank";
    a.rel = "noopener";
    refs.links.appendChild(a);
  });

  container.hidden = false;
  requestAnimationFrame(() => container.classList.add("is-visible"));
}

/**
 * Hides the panel without destroying its content.
 *
 * @param {HTMLElement|null} container
 */
export function hideAssistant(container) {
  if (!container) return;
  container.classList.remove("is-visible");
  container.hidden = true;
}
