(() => {
  if (location.pathname !== "/admin/daily") return;

  const palettes = ["#a855f7", "#38bdf8", "#ec4899", "#22c55e", "#f59e0b", "#14b8a6", "#f97316", "#8b5cf6"];
  const minutes = (value) => { const [h, m] = String(value || "00:00").split(":").map(Number); return h * 60 + m; };
  const time = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const snap = (value) => Math.round(value / 15) * 15;
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const instructorColor = (value) => { let hash=0; const key=String(value||""); for(let i=0;i<key.length;i++) hash=((hash<<5)-hash+key.charCodeAt(i))|0; return palettes[Math.abs(hash)%palettes.length]; };

  const style = document.createElement("style");
  style.textContent = `
    #dailyPlanner .dp-track{background-image:none!important}
    #dailyPlanner .dp-track::after{display:none!important}
    #dailyPlanner .dp-student-card{position:relative;overflow:hidden;touch-action:none;cursor:grab;background:#fff!important;color:#171717!important;border:1px solid rgba(0,0,0,.10)!important;box-shadow:0 7px 20px rgba(0,0,0,.10)}
    #dailyPlanner .dp-student-card[data-time-state="present"]{background:linear-gradient(135deg,#dcfce7,#bbf7d0)!important;border-color:#22c55e!important}
    #dailyPlanner .dp-student-card[data-time-state="absent"]{background:linear-gradient(135deg,#fee2e2,#fecaca)!important;border-color:#ef4444!important}
    #dailyPlanner .dp-student-card[data-time-state="excused"]{background:linear-gradient(135deg,#dbeafe,#bfdbfe)!important;border-color:#3b82f6!important}
    #dailyPlanner .dp-student-card[data-time-state="withdrawn"]{background:#e5e7eb!important;color:#4b5563!important;opacity:.7}
    #dailyPlanner .dp-student-card::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:4px;border-radius:4px 4px 0 0;background:var(--dp-instructor-color,#a855f7)}
    #dailyPlanner .dp-student-card .dp-student-resize{position:absolute;top:0;bottom:0;width:14px;z-index:3;cursor:ew-resize;opacity:.25}
    #dailyPlanner .dp-student-card .dp-student-resize.start{left:0}
    #dailyPlanner .dp-student-card .dp-student-resize.end{right:0}
    #dailyPlanner .dp-student-card:hover .dp-student-resize{opacity:.7}
    #dailyPlanner .dp-student-card .dp-student-resize::after{content:"";position:absolute;top:24px;left:5px;width:3px;height:25px;border-radius:3px;background:var(--dp-instructor-color,#a855f7)}
    #dailyPlanner .dp-student-card[data-editing="1"]{cursor:grabbing;box-shadow:0 12px 28px rgba(0,0,0,.2);z-index:20}
  `;
  document.head.appendChild(style);

  function rangeFromTimeline() {
    const labels = [...document.querySelectorAll("#dailyPlanner .dp-hours .dp-hour")].map(el => el.textContent.trim()).filter(Boolean);
    if (labels.length < 2) return { start: 16*60, end: 22*60 };
    return { start: minutes(labels[0]), end: minutes(labels[labels.length-1]) };
  }

  function correctGridLines() {
    const quarterCount = Math.max(1, document.querySelectorAll("#dailyPlanner .dp-hours .dp-hour").length - 1);
    const q = `calc(100% / ${quarterCount})`;
    document.querySelectorAll("#dailyPlanner .dp-track").forEach(track => {
      track.style.backgroundImage = `repeating-linear-gradient(to right,rgba(255,255,255,.075) 0,rgba(255,255,255,.075) 1px,transparent 1px,transparent ${q})`;
      track.style.setProperty("--dp-quarter", q);
    });
  }

  function currentPageDate() {
    const input = document.querySelector(".daily-shell input[type=date]");
    return input?.value || localDate();
  }

  function stateFor(card) {
    const timeText = card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
    const [start] = timeText.split("–").map(minutes);
    const status = card.dataset.status || "pending";
    const now = new Date();
    const nowMinutes = now.getHours()*60 + now.getMinutes();
    const future = currentPageDate() !== localDate() || start > nowMinutes;
    return future ? "future" : (["present","absent","excused","withdrawn"].includes(status) ? status : "future");
  }

  function applyStatus(card) {
    const state = stateFor(card);
    card.dataset.timeState = state;
    const label = card.querySelector(".dp-status");
    if (label) label.textContent = state === "future" ? "هنوز نرسیده" : ({present:"حاضر",absent:"غیبت",excused:"مرخصی",withdrawn:"انصراف"}[state] || "ثبت نشده");
  }

  function findSessionCard(studentCard) {
    const name = studentCard.dataset.studentName || "";
    const studentTime = studentCard.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() || "";
    const cards = [...document.querySelectorAll("#dailyPlanner .dp-card")];
    return cards.find(card => card.textContent.includes(name) && card.querySelector("time")?.textContent?.trim() === studentTime) || cards.find(card => card.textContent.includes(name));
  }

  async function save(sessionId, startTime, endTime) {
    const response = await fetch("/api/admin/daily-planner", { method:"PATCH", credentials:"same-origin", headers:{"content-type":"application/json",accept:"application/json"}, body:JSON.stringify({sessionId,sessionDate:currentPageDate(),startTime,endTime}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.success) throw new Error(data.message || "ذخیره زمان ناموفق بود");
  }

  function bind(card) {
    if (card.dataset.studentEditor === "1") return;
    const sessionCard = findSessionCard(card);
    if (!sessionCard) return;
    card.dataset.studentEditor = "1";
    const instructorText = sessionCard.querySelector("span")?.textContent || sessionCard.textContent;
    card.style.setProperty("--dp-instructor-color", instructorColor(instructorText));
    ["start","end"].forEach(side => { const handle=document.createElement("i"); handle.className=`dp-student-resize ${side}`; handle.dataset.resize=side; card.appendChild(handle); });
    card.title = "برای جابه‌جایی زمان بکشید؛ از لبه‌ها برای تغییر مدت استفاده کنید";

    let mode=null,pointerId=null,oldStart="",oldEnd="";
    card.addEventListener("pointerdown", event => {
      const source=findSessionCard(card); if(!source) return;
      const value=source.querySelector("time")?.textContent?.trim()||""; [oldStart,oldEnd]=value.split("–");
      mode=event.target.closest(".dp-student-resize")?.dataset.resize||"move"; pointerId=event.pointerId; card.setPointerCapture?.(pointerId); card.dataset.editing="1"; event.preventDefault();
    });
    card.addEventListener("pointermove", event => {
      if(!mode || event.pointerId!==pointerId) return;
      const source=findSessionCard(card); if(!source) return;
      const track=source.parentElement,rect=track.getBoundingClientRect(),range=rangeFromTimeline();
      const raw=range.start+((event.clientX-rect.left)/Math.max(1,rect.width))*(range.end-range.start),value=Math.max(range.start,Math.min(range.end,snap(raw)));
      let start=minutes(oldStart),end=minutes(oldEnd);
      if(mode==="move"){const duration=end-start;start=Math.max(range.start,Math.min(range.end-duration,value));end=start+duration;}
      else if(mode==="start") start=Math.max(range.start,Math.min(end-15,value));
      else end=Math.max(start+15,Math.min(range.end,value));
      const text=`${time(start)}–${time(end)}`;
      card.querySelector(".dp-student-meta span[dir='ltr']").textContent=text;
      source.querySelector("time").textContent=text;
    });
    card.addEventListener("pointerup", async event => {
      if(!mode || event.pointerId!==pointerId) return;
      const source=findSessionCard(card); const text=card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim()||""; const [newStart,newEnd]=text.split("–");
      const changed=newStart!==oldStart || newEnd!==oldEnd; mode=null;pointerId=null;delete card.dataset.editing;
      if(changed && source?.dataset.sessionId){
        try{await save(source.dataset.sessionId,newStart,newEnd);}
        catch{card.querySelector(".dp-student-meta span[dir='ltr']").textContent=`${oldStart}–${oldEnd}`;source.querySelector("time").textContent=`${oldStart}–${oldEnd}`;}
      }
    });
    card.addEventListener("pointercancel",()=>{mode=null;pointerId=null;delete card.dataset.editing;});
  }

  function enhance() {
    correctGridLines();
    document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(card=>{bind(card);applyStatus(card);});
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
  observer.observe(document.body,{childList:true,subtree:true});
  const start=()=>{const planner=document.querySelector("#dailyPlanner");if(planner)new MutationObserver(enhance).observe(planner,{childList:true,subtree:true});enhance();};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  setInterval(()=>document.querySelectorAll("#dailyPlanner .dp-student-card").forEach(applyStatus),30000);
})();
