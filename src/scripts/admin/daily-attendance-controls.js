(() => {
  if (location.pathname !== "/admin/daily") return;

  const STYLE_ID = "daily-attendance-controls-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #dailyPlanner #dpStudents{display:none!important}
      #dailyPlanner .dp-card{background:#fff!important;color:#202020!important;border-color:rgba(0,0,0,.12)!important;box-shadow:0 6px 18px rgba(0,0,0,.08)}
      #dailyPlanner .dp-card>strong,#dailyPlanner .dp-card>span,#dailyPlanner .dp-card>time{color:#202020!important}
      #dailyPlanner .dp-card .dp-attendance-list{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:7px;direction:rtl}
      #dailyPlanner .dp-card .dp-attendance-item{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#333;white-space:nowrap}
      #dailyPlanner .dp-card .dp-attendance-buttons{display:inline-flex;gap:4px;direction:rtl}
      #dailyPlanner .dp-card .dp-attendance-button{width:24px;height:24px;padding:0;border-radius:50%;border:1px solid rgba(0,0,0,.18);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font:700 10px/1 inherit;box-sizing:border-box;transition:transform .12s,box-shadow .12s,border-color .12s;touch-action:manipulation}
      #dailyPlanner .dp-card .dp-attendance-button:hover{transform:scale(1.08);box-shadow:0 3px 8px rgba(0,0,0,.15)}
      #dailyPlanner .dp-card .dp-attendance-button.active{box-shadow:0 0 0 2px rgba(0,0,0,.18);border-color:rgba(0,0,0,.35)}
      #dailyPlanner .dp-card .dp-attendance-button.present{background:#25a244;color:#fff}
      #dailyPlanner .dp-card .dp-attendance-button.absent{background:#d62828;color:#fff}
      #dailyPlanner .dp-card .dp-attendance-button.excused{background:#3b82f6;color:#fff}
      #dailyPlanner .dp-card .dp-attendance-button.pending{background:#fff;color:#555}
      #dailyPlanner .dp-card .dp-attendance-button:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
      #dailyPlanner .dp-card.dp-attendance-saving{opacity:.72}
    `;
    document.head.appendChild(style);
  }

  const esc = value => { const d=document.createElement("div"); d.textContent=String(value??""); return d.innerHTML; };
  const statusLabels = { present:"حاضر", absent:"غایب", excused:"مرخصی", pending:"هنوز نرسیده" };
  const statusShort = { present:"ح", absent:"غ", excused:"م", pending:"" };

  const getStudentCards = () => [...document.querySelectorAll("#dailyPlanner .dp-student-card")];

  const findStudentCard = (name, timeText) => {
    const cards = getStudentCards();
    return cards.find(card => (card.dataset.studentName||"") === name && card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim() === timeText)
      || cards.find(card => (card.dataset.studentName||"") === name)
      || null;
  };

  const selectedDate = () => {
    const input = document.querySelector('input[type="date"][data-daily-date], input[type="date"][data-date], .daily-shell input[type="date"]');
    return input?.value || new Date().toLocaleDateString("en-CA");
  };

  const setSave = (text, cls="") => {
    const el=document.querySelector("#dpSave");
    if(el){el.textContent=text;el.className=`dp-save ${cls}`;}
  };

  async function saveAttendance(card, status) {
    const enrollmentSessionId=Number(card.dataset.studentSession||0);
    const enrollmentId=Number(card.dataset.enrollmentId||0);
    if(!enrollmentSessionId) throw new Error("شناسه رکورد حضور هنرجو پیدا نشد.");
    const response=await fetch("/api/admin/daily-planner",{
      method:"POST",
      credentials:"same-origin",
      headers:{"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({enrollmentSessionId,enrollmentId,status})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success) throw new Error(data.message||"ذخیره وضعیت حضور ناموفق بود.");
    return data;
  }

  function isFuture(card) {
    const timeText=card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim()||"";
    const match=timeText.match(/^(\d{1,2}):(\d{2})/);
    if(!match) return false;
    const selected=selectedDate();
    const today=new Date().toLocaleDateString("en-CA");
    if(selected!==today) return selected>today;
    const start=Number(match[1])*60+Number(match[2]);
    const now=new Date();
    return start>now.getHours()*60+now.getMinutes();
  }

  function addControls(card) {
    if(card.dataset.attendanceControls==="1") return;
    const name=card.dataset.studentName||card.querySelector(".dp-student-name")?.textContent?.trim()||"";
    const timeText=card.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim()||"";
    const source=findStudentCard(name,timeText)||card;
    const current=source.dataset.attendanceStatus||"pending";
    const future=isFuture(source);
    const wrap=document.createElement("div");
    wrap.className="dp-attendance-list";
    wrap.dataset.attendanceControls="1";
    wrap.innerHTML=`<span class="dp-attendance-item"><span class="dp-attendance-buttons">
      <button class="dp-attendance-button present" type="button" data-attendance="present" aria-label="${statusLabels.present}" title="${statusLabels.present}">${statusShort.present}</button>
      <button class="dp-attendance-button absent" type="button" data-attendance="absent" aria-label="${statusLabels.absent}" title="${statusLabels.absent}">${statusShort.absent}</button>
      <button class="dp-attendance-button excused" type="button" data-attendance="excused" aria-label="${statusLabels.excused}" title="${statusLabels.excused}">${statusShort.excused}</button>
      <button class="dp-attendance-button pending" type="button" data-attendance="pending" aria-label="${statusLabels.pending}" title="${statusLabels.pending}"></button>
    </span></span>`;
    card.appendChild(wrap);
    card.dataset.attendanceControls="1";
    const buttons=[...wrap.querySelectorAll("button[data-attendance]")];
    if(future){
      buttons.forEach(button=>{button.disabled=button.dataset.attendance!=="pending";});
    }
    buttons.forEach(button=>{
      if(button.dataset.attendance===current && (!future || current==="pending")) button.classList.add("active");
      button.addEventListener("pointerdown",event=>event.stopPropagation());
      button.addEventListener("click",async event=>{
        event.preventDefault();
        event.stopPropagation();
        const status=button.dataset.attendance;
        if(future && status!=="pending") return;
        card.classList.add("dp-attendance-saving");
        buttons.forEach(b=>b.disabled=true);
        try{
          await saveAttendance(source,status);
          source.dataset.attendanceStatus=status;
          card.dataset.attendanceStatus=status;
          buttons.forEach(b=>b.classList.toggle("active",b.dataset.attendance===status));
          setSave("ذخیره شد","is-saved");
          if(status!=="pending") setTimeout(()=>setSave("آماده",""),900);
        }catch(error){
          setSave(error instanceof Error?error.message:"ذخیره حضور ناموفق بود","is-error");
          buttons.forEach(b=>b.disabled=false);
          if(future) buttons.forEach(b=>{b.disabled=b.dataset.attendance!=="pending";});
        }finally{card.classList.remove("dp-attendance-saving");}
      });
    });
  }

  function decorate() {
    const cards=[...document.querySelectorAll("#dailyPlanner .dp-card")];
    cards.forEach(card=>{
      const names=(card.querySelector("strong")?.textContent||"").split("،").map(x=>x.trim()).filter(Boolean);
      const timeText=card.querySelector("time")?.textContent?.trim()||"";
      if(!names.length) return;
      // One attendance control group per student is required when a lesson has multiple students.
      const existing=card.querySelector(".dp-attendance-list");
      if(existing) return;
      const sources=names.map(name=>findStudentCard(name,timeText)).filter(Boolean);
      if(!sources.length) return;
      sources.forEach(source=>{
        const proxy=card.cloneNode(false);
        proxy.dataset.studentName=source.dataset.studentName||"";
        proxy.dataset.studentSession=source.dataset.studentSession||"";
        proxy.dataset.enrollmentId=source.dataset.enrollmentId||"";
        proxy.dataset.attendanceStatus=source.dataset.attendanceStatus||"pending";
        addControls(proxy);
      });
      const controls=[...card.querySelectorAll(".dp-attendance-list")];
      // Replace proxy-only construction with compact inline controls.
      if(controls.length){
        controls.forEach(c=>c.remove());
        const holder=document.createElement("div");
        holder.className="dp-attendance-list";
        sources.forEach(source=>{
          const item=document.createElement("span");
          item.className="dp-attendance-item";
          const name=document.createElement("span"); name.textContent=source.dataset.studentName||"هنرجو";
          const buttons=document.createElement("span"); buttons.className="dp-attendance-buttons";
          ["present","absent","excused","pending"].forEach(status=>{
            const b=document.createElement("button"); b.type="button"; b.className=`dp-attendance-button ${status}`; b.dataset.attendance=status; b.title=statusLabels[status]; b.setAttribute("aria-label",`${statusLabels[status]} ${source.dataset.studentName||"هنرجو"}`); b.textContent=statusShort[status];
            if(source.dataset.attendanceStatus===status && (!isFuture(source)||status==="pending")) b.classList.add("active");
            if(isFuture(source)) b.disabled=status!=="pending";
            b.addEventListener("pointerdown",e=>e.stopPropagation());
            b.addEventListener("click",async e=>{
              e.preventDefault();e.stopPropagation();
              if(isFuture(source)&&status!=="pending")return;
              buttons.querySelectorAll("button").forEach(x=>x.disabled=true);
              try{await saveAttendance(source,status);source.dataset.attendanceStatus=status;b.classList.add("active");buttons.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));setSave("ذخیره شد","is-saved");setTimeout(()=>setSave("آماده",""),900);}
              catch(error){setSave(error instanceof Error?error.message:"ذخیره حضور ناموفق بود","is-error");buttons.querySelectorAll("button").forEach(x=>x.disabled=false);if(isFuture(source))buttons.querySelectorAll("button").forEach(x=>x.disabled=x.dataset.attendance!=="pending");}
            });
            buttons.appendChild(b);
          });
          item.append(name,buttons);holder.appendChild(item);
        });
        card.appendChild(holder);
      }
    });
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(decorate));
  const boot=()=>{
    const planner=document.querySelector("#dailyPlanner");
    if(!planner)return setTimeout(boot,100);
    observer.observe(planner,{childList:true,subtree:true});
    decorate();
  };
  boot();
})();
