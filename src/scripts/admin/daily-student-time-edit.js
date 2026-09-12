(() => {
  const normalizePath = () => location.pathname.replace(/\/+$/, "") || "/";
  if (normalizePath() !== "/admin/daily") return;

  const parseRange = value => {
    const match = String(value || "").trim().match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
    return match ? { start: match[1], end: match[2] } : { start: "", end: "" };
  };
  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const minutes = value => {
    const [h, m] = String(value || "00:00").split(":").map(Number);
    return h * 60 + m;
  };

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date],input[type="date"][data-date],.daily-shell input[type="date"]');
    return input?.value || new Date().toLocaleDateString("en-CA");
  };

  const findSessionCard = card => {
    const sessionId = card.dataset.sessionId || "";
    if (sessionId) {
      const direct = document.querySelector(`#dailyPlanner .dp-card[data-session-id="${CSS.escape(sessionId)}"]`);
      if (direct) return direct;
    }
    const name = card.dataset.studentName || "";
    const time = card.querySelector(".dp-student-meta span[dir='ltr'],.dp-student-meta [data-time-value]")?.textContent?.trim() || "";
    const cards = [...document.querySelectorAll("#dailyPlanner .dp-card")];
    return cards.find(item => item.textContent.includes(name) && item.querySelector("time")?.textContent?.trim() === time)
      || cards.find(item => item.textContent.includes(name));
  };

  const syncStudentCards = (sessionCard, oldTime, newTime) => {
    const sessionId = sessionCard?.dataset.sessionId || "";
    const sessionName = sessionCard?.querySelector("strong")?.textContent?.trim() || "";
    document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(card => {
      const cardSessionId = card.dataset.sessionId || "";
      const name = card.dataset.studentName || "";
      const timeEl = card.querySelector(".dp-student-meta span[dir='ltr'],.dp-student-meta [data-time-value]");
      if (!timeEl) return;
      const matchesId = sessionId && cardSessionId && String(sessionId) === String(cardSessionId);
      const matchesName = name && sessionName && sessionName.includes(name);
      const matchesTime = timeEl.textContent.trim() === oldTime || timeEl.textContent.trim() === newTime;
      if (matchesId || (matchesName && matchesTime)) timeEl.textContent = newTime;
    });
  };

  const save = async (sessionCard, startTime, endTime) => {
    const sessionId = Number(sessionCard?.dataset.sessionId || 0);
    if (!sessionId) throw new Error("شناسه جلسه پیدا نشد.");
    if (!validTime(startTime) || !validTime(endTime)) throw new Error("زمان معتبر نیست.");
    if (minutes(endTime) <= minutes(startTime)) throw new Error("زمان پایان باید بعد از شروع باشد.");

    const response = await fetch("/api/admin/daily-planner", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sessionId, sessionDate: selectedDate(), startTime, endTime })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "ذخیره زمان ناموفق بود.");
    return data;
  };

  const openEditor = card => {
    if (card.dataset.timeEditing === "1") return;
    // The displayed control is a button after decoration; support both the original span and the button.
    const source = card.querySelector(".dp-student-meta [data-time-action='edit'],.dp-student-meta span[data-time-value],.dp-student-meta span[dir='ltr']");
    if (!source) return;
    const sessionCard = findSessionCard(card);
    if (!sessionCard) return;

    const oldText = source.textContent.trim();
    const { start, end } = parseRange(oldText);
    if (!validTime(start) || !validTime(end)) return;

    const host = source.parentElement;
    if (!host) return;
    card.dataset.timeEditing = "1";

    const form = document.createElement("span");
    form.className = "dp-student-time-form";
    form.innerHTML = `
      <input type="time" data-start value="${start}" aria-label="زمان شروع">
      <span aria-hidden="true">–</span>
      <input type="time" data-end value="${end}" aria-label="زمان پایان">
      <button type="button" data-save class="save">ذخیره</button>
      <button type="button" data-cancel class="cancel">انصراف</button>
      <span data-error class="dp-student-time-error" hidden></span>
    `;
    host.replaceChild(form, source);

    const startInput = form.querySelector("[data-start]");
    const endInput = form.querySelector("[data-end]");
    const saveButton = form.querySelector("[data-save]");
    const cancelButton = form.querySelector("[data-cancel]");
    const error = form.querySelector("[data-error]");

    const restore = text => {
      const replacement = document.createElement("button");
      replacement.type = "button";
      replacement.className = "dp-student-time-value";
      replacement.dataset.timeAction = "edit";
      replacement.setAttribute("aria-label", "ویرایش زمان کلاس");
      replacement.setAttribute("title", "ویرایش زمان کلاس");
      replacement.setAttribute("dir", "ltr");
      replacement.textContent = text;
      replacement.addEventListener("pointerdown", event => event.stopPropagation());
      replacement.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openEditor(card);
      });
      if (form.parentElement === host) host.replaceChild(replacement, form);
      card.dataset.timeEditing = "0";
    };

    cancelButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      restore(oldText);
    });

    saveButton.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      error.hidden = true;
      const newStart = startInput.value;
      const newEnd = endInput.value;
      if (!validTime(newStart) || !validTime(newEnd) || minutes(newEnd) <= minutes(newStart)) {
        error.textContent = "زمان پایان باید بعد از زمان شروع باشد.";
        error.hidden = false;
        return;
      }
      saveButton.disabled = true;
      cancelButton.disabled = true;
      try {
        const data = await save(sessionCard, newStart, newEnd);
        const savedStart = data.startTime || data.start_time || newStart;
        const savedEnd = data.endTime || data.end_time || newEnd;
        const newText = `${savedStart}–${savedEnd}`;
        sessionCard.querySelector("time")?.replaceChildren(document.createTextNode(newText));
        restore(newText);
        syncStudentCards(sessionCard, oldText, newText);
        window.dispatchEvent(new CustomEvent("daily-planner-session-changed", {
          detail: { sessionId: Number(sessionCard.dataset.sessionId), startTime: savedStart, endTime: savedEnd }
        }));
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "ذخیره زمان ناموفق بود.";
        error.hidden = false;
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    });

    [startInput, endInput].forEach(input => {
      input.addEventListener("pointerdown", e => e.stopPropagation());
      input.addEventListener("click", e => e.stopPropagation());
    });
    startInput.focus();
  };

  const decorate = () => {
    const cards = document.querySelectorAll("#dailyPlanner .dp-student-card");
    cards.forEach(card => {
      if (card.dataset.timeEditing === "1") return;
      const timeEl = card.querySelector(".dp-student-meta span[dir='ltr'],.dp-student-meta span[data-time-value]");
      if (!timeEl || card.dataset.timeEditBound === "1") return;

      const sessionCard = findSessionCard(card);
      if (sessionCard) card.dataset.sessionId = sessionCard.dataset.sessionId || "";

      card.dataset.timeEditBound = "1";
      timeEl.dataset.timeValue = "1";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dp-student-time-value";
      button.dataset.timeAction = "edit";
      button.title = "ویرایش زمان کلاس";
      button.setAttribute("aria-label", "ویرایش زمان کلاس");
      button.setAttribute("dir", "ltr");
      button.textContent = timeEl.textContent.trim();
      button.addEventListener("pointerdown", event => event.stopPropagation());
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openEditor(card);
      });
      timeEl.replaceWith(button);
    });
  };

  const css = document.createElement("style");
  css.textContent = `
    #dailyPlanner .dp-student-time-value{display:inline-flex;align-items:center;border:1px solid rgba(212,175,55,.28);background:rgba(212,175,55,.06);color:inherit;font:inherit;font-size:11px;font-weight:800;padding:3px 7px;border-radius:6px;cursor:pointer;direction:ltr;white-space:nowrap;position:relative;z-index:20;pointer-events:auto}
    #dailyPlanner .dp-student-time-value:hover{background:rgba(212,175,55,.15);border-color:rgba(212,175,55,.65)}
    #dailyPlanner .dp-student-time-form{display:inline-flex;align-items:center;gap:4px;direction:ltr;flex-wrap:wrap;position:relative;z-index:20;pointer-events:auto}
    #dailyPlanner .dp-student-time-form input{width:68px;height:28px;box-sizing:border-box;border:1px solid rgba(0,0,0,.22);border-radius:6px;background:#fff;color:#202020;padding:2px 5px;font:600 12px Vazirmatn,sans-serif;direction:ltr}
    #dailyPlanner .dp-student-time-form button{height:28px;border:1px solid rgba(0,0,0,.18);border-radius:6px;background:#fff;color:#202020;padding:2px 7px;cursor:pointer;font:600 11px Vazirmatn,sans-serif}
    #dailyPlanner .dp-student-time-form button.save{background:#d4af37;border-color:#b89500;color:#111}
    #dailyPlanner .dp-student-time-form button:disabled{opacity:.55;cursor:wait}
    #dailyPlanner .dp-student-time-error{font-size:10px;color:#a33;margin-inline-start:4px;flex-basis:100%}
  `;
  document.head.appendChild(css);

  const waitForPlanner = () => {
    const planner = document.querySelector("#dailyPlanner");
    if (!planner) return setTimeout(waitForPlanner, 100);
    const observer = new MutationObserver(() => requestAnimationFrame(decorate));
    observer.observe(planner, { childList: true, subtree: true });
    decorate();
  };

  waitForPlanner();
})();