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
    #dailyPlanner .dp-student-card .dp-student-resize{position:absolute;top:0;bottom:0;width:14px;z-index:3;cursor:ew-resize;opacity:.2}
    #dailyPlanner .dp-student-card .dp-student-resize.start{left:0}
    #dailyPlanner .dp-student-card .dp-student-resize.end{right:0}
    #dailyPlanner .dp-student-card:hover .dp-student-resize{opacity:.75}
    #dailyPlanner .dp-student-card .dp-student-resize::after{content:"";position:absolute;top:22px;left:5px;width:3px;height:25px;border-radius:3px;background:var(--dp-instructor-color,#999)}
    #dailyPlanner .dp-student-card[data-editing="1"]{cursor:grabbing;box-shadow:0 12px 28px rgba(0,0,0,.22);z-index:20}
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

  const correctGridLines = () => {
    const labels = [...document.querySelectorAll("#dailyPlanner .dp-hours .dp-hour")];
    const count = labels.length;
    if (count < 2) return;
    const step = 100 / (count - 1);
    const majorStep = step * 4;
    document.querySelectorAll("#dailyPlanner .dp-track").forEach(track => {
      track.style.backgroundImage = `repeating-linear-gradient(to right, rgba(255,255,255,.075) 0, rgba(255,255,255,.075) 1px, transparent 1px, transparent ${step}%), repeating-linear-gradient(to right, rgba(212,175,55,.16) 0, rgba(212,175,55,.16) 1px, transparent 1px, transparent ${majorStep}%)`;
    });
  };

  const decorate = () => {
    correctGridLines();
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
      if (!isToday || start === null || start > nowMinutes) { card.classList.add("dp-future"); statusEl?.replaceChildren(document.createTextNode("هنوز نرسیده")); return; }
      if (statusEl) statusEl.replaceChildren(document.createTextNode(statusLabel(status)));
      if (status === "حاضر") card.classList.add("dp-present");
      else if (status === "غیبت") card.classList.add("dp-absent");
      else if (status === "مرخصی") card.classList.add("dp-excused");
      else card.classList.add("dp-future");
    });
  };

  const statusLabel = (status) => ({حاضر:"حاضر",غیبت:"غیبت",مرخصی:"مرخصی",انصراف:"انصراف"}[status] || status || "ثبت نشده");

  const findSessionCard = (studentCard) => {
    const name = studentCard.dataset.studentName || "";
    const studentTime = studentCard.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
    const cards = [...document.querySelectorAll("#dailyPlanner .dp-card")];
    return cards.find(card => card.textContent.includes(name) && card.querySelector("time")?.textContent?.trim() === studentTime) || cards.find(card => card.textContent.includes(name));
  };

  const saveSession = async (sessionId,startTime,endTime) => {
    const response = await fetch("/api/admin/daily-planner",{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({sessionId,sessionDate:selectedDate(),startTime,endTime})});
    const data = await response.json().catch(()=>({}));
    if(!response.ok||!data.success) throw new Error(data.message||"ذخیره زمان ناموفق بود");
  };

  const rangeFromTimeline = () => {
    const labels=[...document.querySelectorAll("#dailyPlanner .dp-hours .dp-hour")].map(el=>el.textContent.trim()).filter(Boolean);
    return labels.length>=2 ? {start:parseMinutes(labels[0]),end:parseMinutes(labels[labels.length-1])} : {start:960,end:1320};
  };

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
      const text=`${formatTime(start)}–${formatTime(end)}`;card.querySelector(".dp-student-meta span[dir='ltr']").textContent=text;current.querySelector("time").textContent=text;
    });
    card.addEventListener("pointerup",async event=>{
      if(!mode||event.pointerId!==pointerId)return;
      const current=findSessionCard(card),text=card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim()||"",[newStart,newEnd]=text.split("–");
      const changed=newStart!==oldStart||newEnd!==oldEnd;mode=null;pointerId=null;delete card.dataset.editing;
      if(changed&&current?.dataset.sessionId){try{await saveSession(current.dataset.sessionId,newStart,newEnd);}catch{card.querySelector(".dp-student-meta span[dir='ltr']").textContent=`${oldStart}–${oldEnd}`;current.querySelector("time").textContent=`${oldStart}–${oldEnd}`;}}
    });
    card.addEventListener("pointercancel",()=>{mode=null;pointerId=null;delete card.dataset.editing;});
  };

  const enhance = () => {
    correctGridLines();
    document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(bindEditor);
    decorate();
  };

  const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
  observer.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance,{once:true});else enhance();
  setInterval(decorate,30000);
})();
