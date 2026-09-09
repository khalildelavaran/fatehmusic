(() => {
  if (location.pathname !== "/admin/daily") return;

  const palette = ["#a78bfa", "#7dd3fc", "#f9a8d4", "#86efac", "#fcd34d", "#fb923c", "#c4b5fd", "#67e8f9"];
  const instructorColors = new Map();
  let paletteIndex = 0;
  const parseMinutes = (value) => { const [h,m]=String(value||"").split(":").map(Number); return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null; };
  const formatTime = (value) => `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
  const snap = (value) => Math.round(value/15)*15;
  const todayKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

  const css = document.createElement("style");
  css.textContent = `
    #dailyPlanner .dp-student-card{position:relative;overflow:hidden;touch-action:none;cursor:grab}
    #dailyPlanner .dp-student-card::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:4px;border-radius:4px 4px 0 0;background:var(--dp-instructor-color,rgba(255,255,255,.28));box-shadow:0 0 12px color-mix(in srgb,var(--dp-instructor-color,#fff) 35%,transparent)}
    #dailyPlanner .dp-student-card.dp-future{background:#fff;color:#202020;border-color:rgba(0,0,0,.10)}
    #dailyPlanner .dp-student-card.dp-future .dp-student-meta,#dailyPlanner .dp-student-card.dp-future .dp-status{opacity:.62}
    #dailyPlanner .dp-student-card.dp-present{background:linear-gradient(135deg,rgba(47,143,70,.24),rgba(47,143,70,.08));border-color:rgba(47,143,70,.62)}
    #dailyPlanner .dp-student-card.dp-absent{background:linear-gradient(135deg,rgba(214,70,70,.25),rgba(214,70,70,.08));border-color:rgba(214,70,70,.62)}
    #dailyPlanner .dp-student-card.dp-excused{background:linear-gradient(135deg,rgba(59,130,246,.25),rgba(59,130,246,.08));border-color:rgba(59,130,246,.62)}
    #dailyPlanner .dp-student-card.dp-withdrawn{background:linear-gradient(135deg,rgba(120,120,120,.20),rgba(120,120,120,.07));border-color:rgba(120,120,120,.48)}
    #dailyPlanner .dp-student-card.dp-present .dp-status{color:#166534;border-color:rgba(47,143,70,.35)}
    #dailyPlanner .dp-student-card.dp-absent .dp-status{color:#991b1b;border-color:rgba(214,70,70,.35)}
    #dailyPlanner .dp-student-card.dp-excused .dp-status{color:#1d4ed8;border-color:rgba(59,130,246,.35)}
    #dailyPlanner .dp-student-card.dp-future .dp-status{color:#555}
    /* The resize hit areas remain functional, but the visible inner line is removed. */
    #dailyPlanner .dp-student-card .dp-student-resize{position:absolute;top:0;bottom:0;width:14px;z-index:3;cursor:ew-resize;opacity:0;background:transparent}
    #dailyPlanner .dp-student-card .dp-student-resize.start{left:-1px}
    #dailyPlanner .dp-student-card .dp-student-resize.end{right:-1px}
    #dailyPlanner .dp-student-card:hover .dp-student-resize{opacity:0}
    #dailyPlanner .dp-student-card .dp-student-resize::after{display:none!important}
    #dailyPlanner .dp-student-card[data-editing="1"]{cursor:grabbing;box-shadow:0 12px 28px rgba(0,0,0,.22);z-index:20}

    /* Exactly three room timelines. */
    #dailyPlanner .dp-room-label strong{font-size:13px}
    #dailyPlanner .dp-room-label small{font-size:10px;opacity:.5}
    #dailyPlanner .dp-row.dp-forced-room{min-height:94px}
    #dailyPlanner .dp-row.dp-forced-room .dp-track{min-height:94px}

    /* Deterministic 15-minute grid. Lines are generated from the actual timeline width. */
    #dailyPlanner .dp-track{background-image:none!important;background-size:auto!important;background-repeat:repeat!important}
    #dailyPlanner .dp-track::after{content:none!important}

    @media(max-width:700px){#dailyPlanner .dp-students-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  const instructorColor = (name) => {
    const key = String(name || "مدرس").trim();
    if (!instructorColors.has(key)) { instructorColors.set(key,palette[paletteIndex%palette.length]); paletteIndex+=1; }
    return instructorColors.get(key);
  };

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date], input[type="date"][data-date], .daily-shell input[type="date"]');
    return input?.value || todayKey();
  };

  const timelineRange = () => {
    const labels = [...document.querySelectorAll("#dailyPlanner .dp-hours .dp-hour")];
    const values = labels.map(el => parseMinutes(el.textContent.trim())).filter(Number.isFinite);
    if (values.length >= 2) return { start: values[0], end: values[values.length - 1] };
    return { start: 960, end: 1320 };
  };

  const drawUniformGrid = () => {
    const labels = [...document.querySelectorAll("#dailyPlanner .dp-hours .dp-hour")];
    if (labels.length < 2) return;
    const first = labels[0];
    const last = labels[labels.length - 1];
    const host = first.parentElement;
    const hostRect = host?.getBoundingClientRect();
    if (!hostRect?.width) return;
    const x0 = first.getBoundingClientRect().left - hostRect.left;
    const x1 = last.getBoundingClientRect().left - hostRect.left;
    const stepPx = (x1 - x0) / (labels.length - 1);
    if (!Number.isFinite(stepPx) || stepPx <= 0) return;

    document.querySelectorAll("#dailyPlanner .dp-track").forEach(track => {
      const width = track.getBoundingClientRect().width;
      if (!width) return;
      const ratio = Math.max(0.0001, stepPx / hostRect.width);
      const minor = `${(ratio * 100).toFixed(6)}%`;
      const major = `${(ratio * 4 * 100).toFixed(6)}%`;
      track.style.backgroundImage = `repeating-linear-gradient(to right, rgba(255,255,255,.075) 0, rgba(255,255,255,.075) 1px, transparent 1px, transparent ${minor}), repeating-linear-gradient(to right, rgba(212,175,55,.16) 0, rgba(212,175,55,.16) 1px, transparent 1px, transparent ${major})`;
      track.style.backgroundSize = `${minor} 100%, ${major} 100%`;
      track.style.backgroundRepeat = "repeat-x, repeat-x";
      track.style.backgroundPosition = "0 0, 0 0";
    });
  };

  const normalizeRooms = () => {
    const grid = document.querySelector("#dailyPlanner #dpGrid");
    const body = grid?.querySelector(".dp-body");
    if (!body) return;

    const existing = [...body.querySelectorAll(":scope > .dp-row")];
    const byRoom = new Map();
    const fallback = [];
    existing.forEach(row => {
      const label = row.querySelector(".dp-room-label strong")?.textContent?.trim() || "";
      const match = label.match(/(?:اتاق\s*)?([1-3])$/);
      if (match) byRoom.set(Number(match[1]), row);
      else fallback.push(row);
    });

    for (let n=1;n<=3;n++) {
      if (!byRoom.has(n) && fallback.length) byRoom.set(n, fallback.shift());
    }

    const rows = [];
    for (let n=1;n<=3;n++) {
      let row = byRoom.get(n);
      if (!row) {
        row = document.createElement("div");
        row.className = "dp-row dp-forced-room";
        row.style.height = "94px";
        row.innerHTML = `<div class="dp-row-label dp-room-label"><strong>اتاق ${n}</strong><small>0 جلسه</small></div><div class="dp-track"></div>`;
      }
      row.classList.add("dp-forced-room");
      row.querySelector(".dp-room-label strong")?.replaceChildren(document.createTextNode(`اتاق ${n}`));
      const small = row.querySelector(".dp-room-label small");
      if (small && !small.textContent.trim()) small.textContent = "0 جلسه";
      rows.push(row);
    }

    body.replaceChildren(...rows);
  };

  const preventTimelineOverlap = () => {
    document.querySelectorAll("#dailyPlanner .dp-row").forEach(row => {
      const cards = [...row.querySelectorAll(".dp-card")];
      if (!cards.length) return;
      const groups = [];
      cards.forEach(card => {
        const top = parseFloat(card.style.top || "0");
        const height = Math.max(card.getBoundingClientRect().height || 64, 64);
        let group = groups.find(g => top < g.bottom + 1 && top + height > g.top - 1);
        if (!group) { group = { top, bottom: top + height, cards: [] }; groups.push(group); }
        group.cards.push(card);
        group.top = Math.min(group.top, top);
        group.bottom = Math.max(group.bottom, top + height);
      });
      const minGap = 10;
      const required = Math.max(94, groups.reduce((max,g)=>Math.max(max,g.bottom),0) + minGap);
      row.style.height = `${required}px`;
    });
  };

  const statusLabel = (status) => ({حاضر:"حاضر",غیبت:"غیبت",مرخصی:"مرخصی",انصراف:"انصراف"}[status] || status || "ثبت نشده");

  const decorate = () => {
    drawUniformGrid();
    const cards = document.querySelectorAll("#dailyPlanner .dp-student-card");
    const today = todayKey(), isToday = selectedDate() === today, now = new Date(), nowMinutes = now.getHours()*60+now.getMinutes();
    cards.forEach(card => {
      const meta = card.querySelectorAll(".dp-student-meta");
      const instructor = meta[1]?.querySelector("span")?.textContent?.trim() || "مدرس";
      card.style.setProperty("--dp-instructor-color",instructorColor(instructor));
      card.classList.remove("dp-future","dp-present","dp-absent","dp-excused","dp-withdrawn");
      const statusEl = card.querySelector(".dp-status");
      if (statusEl && !card.dataset.attendanceStatus) card.dataset.attendanceStatus = statusEl.textContent.trim();
      const status = card.dataset.attendanceStatus || "";
      const timeText = meta[0]?.querySelectorAll("span")[1]?.textContent?.trim() || "";
      const start = parseMinutes(timeText.split(/[–-]/)[0]?.trim());
      if (status === "انصراف") { card.classList.add("dp-withdrawn"); return; }
      if (!isToday || start === null || start > nowMinutes) {
        card.classList.add("dp-future");
        if (statusEl && statusEl.textContent.trim() !== "هنوز نرسیده") statusEl.textContent = "هنوز نرسیده";
        return;
      }
      if (statusEl) {
        const label = statusLabel(status);
        if (statusEl.textContent.trim() !== label) statusEl.textContent = label;
      }
      if (status === "حاضر") card.classList.add("dp-present");
      else if (status === "غیبت") card.classList.add("dp-absent");
      else if (status === "مرخصی") card.classList.add("dp-excused");
      else card.classList.add("dp-future");
    });
  };

  const findSessionCard = (studentCard) => {
    const name = studentCard.dataset.studentName || "";
    const studentTime = studentCard.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
    const cards = [...document.querySelectorAll("#dailyPlanner .dp-card")];
    return cards.find(card => card.textContent.includes(name) && card.querySelector("time")?.textContent?.trim() === studentTime) || cards.find(card => card.textContent.includes(name));
  };

  const findStudentCardsForSession = (sessionCard, oldTime = "") => {
    const nameText = sessionCard.querySelector("strong")?.textContent?.trim() || "";
    const currentTime = sessionCard.querySelector("time")?.textContent?.trim() || oldTime;
    return [...document.querySelectorAll("#dailyPlanner .dp-student-card")].filter(card => {
      if ((card.dataset.studentName || "") && nameText && !nameText.includes(card.dataset.studentName)) return false;
      const timeText = card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
      return timeText === currentTime || (oldTime && timeText === oldTime);
    });
  };

  const syncStudentCards = (sessionCard, oldTime = "") => {
    const newTime = sessionCard.querySelector("time")?.textContent?.trim() || "";
    if (!newTime) return;
    findStudentCardsForSession(sessionCard, oldTime).forEach(card => {
      const timeEl = card.querySelector(".dp-student-meta span[dir='ltr']");
      if (timeEl && timeEl.textContent.trim() !== newTime) timeEl.textContent = newTime;
    });
  };

  const saveSession = async (sessionId,startTime,endTime) => {
    const response = await fetch("/api/admin/daily-planner",{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({sessionId,sessionDate:selectedDate(),startTime,endTime})});
    const data = await response.json().catch(()=>({}));
    if(!response.ok||!data.success) throw new Error(data.message||"ذخیره زمان ناموفق بود");
  };

  const rangeFromTimeline = () => timelineRange();

  const bindEditor = (card) => {
    if(card.dataset.studentEditor === "1") return;
    const source=findSessionCard(card); if(!source) return;
    card.dataset.studentEditor="1";
    ["start","end"].forEach(side=>{const handle=document.createElement("i");handle.className=`dp-student-resize ${side}`;handle.dataset.resize=side;card.appendChild(handle);});
    card.title="برای جابه‌جایی زمان بکشید؛ از لبه‌ها برای تغییر مدت استفاده کنید";
    let mode=null,pointerId=null,oldStart="",oldEnd="";
    card.addEventListener("pointerdown",event=>{
      const current=findSessionCard(card); if(!current)return;
      [oldStart,oldEnd]=(current.querySelector("time")?.textContent?.trim()||"").split("–");
      mode=event.target.closest(".dp-student-resize")?.dataset.resize||"move";pointerId=event.pointerId;card.setPointerCapture?.(pointerId);card.dataset.editing="1";event.preventDefault();
    });
    card.addEventListener("pointermove",event=>{
      if(!mode||event.pointerId!==pointerId)return;
      const current=findSessionCard(card);if(!current)return;
      const track=current.parentElement,rect=track.getBoundingClientRect(),range=rangeFromTimeline();
      const raw=range.start+((event.clientX-rect.left)/Math.max(1,rect.width))*(range.end-range.start),value=Math.max(range.start,Math.min(range.end,snap(raw)));
      let start=parseMinutes(oldStart),end=parseMinutes(oldEnd);
      if(mode==="move"){const duration=end-start;start=Math.max(range.start,Math.min(range.end-duration,value));end=start+duration;}
      else if(mode==="start") start=Math.max(range.start,Math.min(end-15,value));
      else end=Math.max(start+15,Math.min(range.end,value));
      const text=`${formatTime(start)}–${formatTime(end)}`;
      const studentTime=card.querySelector(".dp-student-meta span[dir='ltr']");
      if(studentTime) studentTime.textContent=text;
      current.querySelector("time").textContent=text;
    });
    card.addEventListener("pointerup",async event=>{
      if(!mode||event.pointerId!==pointerId)return;
      const current=findSessionCard(card),text=card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim()||"",[newStart,newEnd]=text.split("–");
      const changed=newStart!==oldStart||newEnd!==oldEnd;mode=null;pointerId=null;delete card.dataset.editing;
      if(changed&&current?.dataset.sessionId){try{await saveSession(current.dataset.sessionId,newStart,newEnd);syncStudentCards(current,`${oldStart}–${oldEnd}`);}catch{const oldText=`${oldStart}–${oldEnd}`;const studentTime=card.querySelector(".dp-student-meta span[dir='ltr']");if(studentTime)studentTime.textContent=oldText;current.querySelector("time").textContent=oldText;}}
    });
    card.addEventListener("pointercancel",()=>{mode=null;pointerId=null;delete card.dataset.editing;});
  };

  let enhancing = false;
  let queued = false;
  const enhance = () => {
    if (enhancing) return;
    enhancing = true;
    try {
      normalizeRooms();
      preventTimelineOverlap();
      correctCardStudentTimes();
      document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(bindEditor);
      decorate();
      drawUniformGrid();
    } finally { enhancing = false; }
  };

  const correctCardStudentTimes = () => {
    document.querySelectorAll("#dailyPlanner .dp-card").forEach(sessionCard => syncStudentCards(sessionCard));
  };

  let observerTimer = null;
  const observer = new MutationObserver(records => {
    const meaningful = records.some(record => [...record.addedNodes,...record.removedNodes].some(node => node.nodeType === 1 && !node.matches?.(".dp-status, .dp-student-resize")));
    if (!meaningful) return;
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => { if (!enhancing) requestAnimationFrame(enhance); }, 0);
  });
  const observeTarget = document.querySelector("#dailyPlanner") || document.body;
  observer.observe(observeTarget,{childList:true,subtree:true});

  window.addEventListener("resize", () => { clearTimeout(observerTimer); observerTimer = setTimeout(() => requestAnimationFrame(() => { drawUniformGrid(); preventTimelineOverlap(); }), 50); });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance,{once:true});else enhance();
  setInterval(decorate,30000);
})();
