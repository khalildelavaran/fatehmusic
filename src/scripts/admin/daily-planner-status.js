(() => {
  if (location.pathname !== "/admin/daily") return;

  const palette = [
    "#a78bfa",
    "#7dd3fc",
    "#f9a8d4",
    "#86efac",
    "#fcd34d",
    "#fb923c",
    "#c4b5fd",
    "#67e8f9"
  ];

  const instructorColors = new Map();
  let paletteIndex = 0;

  const css = document.createElement("style");
  css.textContent = `
    #dailyPlanner .dp-student-card {
      position: relative;
      overflow: hidden;
      border-color: rgba(255,255,255,.10);
      background: rgba(255,255,255,.045);
    }
    #dailyPlanner .dp-student-card::after {
      content: "";
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: 0;
      height: 4px;
      border-radius: 4px 4px 0 0;
      background: var(--dp-instructor-color, rgba(255,255,255,.28));
      box-shadow: 0 0 12px color-mix(in srgb, var(--dp-instructor-color, #fff) 35%, transparent);
    }
    #dailyPlanner .dp-student-card.dp-future {
      background: #fff;
      color: #202020;
      border-color: rgba(0,0,0,.10);
    }
    #dailyPlanner .dp-student-card.dp-future .dp-student-meta,
    #dailyPlanner .dp-student-card.dp-future .dp-status { opacity: .62; }
    #dailyPlanner .dp-student-card.dp-present {
      background: linear-gradient(135deg, rgba(47,143,70,.24), rgba(47,143,70,.08));
      border-color: rgba(47,143,70,.62);
    }
    #dailyPlanner .dp-student-card.dp-absent {
      background: linear-gradient(135deg, rgba(214,70,70,.25), rgba(214,70,70,.08));
      border-color: rgba(214,70,70,.62);
    }
    #dailyPlanner .dp-student-card.dp-excused {
      background: linear-gradient(135deg, rgba(59,130,246,.25), rgba(59,130,246,.08));
      border-color: rgba(59,130,246,.62);
    }
    #dailyPlanner .dp-student-card.dp-withdrawn {
      background: linear-gradient(135deg, rgba(120,120,120,.20), rgba(120,120,120,.07));
      border-color: rgba(120,120,120,.48);
    }
    #dailyPlanner .dp-student-card.dp-present .dp-status { color:#166534; border-color:rgba(47,143,70,.35); }
    #dailyPlanner .dp-student-card.dp-absent .dp-status { color:#991b1b; border-color:rgba(214,70,70,.35); }
    #dailyPlanner .dp-student-card.dp-excused .dp-status { color:#1d4ed8; border-color:rgba(59,130,246,.35); }
    #dailyPlanner .dp-student-card.dp-future .dp-status { color:#555; }
  `;
  document.head.appendChild(css);

  const instructorColor = (name) => {
    const key = String(name || "مدرس").trim();
    if (!instructorColors.has(key)) {
      instructorColors.set(key, palette[paletteIndex % palette.length]);
      paletteIndex += 1;
    }
    return instructorColors.get(key);
  };

  const parseMinutes = (value) => {
    const [h, m] = String(value || "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date], input[type="date"][data-date], input[type="date"]');
    return input?.value || todayKey();
  };

  const decorate = () => {
    const cards = document.querySelectorAll("#dailyPlanner .dp-student-card");
    if (!cards.length) return;

    const today = todayKey();
    const isToday = selectedDate() === today;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    cards.forEach(card => {
      const meta = card.querySelectorAll(".dp-student-meta");
      const instructor = meta[1]?.querySelector("span")?.textContent?.trim() || "مدرس";
      card.style.setProperty("--dp-instructor-color", instructorColor(instructor));
      card.dataset.instructorColor = instructorColor(instructor);

      card.classList.remove("dp-future", "dp-present", "dp-absent", "dp-excused", "dp-withdrawn");
      const status = (card.querySelector(".dp-status")?.textContent || "").trim();
      const timeText = meta[0]?.querySelectorAll("span")[1]?.textContent?.trim() || "";
      const start = parseMinutes(timeText.split(/[–-]/)[0]?.trim());

      if (status === "انصراف") {
        card.classList.add("dp-withdrawn");
        return;
      }

      // Before the lesson starts, attendance state must not visually override the white future card.
      if (isToday && start !== null && start > nowMinutes) {
        card.classList.add("dp-future");
        return;
      }

      if (status === "حاضر") card.classList.add("dp-present");
      else if (status === "غیبت") card.classList.add("dp-absent");
      else if (status === "مرخصی") card.classList.add("dp-excused");
      else card.classList.add("dp-future");
    });
  };

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", () => requestAnimationFrame(decorate), true);
  window.setInterval(decorate, 30000);
  requestAnimationFrame(decorate);
})();
