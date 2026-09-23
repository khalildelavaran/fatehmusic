import { formatJalaliDate, formatJalaliTime } from "../../utils/format-date";

const liveStatus=document.querySelector("#liveStatus");
const printButton=document.querySelector("#printRegistrations");
const body=document.querySelector("#registrationsBody");
const modal=document.querySelector("#registrationEditModal");
const editForm=document.querySelector("#registrationEditForm");
const editStatus=document.querySelector("#editRegistrationStatus");
const statusLabels={pending:"در انتظار",contacted:"تماس گرفته شد",confirmed:"تأیید شد",cancelled:"لغو شد"};
const headers=()=>({"Content-Type":"application/json"});
const POLL_INTERVAL_MS=30000;
let pollTimer=null;
let registrations=[];
let editOptions={courses:[],weekdays:[]};

function esc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function setLiveStatus(t){if(liveStatus)liveStatus.textContent=t}
function setEditStatus(t){if(editStatus)editStatus.textContent=t}

function populateSelect(select,items,valueKey,labelKey,currentValue){
  if(!select)return;
  select.innerHTML=items.map(item=>{
    const value=String(item[valueKey]??item);
    const label=String(item[labelKey]??item);
    return `<option value="${esc(value)}" ${value===String(currentValue??"")?"selected":""}>${esc(label)}</option>`;
  }).join("");
}

function openEditModal(item){
  if(!modal||!editForm)return;
  document.querySelector("#editRegistrationId").value=item.id;
  document.querySelector("#editFirstName").value=item.student_first_name||"";
  document.querySelector("#editLastName").value=item.student_last_name||"";
  document.querySelector("#editNationalCode").value=item.student_national_code||"";
  document.querySelector("#editMobile").value=item.student_mobile||"";
  document.querySelector("#editAge").value=item.student_age??"";
  document.querySelector("#editGender").value=item.student_gender||"";
  document.querySelector("#editHasInstrument").value=item.has_instrument||"";
  document.querySelector("#editFatherName").value=item.student_father_name||"";
  document.querySelector("#editIdIssuePlace").value=item.student_id_issue_place||"";
  document.querySelector("#editBirthYear").value=item.student_birth_year||"";
  document.querySelector("#editOccupation").value=item.student_occupation||"";
  document.querySelector("#editAddress").value=item.student_address||"";
  populateSelect(document.querySelector("#editCourse"),editOptions.courses,"id","title",item.instrument_id);
  populateSelect(document.querySelector("#editWeekday"),editOptions.weekdays.map(x=>({value:x,label:x})),"value","label",item.schedule_weekday);
  setEditStatus("مدرس فعلی: "+(item.instructor_name||"—")+" · با تغییر روز، برنامه همان مدرس در آن روز انتخاب می‌شود.");
  modal.hidden=false;
  document.body.classList.add("admin-modal-open");
  document.querySelector("#editFirstName").focus();
}

function closeEditModal(){
  if(!modal)return;
  modal.hidden=true;
  document.body.classList.remove("admin-modal-open");
  setEditStatus("");
}

async function loadRegistrations({silent=false}={}){
  if(!silent)setLiveStatus("در حال به‌روزرسانی...");
  let response;
  try{
    response=await fetch("/api/admin/registrations",{credentials:"same-origin",headers:headers()});
  }catch{
    setLiveStatus("خطا در ارتباط با سرور. تلاش مجدد در ۳۰ ثانیه...");
    return;
  }
  if(response.status===401){location.assign("/admin/login");return}
  const data=await response.json();
  if(!data.success){setLiveStatus(data.message);return}
  registrations=data.registrations||[];
  editOptions=data.editOptions||{courses:[],weekdays:[]};
  body.innerHTML=registrations.length===0
    ?`<tr><td colspan="9" class="admin-table-empty">هنوز ثبت‌نامی وجود ندارد.</td></tr>`
    :registrations.map(item=>`<tr>
      <td>${esc(item.tracking_code)}</td>
      <td>${esc(item.student_first_name)} ${esc(item.student_last_name)}<br><span class="admin-table-subtext">سن: ${esc(item.student_age)}</span></td>
      <td dir="ltr">${esc(item.student_national_code||"-")}</td>
      <td dir="ltr">${esc(item.student_mobile)}</td>
      <td>${esc(item.instrument_title)}</td>
      <td>${esc(item.instructor_name)}</td>
      <td>${esc(item.schedule_weekday)}<br><span class="admin-table-subtext">${esc(item.schedule_duration||"")} دقیقه · ${formatJalaliDate(item.created_at)}</span></td>
      <td><span class="admin-status-pill" data-status="${esc(item.status)}">${esc(statusLabels[item.status]||item.status)}</span></td>
      <td class="no-print admin-registration-actions">
        <select data-id="${item.id}">${Object.entries(statusLabels).map(([v,l])=>`<option value="${v}" ${item.status===v?"selected":""}>${l}</option>`).join("")}</select>
        <button type="button" class="admin-document-btn" data-edit-registration="${item.id}">ویرایش</button>
        <button type="button" class="admin-document-btn" data-print-contract="${item.id}">چاپ قرارداد</button>
        <a class="admin-document-btn" href="/admin/certificates?registration_id=${encodeURIComponent(item.id)}">گواهینامه</a>
        ${item.student_national_code?`<button type="button" class="admin-document-btn" data-reset-student="${esc(item.student_national_code)}">بازنشانی رمز</button>`:""}
      </td>
    </tr>`).join("");
  setLiveStatus(`${registrations.length} ثبت‌نام · آخرین به‌روزرسانی: ${formatJalaliTime(new Date())}`);
}

function startPolling(){stopPolling();pollTimer=setInterval(()=>loadRegistrations({silent:true}),POLL_INTERVAL_MS)}
function stopPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=null}
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopPolling();else{loadRegistrations({silent:true});startPolling()}});

body.addEventListener("click",async event=>{
  const edit=event.target.closest("[data-edit-registration]");
  if(edit instanceof HTMLButtonElement){
    const item=registrations.find(x=>Number(x.id)===Number(edit.dataset.editRegistration));
    if(item)openEditModal(item);
    return;
  }

  const close=event.target.closest("[data-close-registration-modal]");
  if(close){closeEditModal();return}

  const reset=event.target.closest("[data-reset-student]");
  if(reset instanceof HTMLButtonElement){
    if(!confirm("رمز این هنرجو به کد ملی بازگردانده شود؟"))return;
    reset.disabled=true;
    const r=await fetch("/api/admin/student-reset-password",{method:"POST",headers:headers(),credentials:"same-origin",body:JSON.stringify({national_code:reset.dataset.resetStudent})});
    const d=await r.json().catch(()=>({message:"خطا"}));
    setLiveStatus(d.message||"انجام شد.");
    reset.disabled=false;
    return;
  }

  const target=event.target.closest("[data-print-contract]");
  if(!(target instanceof HTMLButtonElement))return;
  const id=Number(target.dataset.printContract);
  if(!id)return;
  const tab=window.open("about:blank","_blank");
  if(!tab){setLiveStatus("مرورگر بازشدن تب جدید را مسدود کرده است.");return}
  tab.document.title="در حال آماده‌سازی قرارداد...";
  tab.document.body.innerHTML='<div style="font-family:Tahoma,sans-serif;direction:rtl;text-align:center;padding:48px">در حال تولید PDF قرارداد...</div>';
  target.disabled=true;
  const old=target.textContent;
  target.textContent="در حال تولید...";
  try{
    const r=await fetch("/api/admin/contract-generate",{method:"POST",headers:headers(),credentials:"same-origin",body:JSON.stringify({registration_id:id})});
    if(r.status===401){tab.close();location.assign("/admin/login");return}
    if(!r.ok){const d=await r.json().catch(()=>({message:"تولید قرارداد شکست خورد."}));tab.close();setLiveStatus(d.message);return}
    const u=URL.createObjectURL(await r.blob());
    tab.location.replace(u);tab.focus();setTimeout(()=>URL.revokeObjectURL(u),60000);
    setLiveStatus("PDF قرارداد در تب جدید باز شد.");
  }catch{tab.close();setLiveStatus("خطای شبکه هنگام تولید قرارداد.")}
  finally{target.disabled=false;target.textContent=old}
});

editForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const save=document.querySelector("#saveRegistrationEdit");
  save.disabled=true;
  setEditStatus("در حال ذخیره تغییرات...");
  const payload={
    action:"edit",
    id:Number(document.querySelector("#editRegistrationId").value),
    courseId:Number(document.querySelector("#editCourse").value),
    weekday:document.querySelector("#editWeekday").value,
    firstName:document.querySelector("#editFirstName").value,
    lastName:document.querySelector("#editLastName").value,
    mobile:document.querySelector("#editMobile").value,
    age:Number(document.querySelector("#editAge").value),
    gender:document.querySelector("#editGender").value,
    hasInstrument:document.querySelector("#editHasInstrument").value,
    fatherName:document.querySelector("#editFatherName").value,
    idIssuePlace:document.querySelector("#editIdIssuePlace").value,
    birthYear:Number(document.querySelector("#editBirthYear").value)||0,
    occupation:document.querySelector("#editOccupation").value,
    address:document.querySelector("#editAddress").value
  };
  try{
    const r=await fetch("/api/admin/registrations",{method:"PATCH",headers:headers(),credentials:"same-origin",body:JSON.stringify(payload)});
    if(r.status===401){location.assign("/admin/login");return}
    const d=await r.json();
    if(!d.success){setEditStatus(d.message||"ذخیره تغییرات انجام نشد.");return}
    closeEditModal();
    await loadRegistrations({silent:true});
    setLiveStatus(d.message||"تغییرات ذخیره شد.");
  }catch{setEditStatus("خطا در ارتباط با سرور.")}
  finally{save.disabled=false}
});

document.addEventListener("keydown",event=>{if(event.key==="Escape"&&modal&&!modal.hidden)closeEditModal()});

body.addEventListener("change",async event=>{
  const target=event.target;
  if(!(target instanceof HTMLSelectElement))return;
  const r=await fetch("/api/admin/registrations",{method:"PATCH",headers:headers(),credentials:"same-origin",body:JSON.stringify({id:Number(target.dataset.id),status:target.value})});
  if(r.status===401){location.assign("/admin/login");return}
  const d=await r.json();
  if(!d.success)setLiveStatus(d.message);
  await loadRegistrations({silent:true});
});

loadRegistrations();
startPolling();
