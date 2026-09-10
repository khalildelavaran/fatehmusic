(() => {
  if (location.pathname !== "/admin/daily") return;

  const parseRange = (value) => {
    const [start, end] = String(value || "").split("–").map(v => v.trim());
    return { start, end };
  };

  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const minutes = value => {
    const [h, m] = String(value).split(":").map(Number);
    return h * 60 + m;
  };

  const style = document.createElement("style");
  style.textContent = `
    #dailyPlanner .dp-student-time-edit{display:flex;align-items:center;gap:5px;direction:ltr;margin-inline-start:auto}
    #dailyPlanner .dp-student-time-value{border:0;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:700;padding:2px 4px;border-radius:5px;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
    #dailyPlanner .dp-student-time-value:hover{background:rgba(212,175,55,.13)}
    #dailyPlanner .dp-student-time-form{display:flex;align-items:center;gap:4px;direction:ltr}
    #dailyPlanner .dp-student-time-form input{width:72px;height:28px;box-sizing:border-box;border:1px solid rgba(0,0,0,.22);border-radius:6px;background:#fff;color:#202020;padding:2px 5px;font:600 12px Vazirmatn,sans-serif;direction:ltr}
    #dailyPlanner .dp-student-time-form button{height:28px;border:1px solid rgba(0,0,0,.18);border-radius:6px;background:#fff;color:#202020;padding:2px 7px;cursor:pointer;font:600 11px Vazirmatn,sans-serif}
    #dailyPlanner .dp-student-time-form button.save{background:#d4af37;border-color:#b89500;color:#111}
    #dailyPlanner .dp-student-time-form button:hover{filter:brightness(.96)}
    #dailyPlanner .dp-student-time-error{font-size:10px;color:#a33;margin-inline-start:4px}
  `;
  document.head.appendChild(style);

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date],input[type="date"][data-date],.daily-shell input[type="date"]');
    return input?.value || new Date().toLocaleDateString("en-CA");
  };

  const findSessionCard = (studentCard) => {
    const name = studentCard.dataset.studentName || "";
    const time = studentCard.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
    const cards = [...document.querySelectorAll("#dailyPlanner .dp-card")];
    return cards.find(card => card.textContent.includes(name) && card.querySelector("time")?.textContent?.trim() === time)
      || cards.find(card => card.textContent.includes(name));
  };

  const syncSessionCard = (sessionCard, oldTime, newTime) => {
    if (!sessionCard) return;
    const timeEl = sessionCard.querySelector("time");
    if (timeEl) timeEl.textContent = newTime;
    const sessionName = sessionCard.querySelector("strong")?.textContent?.trim() || "";
    document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(card => {
      const name = card.dataset.studentName || "";
      const time = card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
      if (name && sessionName && !sessionName.includes(name)) return;
      if (time !== oldTime && time !== newTime) return;
      const el = card.querySelector(".dp-student-meta span[dir='ltr']");
      if (el) el.textContent = newTime;
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

  const edit = (card) => {
    if (card.dataset.timeEditing === "1") return;
    const timeEl = card.querySelector(".dp-student-meta span[dir='ltr']");
    if (!timeEl) return;
    const sessionCard = findSessionCard(card);
    if (!sessionCard) return;

    const oldTime = timeEl.textContent.trim();
    const { start, end } = parseRange(oldTime);
    if (!validTime(start) || !validTime(end)) return;

    card.dataset.timeEditing = "1";
    const host = timeEl.parentElement;
    if (!host) return;
    const original = timeEl.cloneNode(true);
    const form = document.createElement("span");
    form.className = "dp-student-time-form";
    form.innerHTML = `
      <input type="time" value="${start}" aria-label="زمان شروع">
      <span>–</span>
      <input type="time" value="${end}" aria-label="زمان پایان">
      <button type="button" class="save">ذخیره</button>
      <button type="button" class="cancel">انصراف</button>
      <span class="dp-student-time-error" hidden></span>
    `;

    host.replaceChild(form, timeEl);
    const [startInput, endInput] = form.querySelectorAll("input");
    const saveButton = form.querySelector(".save");
    const cancelButton = form.querySelector(".cancel");
    const errorEl = form.querySelector(".dp-student-time-error");

    const close = (restore = true) => {
      if (restore) host.replaceChild(original, form);
      card.dataset.timeEditing = "0";
    };

    cancelButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    });

    saveButton.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      errorEl.hidden = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      try {
        const data = await save(sessionCard, startInput.value, endInput.value);
        const newTime = `${data.startTime}–${data.endTime}`;
        const newEl = document.createElement("span");
        newEl.setAttribute("dir", "ltr");
        newEl.textContent = newTime;
        host.replaceChild(newEl, form);
        card.dataset.timeEditing = "0";
        syncSessionCard(sessionCard, oldTime, newTime);
        window.dispatchEvent(new CustomEvent("daily-planner-session-changed", { detail: { sessionId: Number(sessionCard.dataset.sessionId), startTime: data.startTime, endTime: data.endTime } }));
      } catch (error) {
        errorEl.textContent = error instanceof Error ? error.message : "ذخیره زمان ناموفق بود.";
        errorEl.hidden = false;
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    });

    [startInput, endInput].forEach(input => input.addEventListener("click", event => event.stopPropagation()));
    startInput.focus();
  };

  const decorate = () => {
    document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(card => {
      if (card.dataset.timeEditBound === "1") return;
      const timeEl = card.querySelector(".dp-student-meta span[dir='ltr']");
      if (!timeEl) return;
      card.dataset.timeEditBound = "1";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dp-student-time-value";
      button.title = "ویرایش زمان کلاس";
      button.setAttribute("aria-label", "ویرایش زمان کلاس");
      button.textContent = timeEl.textContent.trim();
      button.setAttribute("dir", "ltr");
      button.addEventListener("pointerdown", event => event.stopPropagation());
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        edit(card);
      });
      timeEl.replaceWith(button);
    });
  };

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  const boot = () => {
    const planner = document.querySelector("#dailyPlanner");
    if (!planner) return setTimeout(boot, 100);
    observer.observe(planner, { childList: true, subtree: true });
    decorate();
  };
  boot();
})();
