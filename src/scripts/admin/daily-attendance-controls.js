(() => {
  if (location.pathname !== "/admin/daily") return;

  const style = document.createElement("style");
  style.textContent = `
    /* Keep the student cards below the timeline. */
    #dailyPlanner #dpStudents{display:block!important}

    #dailyPlanner .dp-student-card{
      position:relative!important;
      color:#202020!important;
      border:1px solid rgba(0,0,0,.12)!important;
      box-shadow:0 6px 18px rgba(0,0,0,.08)!important;
      min-height:86px!important;
      padding:10px 12px 38px!important;
      overflow:hidden!important;
      transition:background .18s ease,border-color .18s ease,box-shadow .18s ease,transform .15s ease!important;
    }
    #dailyPlanner .dp-student-card.is-pending{
      background:#fff!important;
      border-color:rgba(0,0,0,.12)!important;
    }
    #dailyPlanner .dp-student-card.is-present{
      background:#dff5e5!important;
      border-color:#42a85f!important;
    }
    #dailyPlanner .dp-student-card.is-absent{
      background:#ffe1e1!important;
      border-color:#df5a5a!important;
    }
    #dailyPlanner .dp-student-card.is-excused{
      background:#deebff!important;
      border-color:#5b8fe8!important;
    }
    #dailyPlanner .dp-student-card>div{color:#202020!important}
    #dailyPlanner .dp-student-card .dp-status{display:none!important}

    /* Round attendance buttons inside each white student card. */
    #dailyPlanner .dp-attendance-buttons{
      position:absolute!important;
      left:10px!important;
      bottom:7px!important;
      display:flex!important;
      align-items:center!important;
      gap:5px!important;
      direction:rtl!important;
      z-index:5!important;
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
      box-sizing:border-box!important;
      cursor:pointer!important;
      font:700 10px/1 inherit!important;
      position:relative!important;
      z-index:6!important;
    }
    #dailyPlanner .dp-attendance-button.present{background:#25a244!important;color:#fff!important}
    #dailyPlanner .dp-attendance-button.absent{background:#d62828!important;color:#fff!important}
    #dailyPlanner .dp-attendance-button.excused{background:#3b82f6!important;color:#fff!important}
    #dailyPlanner .dp-attendance-button.pending{background:#fff!important;color:#555!important}
    #dailyPlanner .dp-attendance-button.active{box-shadow:0 0 0 2px rgba(0,0,0,.28)!important}
    #dailyPlanner .dp-attendance-button:hover:not(:disabled){transform:scale(1.08)!important;box-shadow:0 3px 8px rgba(0,0,0,.18)!important}
    #dailyPlanner .dp-attendance-button:disabled{opacity:.45!important;cursor:not-allowed!important;transform:none!important}
    #dailyPlanner .dp-student-attendance{position:absolute!important;left:10px!important;bottom:7px!important;font-size:9px!important;color:#555!important;z-index:5!important}

    @media(max-width:700px){
      #dailyPlanner .dp-attendance-button{width:23px!important;height:23px!important;min-width:23px!important;min-height:23px!important}
    }
  `;
  document.head.appendChild(style);

  const statusLabels={present:"حاضر",absent:"غایب",excused:"مرخصی",pending:"هنوز ساعت برگزاری نرسیده"};
  const statusShort={present:"ح",absent:"غ",excused:"م",pending:""};
  const attendanceStatuses=["present","absent","excused","pending"];

  const selectedDate=()=>{
    const input=document.querySelector('input[type="date"][data-daily-date],input[type="date"][data-date],.daily-shell input[type="date"]');
    return input?.value||new Date().toLocaleDateString("en-CA");
  };
  const today=()=>new Date().toLocaleDateString("en-CA");

  const isFuture=source=>{
    const selected=selectedDate();
    if(selected>today()) return true;
    if(selected<today()) return false;
    const value=source.querySelector(".dp-student-meta span[dir='ltr']")?.textContent?.trim()||"";
    const match=value.match(/^(\d{1,2}):(\d{2})/);
    if(!match) return false;
    const start=Number(match[1])*60+Number(match[2]);
    const now=new Date();
    return start>now.getHours()*60+now.getMinutes();
  };

  const sourceCards=()=>[...document.querySelectorAll("#dailyPlanner .dp-student-card")];
  const setSave=(text,cls="")=>{const el=document.querySelector("#dpSave");if(el){el.textContent=text;el.className=`dp-save ${cls}`;}};

  function applyCardStatus(source,status){
    attendanceStatuses.forEach(value=>source.classList.remove(`is-${value}`));
    source.classList.add(`is-${status}`);
    source.dataset.attendanceStatus=status;
  }

  async function saveAttendance(source,status){
    const enrollmentSessionId=Number(source.dataset.studentSession||0);
    const enrollmentId=Number(source.dataset.enrollmentId||0);
    if(!enrollmentSessionId) throw new Error("شناسه رکورد حضور هنرجو پیدا نشد.");
    const response=await fetch("/api/admin/daily-planner",{
      method:"POST",credentials:"same-origin",
      headers:{"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({enrollmentSessionId,enrollmentId,status})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success) throw new Error(data.message||"ذخیره وضعیت حضور ناموفق بود.");
    return data;
  }

  function decorate(){
    sourceCards().forEach(source=>{
      const current=source.dataset.attendanceStatus||((attendanceStatuses.find(value=>source.classList.contains(`is-${value}`)))||"pending");
      const future=isFuture(source);
      applyCardStatus(source,current);

      if(source.querySelector(".dp-attendance-buttons")){
        source.querySelectorAll(".dp-attendance-button").forEach(button=>{
          const status=button.dataset.attendance;
          button.classList.toggle("active",status===current);
          button.disabled=future&&status!=="pending";
        });
        return;
      }

      const buttons=document.createElement("div");
      buttons.className="dp-attendance-buttons";

      attendanceStatuses.forEach(status=>{
        const button=document.createElement("button");
        button.type="button";
        button.className=`dp-attendance-button ${status}`;
        button.dataset.attendance=status;
        button.textContent=statusShort[status];
        button.title=statusLabels[status];
        button.setAttribute("aria-label",`${statusLabels[status]} ${source.dataset.studentName||"هنرجو"}`);
        if(current===status) button.classList.add("active");
        if(future) button.disabled=status!=="pending";

        button.addEventListener("pointerdown",event=>event.stopPropagation());
        button.addEventListener("click",async event=>{
          event.preventDefault();
          event.stopPropagation();
          if(future&&status!=="pending") return;
          const previous=source.dataset.attendanceStatus||"pending";
          buttons.querySelectorAll("button").forEach(b=>b.disabled=true);
          try{
            await saveAttendance(source,status);
            applyCardStatus(source,status);
            buttons.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.attendance===status));
            setSave("وضعیت ذخیره شد","is-saved");
            setTimeout(()=>setSave("آماده",""),900);
          }catch(error){
            applyCardStatus(source,previous);
            buttons.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.attendance===previous));
            setSave(error instanceof Error?error.message:"ذخیره وضعیت حضور ناموفق بود","is-error");
          }finally{
            buttons.querySelectorAll("button").forEach(b=>b.disabled=false);
            if(future) buttons.querySelectorAll("button").forEach(b=>b.disabled=b.dataset.attendance!=="pending");
          }
        });
        buttons.appendChild(button);
      });
      source.appendChild(buttons);
    });
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(decorate));
  const boot=()=>{
    const planner=document.querySelector("#dailyPlanner");
    if(!planner) return setTimeout(boot,100);
    observer.observe(planner,{childList:true,subtree:true});
    decorate();
  };
  boot();
})();
