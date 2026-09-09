(() => {
  if (location.pathname !== "/admin/finance") return;

  const panel = document.querySelector("#studentsTab");
  const dateInput = document.querySelector("#financeDate");
  if (!panel || !dateInput || document.querySelector("#studentAccountLedger")) return;

  const money = value => Number(value ?? 0).toLocaleString("fa-IR");
  const digits = value => String(value ?? "").replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  const esc = value => { const d = document.createElement("div"); d.textContent = String(value ?? ""); return d.innerHTML; };
  const methods = { cash: "نقدی", pos: "کارتخوان", transfer: "انتقال", online: "آنلاین", other: "سایر" };
  const state = { date: "", students: [], selected: null };

  const style = document.createElement("style");
  style.textContent = `
    #studentAccountLedger{margin-top:0}.sal-toolbar,.sal-detail{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px}.sal-toolbar{margin-bottom:16px}.sal-toolbar h2,.sal-detail h2{font-size:15px;margin:0 0 12px}.sal-search{width:100%;box-sizing:border-box;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:10px;font:inherit}.sal-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;max-height:230px;overflow:auto}.sal-student{border:1px solid var(--border);background:transparent;color:var(--text);border-radius:10px;padding:10px;text-align:right;font:inherit;cursor:pointer}.sal-student:hover,.sal-student.is-selected{border-color:var(--gold-light);background:rgba(212,175,55,.08)}.sal-student b{display:block}.sal-student span{display:block;font-size:11px;opacity:.65;margin-top:4px}.sal-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.sal-card{border:1px solid var(--border);border-radius:11px;padding:12px}.sal-card span{display:block;font-size:11px;opacity:.65;margin-bottom:5px}.sal-card b{font-size:18px}.sal-card.debit{border-color:#a33}.sal-card.credit{border-color:#2f8f46}.sal-card.gold b{color:var(--gold-light)}.sal-balance{font-weight:900}.sal-balance.debit{color:#d77}.sal-balance.credit{color:#6bcf7a}.sal-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:16px}.sal-table-wrap{overflow:auto}.sal-table{width:100%;border-collapse:collapse;font-size:12px}.sal-table th,.sal-table td{padding:8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}.sal-table th{font-size:11px;opacity:.65}.sal-table tr:last-child td{border-bottom:0}.sal-status{display:inline-block;padding:4px 8px;border-radius:999px;border:1px solid var(--border);font-size:11px}.sal-status.debtor{border-color:#a33}.sal-status.creditor{border-color:#2f8f46}.sal-status.settled{border-color:#b89500}.sal-ledger-debit{color:#d77}.sal-ledger-credit{color:#6bcf7a}.sal-loading{padding:25px;text-align:center;opacity:.65}.sal-empty{padding:18px;text-align:center;opacity:.65}@media(max-width:900px){.sal-list{grid-template-columns:1fr 1fr}.sal-grid{grid-template-columns:1fr}.sal-summary{grid-template-columns:1fr 1fr}}@media(max-width:520px){.sal-list,.sal-summary{grid-template-columns:1fr}.sal-table{font-size:11px}}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "studentAccountLedger";
  root.innerHTML = `
    <section class="sal-toolbar"><h2>حساب هنرجویان</h2><input id="salSearch" class="sal-search" type="search" placeholder="جستجوی نام هنرجو..." autocomplete="off"><div id="salStudentList" class="sal-list"></div></section>
    <section id="salDetail" class="sal-detail"><div class="sal-loading">یک هنرجو را انتخاب کنید.</div></section>`;
  panel.replaceChildren(root);

  const list = document.querySelector("#salStudentList");
  const search = document.querySelector("#salSearch");
  const detail = document.querySelector("#salDetail");

  function currentIso(){ return dateInput.dataset.iso || new Date().toISOString().slice(0,10); }
  function renderList(){
    const q = digits(search.value).trim().toLowerCase();
    const rows = state.students.filter(s => !q || String(s.studentName).toLowerCase().includes(q));
    list.innerHTML = rows.length ? rows.map(s => `<button class="sal-student${state.selected===s.studentId?" is-selected":""}" type="button" data-student-id="${Number(s.studentId)}"><b>${esc(s.studentName)}</b><span>${esc(s.classTitle || "—")} · مانده: ${money(s.balance)} تومان</span></button>`).join("") : `<div class="sal-empty">هنرجویی پیدا نشد.</div>`;
  }

  function renderDetail(data){
    const s=data.summary||{};
    const balance=Number(s.totalBalance||0);
    const credit=Number(s.credit||0);
    const status=s.status||"settled";
    const terms=data.terms||[];
    const payments=data.payments||[];
    const ledger=[];
    terms.forEach(t=>{ if(Number(t.invoiceAmount)>0) ledger.push({date:t.startDate,type:"debit",title:`شهریه ترم ${t.termNumber}`,detail:t.classTitle||"",amount:Number(t.invoiceAmount),sort:0}); });
    payments.forEach(p=>ledger.push({date:String(p.paidAt||"").slice(0,10),type:"credit",title:"پرداخت شهریه",detail:`${p.classTitle||"—"} · ترم ${p.termNumber||"—"}`,amount:Number(p.amount),sort:1,reference:p.reference}));
    ledger.sort((a,b)=>String(b.date).localeCompare(String(a.date)) || b.sort-a.sort);
    const statusText={debtor:"بدهکار",creditor:"بستانکار",settled:"تسویه"}[status]||"تسویه";
    detail.innerHTML=`<h2>گردش حساب: ${esc(data.student?.name||"")}</h2><div class="sal-summary"><div class="sal-card"><span>کل بدهی ثبت‌شده</span><b>${money(s.totalInvoiced)}</b></div><div class="sal-card credit"><span>کل پرداختی</span><b>${money(s.totalPaid)}</b></div><div class="sal-card ${balance>0?"debit":credit>0?"credit":"gold"}"><span>${balance>0?"مانده بدهی":credit>0?"مانده بستانکاری":"مانده حساب"}</span><b>${money(balance>0?balance:credit)}</b></div><div class="sal-card"><span>وضعیت حساب</span><b><span class="sal-status ${esc(status)}">${statusText}</span></b></div></div><div class="sal-grid"><article><h2>سوابق شهریه و دوره‌ها</h2><div class="sal-table-wrap"><table class="sal-table"><thead><tr><th>ترم</th><th>کلاس</th><th>شهریه</th><th>پرداخت</th><th>مانده</th><th>وضعیت</th></tr></thead><tbody>${terms.length?terms.map(t=>`<tr><td>${money(t.termNumber)}</td><td>${esc(t.classTitle)}</td><td>${money(t.invoiceAmount)}</td><td>${money(t.paidAmount)}</td><td>${money(t.balance)}</td><td>${esc(t.financialStatus||"بدون صورتحساب")}</td></tr>`).join(""):"<tr><td colspan=\"6\" class=\"sal-empty\">سابقه‌ای ثبت نشده است.</td></tr>"}</tbody></table></div></article><article><h2>دفتر گردش حساب</h2><div class="sal-table-wrap"><table class="sal-table"><thead><tr><th>تاریخ</th><th>شرح</th><th>کلاس/ترم</th><th>بدهکار</th><th>بستانکار</th><th>مرجع</th></tr></thead><tbody>${ledger.length?ledger.map(x=>`<tr><td>${esc(x.date||"—")}</td><td>${esc(x.title)}</td><td>${esc(x.detail)}</td><td class="sal-ledger-debit">${x.type==="debit"?money(x.amount):"—"}</td><td class="sal-ledger-credit">${x.type==="credit"?money(x.amount):"—"}</td><td>${esc(x.reference||"—")}</td></tr>`).join(""):"<tr><td colspan=\"6\" class=\"sal-empty\">گردش حسابی ثبت نشده است.</td></tr>"}</tbody></table></div></article></div><article style="margin-top:16px"><h2>سابقه پرداخت‌ها</h2><div class="sal-table-wrap"><table class="sal-table"><thead><tr><th>تاریخ</th><th>مبلغ</th><th>روش</th><th>کلاس</th><th>ترم</th><th>شماره پیگیری</th><th>یادداشت</th></tr></thead><tbody>${payments.length?payments.map(p=>`<tr><td>${esc(String(p.paidAt||"").replace("T"," ").slice(0,16))}</td><td>${money(p.amount)}</td><td>${esc(methods[p.method]||p.method||"—")}</td><td>${esc(p.classTitle||"—")}</td><td>${money(p.termNumber)}</td><td>${esc(p.reference||"—")}</td><td>${esc(p.note||"—")}</td></tr>`).join(""):"<tr><td colspan=\"7\" class=\"sal-empty\">پرداختی ثبت نشده است.</td></tr>"}</tbody></table></div></article>`;
  }

  async function loadStudents(){
    const date=currentIso();
    if(state.date===date && state.students.length) return;
    state.date=date;
    try{
      const r=await fetch(`/api/admin/finance-students?date=${encodeURIComponent(date)}`,{credentials:"same-origin",headers:{Accept:"application/json"}});
      const d=await r.json();
      if(!r.ok||!d.success) throw new Error(d.message||"دریافت حساب هنرجویان ناموفق بود.");
      state.students=d.students||[];
      renderList();
      if(state.selected && state.students.some(s=>s.studentId===state.selected)) await loadAccount(state.selected);
      else if(state.students[0]) await loadAccount(state.students[0].studentId);
      else detail.innerHTML='<div class="sal-empty">هنرجوی فعال دارای حساب پیدا نشد.</div>';
    }catch(error){detail.innerHTML=`<div class="sal-empty">${esc(error instanceof Error?error.message:"دریافت اطلاعات ناموفق بود.")}</div>`;}
  }

  async function loadAccount(studentId){
    state.selected=Number(studentId); renderList(); detail.innerHTML='<div class="sal-loading">در حال دریافت گردش حساب...</div>';
    try{
      const r=await fetch(`/api/admin/student-account?studentId=${encodeURIComponent(studentId)}&date=${encodeURIComponent(currentIso())}`,{credentials:"same-origin",headers:{Accept:"application/json"}});
      const d=await r.json();
      if(!r.ok||!d.success) throw new Error(d.message||"دریافت گردش حساب ناموفق بود.");
      renderDetail(d);
    }catch(error){detail.innerHTML=`<div class="sal-empty">${esc(error instanceof Error?error.message:"دریافت گردش حساب ناموفق بود.")}</div>`;}
  }

  list.addEventListener("click",event=>{const b=event.target.closest("button[data-student-id]");if(b)loadAccount(Number(b.dataset.studentId));});
  search.addEventListener("input",renderList);
  const observer=new MutationObserver(()=>{const next=dateInput.dataset.iso||"";if(next!==state.date){state.date="";loadStudents();}});
  observer.observe(dateInput,{attributes:true,attributeFilter:["data-iso"]});
  loadStudents();
})();
