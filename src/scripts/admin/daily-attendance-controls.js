(() => {
  if (location.pathname !== "/admin/daily") return;

  const style = document.createElement("style");
  style.textContent = `
    #dailyPlanner #dpStudents{display:none!important}
    #dailyPlanner .dp-card{background:#fff!important;color:#202020!important;border-color:rgba(0,0,0,.12)!important;box-shadow:0 6px 18px rgba(0,0,0,.08)}
    #dailyPlanner .dp-card>strong,#dailyPlanner .dp-card>span,#dailyPlanner .dp-card>time{color:#202020!important}
    #dailyPlanner .dp-attendance-list{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px;direction:rtl}
    #dailyPlanner .dp-attendance-item{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#333;white-space:nowrap}
    #dailyPlanner .dp-attendance-buttons{display:inline-flex;gap:4px;direction:rtl}
    #dailyPlanner .dp-attendance-button{width:24px;height:24px;padding:0;border-radius:50%;border:1px solid rgba(0,0,0,.22);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:700 10px/1 inherit;box-sizing:border-box;transition:transform .12s,box-shadow .12s,border-color .12s;touch-action:manipulation}
    #dailyPlanner .dp-attendance-button:hover{transform:scale(1.08);box-shadow:0 3px 8px rgba(0,0,0,.15)}
    #dailyPlanner .dp-attendance-button.active{box-shadow:0 0 0 2px rgba(0,0,0,.22);border-color:rgba(0,0,0,.45)}
    #dailyPlanner .dp-attendance-button.present{background:#25a244;color:#fff}
    #dailyPlanner .dp-attendance-button.absent{background:#d62828;color:#fff}
    #dailyPlanner .dp-attendance-button.excused{background:#3b82f6;color:#fff}
    #dailyPlanner .dp-attendance-button.pending{background:#fff;color:#555}
    #dailyPlanner .dp-attendance-button:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
    #dailyPlanner .dp-card.dp-attendance-saving{opacity:.72}
  `;
  document.head.appendChild(style);

  const statusLabels = { present:"حاضر", absent:"غایب", excused:"مرخصی", pending:"هنوز ساعت برگزاری نرسیده" };
  const statusShort = { present:"ح", absent:"غ", excused:"م", pending:"" };

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date], input[type="date"][data-date], .daily-shell input[type="date"]');
    return input?.value || new Date().toLocaleDateString("en-CA");
  };

  const today = () => new Date().toLocaleDateString("en-CA");

  const isFuture = card => {
    const selected = selectedDate();
    if (selected > today()) return true;
    if (selected < today()) return false;
    const value = card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return false;
    const start = Number(match[1]) * 60 + Number(match[2]);
    const now = new Date();
    return start > now.getHours() * 60 + now.getMinutes();
  };

  const sourceCards = () => [...document.querySelectorAll("#dailyPlanner .dp-student-card")];

  const findSource = (name, timeText) => {
    const cards = sourceCards();
    return cards.find(card =>
      (card.dataset.studentName || "") === name &&
      card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() === timeText
    ) || cards.find(card => (card.dataset.studentName || "") === name) || null;
  };

  const setSave = (text, cls = "") => {
    const el = document.querySelector("#dpSave");
    if (el) {
      el.textContent = text;
      el.className = `dp-save ${cls}`;
    }
  };

  async function saveAttendance(source, status) {
    const enrollmentSessionId = Number(source.dataset.studentSession || 0);
    const enrollmentId = Number(source.dataset.enrollmentId || 0);
    if (!enrollmentSessionId) throw new Error("شناسه رکورد حضور هنرجو پیدا نشد.");
    const response = await fetch("/api/admin/daily-planner", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ enrollmentSessionId, enrollmentId, status })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "ذخیره وضعیت حضور ناموفق بود.");
    return data;
  }

  function decorate() {
    document.querySelectorAll("#dailyPlanner .dp-card").forEach(card => {
      if (card.querySelector(".dp-attendance-list")) return;
      const names = (card.querySelector("strong")?.textContent || "").split("،").map(v => v.trim()).filter(Boolean);
      const timeText = card.querySelector("time")?.textContent?.trim() || "";
      const sources = names.map(name => findSource(name, timeText)).filter(Boolean);
      if (!sources.length) return;

      const holder = document.createElement("div");
      holder.className = "dp-attendance-list";

      sources.forEach(source => {
        const future = isFuture(source);
        const current = source.dataset.attendanceStatus || "pending";
        const item = document.createElement("span");
        item.className = "dp-attendance-item";
        const label = document.createElement("span");
        label.textContent = source.dataset.studentName || "هنرجو";
        const buttons = document.createElement("span");
        buttons.className = "dp-attendance-buttons";

        ["present", "absent", "excused", "pending"].forEach(status => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `dp-attendance-button ${status}`;
          button.dataset.attendance = status;
          button.title = statusLabels[status];
          button.setAttribute("aria-label", `${statusLabels[status]} ${source.dataset.studentName || "هنرجو"}`);
          button.textContent = statusShort[status];
          if (current === status && (!future || status === "pending")) button.classList.add("active");
          if (future) button.disabled = status !== "pending";

          button.addEventListener("pointerdown", event => event.stopPropagation());
          button.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            if (future && status !== "pending") return;
            buttons.querySelectorAll("button").forEach(b => { b.disabled = true; });
            card.classList.add("dp-attendance-saving");
            try {
              await saveAttendance(source, status);
              source.dataset.attendanceStatus = status;
              buttons.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === button));
              setSave("وضعیت ذخیره شد", "is-saved");
              setTimeout(() => setSave("آماده", ""), 900);
            } catch (error) {
              setSave(error instanceof Error ? error.message : "ذخیره وضعیت حضور ناموفق بود", "is-error");
            } finally {
              card.classList.remove("dp-attendance-saving");
              buttons.querySelectorAll("button").forEach(b => { b.disabled = false; });
              if (future) buttons.querySelectorAll("button").forEach(b => { b.disabled = b.dataset.attendance !== "pending"; });
            }
          });
          buttons.appendChild(button);
        });

        item.append(label, buttons);
        holder.appendChild(item);
      });
      card.appendChild(holder);
    });
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  const boot = () => {
    const planner = document.querySelector("#dailyPlanner");
    if (!planner) return setTimeout(boot, 100);
    observer.observe(planner, { childList: true, subtree: true });
    decorate();
  };
  boot();
})();
