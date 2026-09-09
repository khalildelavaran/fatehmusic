(() => {
  if (location.pathname !== "/admin/daily") return;

  const localDateString = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const shell = document.querySelector(".daily-shell");
  const summary = document.querySelector("#summary");
  if (!shell || !summary || document.querySelector("#dailyPlanner")) return;

  const state = { date: localDateString(), instructor: "all", sessions: [], saving: 0, rooms: [] };
  const esc = (value) => { const el = document.createElement("div"); el.textContent = String(value ?? ""); return el.innerHTML; };
  const minutes = (value) => { const [h, m] = String(value || "00:00").split(":").map(Number); return h * 60 + m; };
  const time = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const snap = (value) => Math.round(value / 15) * 15;

  const style = document.createElement("style");
  style.textContent = `
    #dailyPlanner .dp-track{direction:ltr;overflow:visible;position:absolute}
    #dailyPlanner .dp-card{direction:rtl;touch-action:none}
    #dailyPlanner .dp-resize.start{left:0;right:auto;inset-inline-start:auto;inset-inline-end:auto}
    #dailyPlanner .dp-resize.end{right:0;left:auto;inset-inline-start:auto;inset-inline-end:auto}
    #dailyPlanner .dp-room-label{display:flex;flex-direction:column;gap:2px}
    #dailyPlanner .dp-room-label strong{font-size:12px}
    #dailyPlanner .dp-room-label small{font-size:10px;opacity:.5}
    #dailyPlanner .dp-students{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}
    #dailyPlanner .dp-students-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    #dailyPlanner .dp-students-head strong{font-size:13px}
    #dailyPlanner .dp-students-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:9px}
    #dailyPlanner .dp-student-card{min-height:74px;border:1px solid rgba(255,255,255,.09);border-radius:13px;padding:10px 12px;background:linear-gradient(135deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-sizing:border-box;cursor:context-menu;transition:border-color .15s,transform .15s,box-shadow .15s}
    #dailyPlanner .dp-student-card:hover{transform:translateY(-1px);border-color:rgba(212,175,55,.45);box-shadow:0 8px 22px rgba(0,0,0,.14)}
    #dailyPlanner .dp-student-card.is-present{border-color:rgba(47,143,70,.55)}
    #dailyPlanner .dp-student-card.is-absent{border-color:rgba(214,102,102,.55)}
    #dailyPlanner .dp-student-card.is-excused{border-color:rgba(184,149,0,.55)}
    #dailyPlanner .dp-student-card.is-withdrawn{opacity:.55}
    #dailyPlanner .dp-student-name{font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #dailyPlanner .dp-student-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:10px;opacity:.62;white-space:nowrap;overflow:hidden}
    #dailyPlanner .dp-student-meta span{overflow:hidden;text-overflow:ellipsis}
    #dailyPlanner .dp-status{margin-top:7px;display:inline-flex;padding:2px 7px;border-radius:999px;font-size:9px;border:1px solid rgba(255,255,255,.09);opacity:.72}
    #dailyPlanner .dp-hour-major{opacity:.9;font-weight:800}
    #dailyPlanner .dp-hour-minor{opacity:.35}
    #dailyPlanner .dp-track{background-image:none}
    #dailyPlanner .dp-track::after{content:"";position:absolute;inset:0;pointer-events:none}
    #dailyPlanner .dp-row.dp-drop-target .dp-track{outline:1px dashed rgba(212,175,55,.55);outline-offset:-2px}
    #dailyPlanner .dp-card.dp-room-dragging{opacity:.8;z-index:50}
    @media(max-width:700px){#dailyPlanner .dp-students-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const planner = document.createElement("section");
  planner.id = "dailyPlanner";
  planner.dir = "rtl";
  planner.innerHTML = `
    <header class="dp-head"><div class="dp-title"><div><h2>برنامه‌ریزی روزانه</h2><small>تایم‌لاین بر اساس اتاق · شبکه ۱۵ دقیقه‌ای · جابه‌جایی و تغییر طول کارت‌ها</small></div></div><div class="dp-controls"><select id="dpInstructor" class="dp-select" aria-label="مدرس"><option value="all">همه مدرسان</option></select><span id="dpSave" class="dp-save">در حال بارگذاری…</span></div></header>
    <div class="dp-scroll"><div id="dpGrid" class="dp-grid"></div><div id="dpStudents" class="dp-students"></div></div>
    <div class="dp-legend"><span><i class="dp-dot gold"></i>جلسه</span><span><i class="dp-dot gray"></i>شبکه ۱۵ دقیقه‌ای</span><span><i class="dp-dot red"></i>تداخل زمانی</span></div>`;
  summary.insertAdjacentElement("afterend", planner);

  const menu = document.createElement("div");
  menu.className = "dp-context";
  menu.innerHTML = `<button data-status="present">حضور</button><button data-status="excused">مرخصی</button><button data-status="absent">غیبت</button><button data-status="withdrawn" class="danger">انصراف</button>`;
  document.body.appendChild(menu);
  let contextStudent = null;

  const setSave = (text, cls = "") => { const el = document.querySelector("#dpSave"); if (el) { el.textContent = text; el.className = `dp-save ${cls}`; } };
  const filtered = () => state.instructor === "all" ? state.sessions : state.sessions.filter(s => String(s.instructor_id) === String(state.instructor));
  function range(){const starts=state.sessions.map(s=>minutes(s.startTime)),ends=state.sessions.map(s=>minutes(s.endTime));return{start:Math.floor(Math.min(16*60,...(starts.length?[Math.min(...starts)-30]:[]))/60)*60,end:Math.ceil(Math.max(22*60,...(ends.length?[Math.max(...ends)+30]:[]))/60)*60};}
  function fillInstructors(){const select=document.querySelector("#dpInstructor");if(!select)return;const values=[...new Map(state.sessions.map(s=>[s.instructor_id,s.instructor_name||`مدرس ${s.instructor_id}`])).entries()];select.innerHTML=`<option value="all">همه مدرسان</option>`+values.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join("");select.value=values.some(([id])=>String(id)===String(state.instructor))?state.instructor:"all";}
  function conflict(item,all){return all.some(other=>other.id!==item.id&&String(other.instructor_id)===String(item.instructor_id)&&(item.room_id==null||other.room_id==null||String(item.room_id)===String(other.room_id))&&minutes(other.startTime)<minutes(item.endTime)&&minutes(other.endTime)>minutes(item.startTime));}
  function assignLanes(items){const sorted=[...items].sort((a,b)=>minutes(a.startTime)-minutes(b.startTime)||minutes(a.endTime)-minutes(b.endTime));const lanes=[];for(const item of sorted){const start=minutes(item.startTime);let lane=0;while(lane<lanes.length&&lanes[lane]>start)lane++;if(lane===lanes.length)lanes.push(minutes(item.endTime));else lanes[lane]=minutes(item.endTime);item.__lane=lane;}return lanes.length;}
  function studentEntries(items){const result=[];for(const item of items){for(const student of Array.isArray(item.students)?item.students:[])result.push({...student,session:item});}return result;}
  function statusLabel(status){return({present:"حاضر",absent:"غیبت",excused:"مرخصی",withdrawn:"انصراف",pending:"ثبت نشده"})[status]||"ثبت نشده";}

  function renderStudents(items){
    const host=document.querySelector("#dpStudents");if(!host)return;const entries=studentEntries(items);
    host.innerHTML=`<div class="dp-students-head"><strong>هنرجویان امروز</strong><span class="dp-save">${entries.length} هنرجو</span></div>${entries.length?`<div class="dp-students-grid">${entries.map(entry=>{const status=entry.status||entry.attendanceStatus||"pending",item=entry.session;return `<article class="dp-student-card is-${esc(status)}" data-student-session="${esc(entry.enrollmentSessionId||"")}" data-enrollment-id="${esc(entry.enrollmentId||"")}" data-student-name="${esc(entry.studentName||"")}"><div class="dp-student-name">${esc(entry.studentName||"بدون نام")}</div><div class="dp-student-meta"><span>${esc(entry.courseName||item.course_names||item.class_title||"جلسه")}</span><span dir="ltr">${esc(item.startTime)}–${esc(item.endTime)}</span></div><div class="dp-student-meta"><span>${esc(item.instructor_name||"مدرس")}</span><span>${esc(item.room_name||"اتاق")}</span></div><span class="dp-status">${statusLabel(status)}</span></article>`;}).join("")}</div>`:`<div class="dp-empty">هنرجوی زمان‌بندی‌شده‌ای برای این روز وجود ندارد.</div>`}`;
    host.querySelectorAll(".dp-student-card").forEach(card=>card.addEventListener("contextmenu",event=>{event.preventDefault();contextStudent={enrollmentSessionId:card.dataset.studentSession,enrollmentId:card.dataset.enrollmentId,studentName:card.dataset.studentName};menu.style.display="block";menu.style.left=`${event.clientX}px`;menu.style.top=`${event.clientY}px`;}));
  }

  function render(){
    const grid=document.querySelector("#dpGrid");if(!grid)return;const items=filtered(),{start,end}=range(),total=Math.max(60,end-start),hours=[];
    for(let m=start;m<=end;m+=15){const major=m%60===0;hours.push(`<span class="dp-hour ${major?"dp-hour-major":"dp-hour-minor"}" style="left:${((m-start)/total)*100}%">${major?time(m):""}</span>`);}

    const rooms=new Map();
    for(const room of state.rooms.slice(0,3)){rooms.set(`room:${room.id}`,{id:room.id,name:room.name||`اتاق ${rooms.size+1}`,items:[]});}
    for(const item of items){const key=item.room_id!=null?`room:${item.room_id}`:`room:${item.room_name||"free"}`;if(!rooms.has(key))rooms.set(key,{id:item.room_id??null,name:item.room_name||"اتاق آزاد",items:[]});rooms.get(key).items.push(item);}
    const rows=[...rooms.values()].slice(0,3);

    grid.innerHTML=`<div class="dp-hours">${hours.join("")}</div><div class="dp-body">${rows.map((row,index)=>{const laneCount=assignLanes(row.items),rowHeight=Math.max(94,laneCount*84+10),step=((15/60)*100)/(end-start)*60;return `<div class="dp-row" data-room-id="${esc(row.id??"")}" data-room-name="${esc(row.name)}" style="height:${rowHeight}px"><div class="dp-row-label dp-room-label"><strong>${esc(row.name||`اتاق ${index+1}`)}</strong><small>${row.items.length} جلسه · ${[...new Set(row.items.map(x=>x.instructor_name).filter(Boolean))].map(esc).join("، ")}</small></div><div class="dp-track" data-room-id="${esc(row.id??"")}" data-room-name="${esc(row.name)}" style="background-image:repeating-linear-gradient(to right,rgba(255,255,255,.085) 0,rgba(255,255,255,.085) 1px,transparent 1px,transparent ${step}%),repeating-linear-gradient(to right,rgba(212,175,55,.15) 0,rgba(212,175,55,.15) 1px,transparent 1px,transparent ${step*4}%);background-size:${step}% 100%,${step*4}% 100%;background-repeat:repeat-x,repeat-x">${row.items.map(item=>{const left=((minutes(item.startTime)-start)/total)*100,width=Math.max(1.8,((minutes(item.endTime)-minutes(item.startTime))/total)*100),lane=item.__lane||0,students=Array.isArray(item.students)?item.students:[],names=students.map(s=>s.studentName).filter(Boolean).join("، ")||item.student_names||"بدون هنرجو",courses=students.map(s=>s.courseName).filter(Boolean).join("، ")||item.course_names||item.class_title||"جلسه";return `<article class="dp-card ${conflict(item,items)?"is-conflict":""}" data-session-id="${esc(item.id)}" data-room-id="${esc(item.room_id??row.id??"")}" style="left:${left}%;width:${width}%;top:${10+lane*84}px" title="برای جابه‌جایی بکشید"><strong>${esc(names)}</strong><span>${esc(courses)} · ${esc(item.instructor_name||"مدرس")}</span><time>${esc(item.startTime)}–${esc(item.endTime)}</time><i class="dp-resize start" data-resize="start" aria-label="تغییر زمان شروع"></i><i class="dp-resize end" data-resize="end" aria-label="تغییر زمان پایان"></i></article>`;}).join("")}</div></div>`;}).join("")}</div>`;
    renderStudents(items);bindCards();
  }

  async function loadRooms(){
    try{const response=await fetch("/api/admin/daily-planner?resource=rooms",{credentials:"same-origin",headers:{accept:"application/json"}}),data=await response.json().catch(()=>({}));if(response.ok&&data.success&&Array.isArray(data.rooms))state.rooms=data.rooms.slice(0,3);}catch{}
  }

  async function load(){
    setSave("در حال بارگذاری…","is-saving");
    try{await loadRooms();const response=await fetch(`/api/admin/daily-dashboard?date=${encodeURIComponent(state.date)}`,{credentials:"same-origin",headers:{accept:"application/json"}}),data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(data.message||"دریافت برنامه ناموفق بود");state.sessions=(data.sessions||[]).map(s=>({...s,startTime:s.start_time||s.startTime,endTime:s.end_time||s.endTime,students:Array.isArray(s.students)?s.students:[],student_names:s.student_names||(Array.isArray(s.students)?s.students.map(x=>x.studentName).filter(Boolean).join("، "):""),course_names:s.course_names||(Array.isArray(s.students)?s.students.map(x=>x.courseName).filter(Boolean).join("، "):"")})).filter(s=>s.startTime&&s.endTime);fillInstructors();render();setSave(`${state.sessions.length} جلسه · ذخیره خودکار`,"is-saved");}
    catch(error){setSave(error instanceof Error?error.message:"خطا در دریافت برنامه","is-error");const grid=document.querySelector("#dpGrid");if(grid)grid.innerHTML=`<div class="dp-empty">دریافت برنامه روزانه انجام نشد. صفحه را دوباره بارگذاری کنید.</div>`;}
  }

  async function save(item,oldStart,oldEnd,oldRoom){state.saving++;setSave("در حال ذخیره…","is-saving");try{const response=await fetch("/api/admin/daily-planner",{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({sessionId:item.id,sessionDate:state.date,startTime:item.startTime,endTime:item.endTime,roomId:item.room_id==null?null:Number(item.room_id)})}),data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(data.message||"ذخیره ناموفق بود");setSave("ذخیره شد","is-saved");}catch(error){item.startTime=oldStart;item.endTime=oldEnd;item.room_id=oldRoom;render();setSave(error instanceof Error?error.message:"ذخیره ناموفق بود","is-error");}finally{state.saving=Math.max(0,state.saving-1);if(!state.saving)setTimeout(()=>setSave("ذخیره خودکار"),1200);}}

  function roomAtPoint(x,y){
    const element=document.elementFromPoint(x,y);
    return element?.closest(".dp-row") || null;
  }

  function bindCards(){
    document.querySelectorAll(".dp-card").forEach(card=>{let mode=null,pointerId=null,oldStart="",oldEnd="",oldRoom=null,dragRow=null;
      card.addEventListener("pointerdown",event=>{const item=state.sessions.find(s=>String(s.id)===String(card.dataset.sessionId));if(!item)return;mode=event.target.closest(".dp-resize")?.dataset.resize||"move";pointerId=event.pointerId;oldStart=item.startTime;oldEnd=item.endTime;oldRoom=item.room_id??null;dragRow=card.closest(".dp-row");card.setPointerCapture?.(pointerId);card.dataset.dragging="1";if(mode==="move")card.classList.add("dp-room-dragging");event.preventDefault();});
      card.addEventListener("pointermove",event=>{if(!mode||event.pointerId!==pointerId)return;const item=state.sessions.find(s=>String(s.id)===String(card.dataset.sessionId));if(!item)return;
        const targetRow=mode==="move"?roomAtPoint(event.clientX,event.clientY):dragRow;
        const targetTrack=targetRow?.querySelector(".dp-track")||dragRow?.querySelector(".dp-track");
        if(!targetTrack)return;
        document.querySelectorAll(".dp-row.dp-drop-target").forEach(row=>row.classList.remove("dp-drop-target"));
        if(mode==="move"&&targetRow){targetRow.classList.add("dp-drop-target");if(targetTrack!==card.parentElement)targetTrack.appendChild(card);dragRow=targetRow;const roomId=targetRow.dataset.roomId;item.room_id=roomId===""?null:Number(roomId);item.room_name=targetRow.dataset.roomName||item.room_name;card.dataset.roomId=roomId||"";}
        const rect=targetTrack.getBoundingClientRect(),{start,end}=range();const raw=start+((event.clientX-rect.left)/Math.max(1,rect.width))*(end-start),value=Math.max(start,Math.min(end,snap(raw)));
        if(mode==="move"){const duration=minutes(item.endTime)-minutes(item.startTime),next=Math.max(start,Math.min(end-duration,value));item.startTime=time(next);item.endTime=time(next+duration);}else if(mode==="start"){item.startTime=time(Math.max(start,Math.min(minutes(item.endTime)-15,value)));}else{item.endTime=time(Math.max(minutes(item.startTime)+15,Math.min(end,value)));}
        const left=((minutes(item.startTime)-start)/(end-start))*100,width=((minutes(item.endTime)-minutes(item.startTime))/(end-start))*100;card.style.left=`${left}%`;card.style.width=`${Math.max(1.8,width)}%`;const timeEl=card.querySelector("time");if(timeEl)timeEl.textContent=`${item.startTime}–${item.endTime}`;
      });
      card.addEventListener("pointerup",async event=>{if(!mode||event.pointerId!==pointerId)return;const item=state.sessions.find(s=>String(s.id)===String(card.dataset.sessionId)),changed=item&&(item.startTime!==oldStart||item.endTime!==oldEnd||(item.room_id??null)!==(oldRoom??null));mode=null;pointerId=null;card.classList.remove("dp-room-dragging");delete card.dataset.dragging;document.querySelectorAll(".dp-row.dp-drop-target").forEach(row=>row.classList.remove("dp-drop-target"));if(changed)await save(item,oldStart,oldEnd,oldRoom);else if(dragRow&&dragRow.querySelector(".dp-track")!==card.parentElement)dragRow.querySelector(".dp-track")?.appendChild(card);if(changed)render();});
      card.addEventListener("pointercancel",()=>{mode=null;pointerId=null;card.classList.remove("dp-room-dragging");delete card.dataset.dragging;document.querySelectorAll(".dp-row.dp-drop-target").forEach(row=>row.classList.remove("dp-drop-target"));});
      card.addEventListener("contextmenu",event=>{event.preventDefault();const item=state.sessions.find(s=>String(s.id)===String(card.dataset.sessionId)),student=item?.students?.[0];if(!student)return;contextStudent=student;menu.style.display="block";menu.style.left=`${event.clientX}px`;menu.style.top=`${event.clientY}px`;});
    });
  }

  menu.addEventListener("click",async event=>{const button=event.target.closest("button[data-status]");if(!button||!contextStudent)return;const status=button.dataset.status;try{const response=await fetch("/api/admin/daily-planner",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({enrollmentSessionId:contextStudent.enrollmentSessionId,enrollmentId:contextStudent.enrollmentId,status})}),data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(data.message||"ثبت وضعیت ناموفق بود");await load();}catch(error){setSave(error instanceof Error?error.message:"ثبت وضعیت ناموفق بود","is-error");}finally{menu.style.display="none";contextStudent=null;}});
  document.addEventListener("click",()=>{menu.style.display="none";});
  document.querySelector("#dpInstructor")?.addEventListener("change",event=>{state.instructor=event.target.value;render();});

  load();
})();
