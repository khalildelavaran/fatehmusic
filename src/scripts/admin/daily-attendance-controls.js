(() => {
  if (location.pathname !== "/admin/daily") return;

  const style = document.createElement("style");
  style.textContent = `
    /* The separate student list is only a data source for the timeline cards. */
    #dailyPlanner #dpStudents{display:none!important}

    /* Keep the actual white timeline cards visible and give the attendance controls room. */
    #dailyPlanner .dp-card{
      background:#fff!important;
      color:#202020!important;
      border-color:rgba(0,0,0,.12)!important;
      box-shadow:0 6px 18px rgba(0,0,0,.08);
      min-height:88px!important;
      padding:8px 9px 34px!important;
      overflow:hidden!important;
    }
    #dailyPlanner .dp-card>strong,
    #dailyPlanner .dp-card>span,
    #dailyPlanner .dp-card>time{color:#202020!important}
    #dailyPlanner .dp-card>strong{padding-inline-end:4px!important}
    #dailyPlanner .dp-card>span{padding-inline-end:4px!important}
    #dailyPlanner .dp-card>time{
      top:7px!important;
      bottom:auto!important;
      inset-inline-end:7px!important;
      background:rgba(0,0,0,.045)!important;
      border-color:rgba(0,0,0,.10)!important;
      color:#333!important;
    }

    /* Attendance controls live inside the white session card. */
    #dailyPlanner .dp-attendance-list{
      position:absolute;
      left:7px;
      right:7px;
      bottom:6px;
      display:flex;
      align-items:center;
      justify-content:flex-start;
      gap:5px;
      flex-wrap:wrap;
      margin:0;
      direction:rtl;
      z-index:8;
    }
    #dailyPlanner .dp-attendance-item{
      display:inline-flex;
      align-items:center;
      gap:4px;
      min-width:0;
      font-size:9px;
      color:#333;
      white-space:nowrap;
    }
    #dailyPlanner .dp-attendance-item>span:first-child{
      max-width:72px;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    #dailyPlanner .dp-attendance-buttons{
      display:inline-flex;
      align-items:center;
      gap:4px;
      direction:rtl;
    }
    #dailyPlanner .dp-attendance-button{
      appearance:none!important;
      -webkit-appearance:none!important;
      width:25px!important;
      height:25px!important;
      min-width:25px!important;
      min-height:25px!important;
      padding:0!important;
      margin:0!important;
      border-radius:50%!important;
      border:1px solid rgba(0,0,0,.28)!important;
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      position:relative!important;
      z-index:10!important;
      cursor:pointer!important;
      font:700 10px/1 inherit!important;
      box-sizing:border-box!important;
      transition:transform .12s,box-shadow .12s,border-color .12s!important;
      touch-action:manipulation!important;
    }
    #dailyPlanner .dp-attendance-button:hover:not(:disabled){
      transform:scale(1.08)!important;
      box-shadow:0 3px 8px rgba(0,0,0,.18)!important;
    }
    #dailyPlanner .dp-attendance-button.active{
      box-shadow:0 0 0 2px rgba(0,0,0,.25)!important;
      border-color:rgba(0,0,0,.55)!important;
    }
    #dailyPlanner .dp-attendance-button.present{background:#25a244!important;color:#fff!important}
    #dailyPlanner .dp-attendance-button.absent{background:#d62828!important;color:#fff!important}
    #dailyPlanner .dp-attendance-button.excused{background:#3b82f6!important;color:#fff!important}
    #dailyPlanner .dp-attendance-button.pending{background:#fff!important;color:#555!important}
    #dailyPlanner .dp-attendance-button:disabled{
      opacity:.45!important;
      cursor:not-allowed!important;
      transform:none!important;
      box-shadow:none!important;
    }
    #dailyPlanner .dp-card.dp-attendance-saving{opacity:.72}

    @media(max-width:900px){
      #dailyPlanner .dp-attendance-item>span:first-child{max-width:52px}
      #dailyPlanner .dp-attendance-button{width:23px!important;height:23px!important;min-width:23px!important;min-height:23px!important}
    }
  `;
  document.head.appendChild(style);

  const statusLabels = {
    present:"حاضر",
    absent:"غایب",
    excused:"مرخصی",
    pending:"هنوز ساعت برگزاری نرسیده"
  };
  const statusShort = { present:"ح", absent:"غ", excused:"م", pending:"" };

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date], input[type="date"][data-date], .daily-shell input[type="date"]');
    return input?.value || new Date().toLocaleDateString("en-CA");
  };

  const today = () => new Date().toLocaleDateString("en-CA");

  const isFuture = source => {
    const selected = selectedDate();
    if (selected > today()) return true;
    if (selected < today()) return false;
    const value = source.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
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

  const removeStudentSection = () => {
    const host = document.querySelector("#dailyPlanner #dpStudents");
    if (host) host.remove();
  };

  function decorate() {
    const studentCards = sourceCards();
    if (!studentCards.length) return;

    document.querySelectorAll("#dailyPlanner .dp-card").forEach(card => {
      if (card.querySelector(".dp-attendance-list")) return;

      const names = (card.querySelector("strong")?.textContent || "")
        .split("،")
        .map(v => v.trim())
        .filter(Boolean);
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
        label.title = source.dataset.studentName || "هنرجو";

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

    /* The source list is not shown to the registrar; the controls now live on the white cards. */
    removeStudentSection();
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
