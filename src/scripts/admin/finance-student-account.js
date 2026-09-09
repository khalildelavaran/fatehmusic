(() => {
  if (location.pathname !== "/admin/finance") return;
  const tab = document.querySelector("#studentsTab");
  const dateInput = document.querySelector("#financeDate");
  if (!tab || !dateInput || document.querySelector("#studentAccountLedger")) return;

  // The expense module is loaded globally. Keep it inside the academy tab so it
  // is hidden together with that tab instead of appearing on every finance view.
  const expenseLedger = document.querySelector("#financeExpenseLedger");
  const academyTab = document.querySelector("#academyTab");
  if (expenseLedger && academyTab && !academyTab.contains(expenseLedger)) {
    academyTab.appendChild(expenseLedger);
  }

  const money = v => Number(v ?? 0).toLocaleString("fa-IR");
  const esc = v => { const d=document.createElement("div"); d.textContent=String(v ?? ""); return d.innerHTML; };
  const methods = { cash:"نقدی", pos:"کارتخوان", transfer:"انتقال", online:"آنلاین", other:"سایر" };
  const state = { selectedId:null, rows:[], lastDate:"" };

  const style=document.createElement("style");
  style.textContent=`
    #studentAccountLedger{margin-top:16px}.sal-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px}.sal-panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px}.sal-search{display:flex;gap:8px}.sal-search input{flex:1;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:9px;font:inherit}.sal-list{margin-top:10px;max-height:560px;overflow:auto}.sal-student{display:block;width:100%;text-align:right;border:1px solid var(--border);background:transparent;color:var(--text);border-radius:10px;padding:10px;margin-bottom:7px;cursor:pointer;font:inherit}.sal-student.is-active{border-color:var(--gold-light);background:rgba(212,175,55,.07)}.sal-student small{display:block;opacity:.6;margin-top:3px}.sal-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.sal-head h2{margin:0 0 7px;font-size:18px}.sal-status{display:inline-block;padding:4px 9px;border-radius:999px;border:1px solid var(--border);font-size:11px}.sal-status.debtor{border-color:#a33}.sal-status.creditor{border-color:#2f8f46}.sal-status.settled{border-color:#b89500}.sal-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.sal-card{border:1px solid var(--border);border-radius:11px;padding:12px}.sal-card span{display:block;font-size:11px;opacity:.65}.sal-card b{display:block;margin-top:5px;font-size:18px}.sal-card.debt{border-color:#a33}.sal-card.credit{border-color:#2f8f46}.sal-table{width:100%;border-collapse:collapse;font-size:12px}.sal-table th,.sal-table td{padding:8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}.sal-table th{opacity:.65}.sal-table-wrap{overflow:auto}.sal-section{margin-top:16px}.sal-note{font-size:11px;opacity:.6;margin-top:10px}.sal-print,.sal-pay-btn{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:8px 12px;font:inherit;font-weight:800;cursor:pointer}.sal-pay-btn{background:var(--primary);border-color:var(--primary);color:#fff}.sal-pay-btn:disabled{opacity:.55;cursor:not-allowed}.sal-payment-form{display:none;margin-top:8px;padding:9px;border:1px solid var(--border);border-radius:9px;background:rgba(212,175,55,.04)}.sal-payment-form.is-open{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.sal-payment-form input,.sal-payment-form select{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;padding:7px;font:inherit}.sal-payment-form input{width:120px}.sal-payment-form select{min-width:105px}.sal-payment-status{font-size:11px}.sal-payment-status.err{color:#d77}.sal-payment-status.ok{color:#6bcf7a}
    @media(max-width:1000px){.sal-layout{grid-template-columns:1fr}.sal-cards{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){.sal-cards{grid-template-columns:1fr}.sal-head{align-items:flex-start;flex-direction:column}.sal-payment-form.is-open{align-items:stretch}.sal-payment-form input,.sal-payment-form select,.sal-payment-form button{width:100%;box-sizing:border-box}}
  `;
  document.head.appendChild(style);

  const section=document.createElement("section"); section.id="studentAccountLedger";
  section.innerHTML=`<div class="sal-layout"><article class="sal-panel"><h2>انتخاب هنرجو</h2><div class="sal-search"><input id="salSearch" placeholder="جستجوی نام هنرجو"><button id="salSearchBtn" class="sal-print" type="button">جستجو</button></div><div id="salList" class="sal-list"></div></article><section id="salAccount" class="sal-panel"><div class="empty">یک هنرجو را انتخاب کنید.</div></section></div>`;
  tab.appendChild(section);

  const list=document.querySelector("#salList"), account=document.querySelector("#salAccount"), search=document.querySelector("#salSearch");
  const currentDate=()=>dateInput.dataset.iso || new Date().toISOString().slice(0,10);
  const json=async(r)=>{const t=await r.text();let d;try{d=JSON.parse(t)}catch{throw Error(`پاسخ نامعتبر از سرور (${r.status})`)}if(!r.ok||!d.success)throw Error(d.message||"خطای سرور");return d};

  async function loadRows(){
    const r=await fetch(`/api/admin/finance-students?date=${encodeURIComponent(currentDate())}`,{credentials:"same-origin",headers:{Accept:"application/json"}});
    const d=await json(r);
    state.rows=d.students||[];
    renderList();
    if(state.selectedId&&state.rows.some(x=>x.studentId===state.selectedId)) await loadAccount(state.selectedId);
  }

  function renderList(){
    const q=(search.value||"").trim().toLowerCase();
    const rows=state.rows.filter(x=>String(x.studentName).toLowerCase().includes(q));
    list.innerHTML=rows.length?rows.map(x=>`<button class="sal-student ${x.studentId===state.selectedId?"is-active":""}" type="button" data-id="${x.studentId}">${esc(x.studentName)}<small>${esc(x.classTitle||"—")} · مانده ${money(x.balance)}</small></button>`).join(""):"<div class=empty>هنرجویی پیدا نشد.</div>";
  }

  async function submitPayment(invoiceId, form){
    const amountInput=form.querySelector("[data-payment-amount]");
    const methodInput=form.querySelector("[data-payment-method]");
    const referenceInput=form.querySelector("[data-payment-reference]");
    const noteInput=form.querySelector("[data-payment-note]");
    const status=form.querySelector("[data-payment-status]");
    const amount=Number(amountInput.value);
    if(!Number.isInteger(amount)||amount<=0){status.className="sal-payment-status err";status.textContent="مبلغ پرداخت را صحیح وارد کنید.";return;}
    if(!methodInput.value){status.className="sal-payment-status err";status.textContent="روش پرداخت را انتخاب کنید.";return;}
    status.className="sal-payment-status";status.textContent="در حال ثبت...";
    try{
      const r=await fetch("/api/admin/payments",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({invoiceId,amount,method:methodInput.value,reference:referenceInput.value,note:noteInput.value})});
      const d=await json(r);
      status.className="sal-payment-status ok";status.textContent="پرداخت با موفقیت ثبت شد.";
      await loadAccount(state.selectedId);
      await loadRows();
    }catch(e){status.className="sal-payment-status err";status.textContent=e instanceof Error?e.message:"ثبت پرداخت ناموفق بود.";}
  }

  async function loadAccount(id){
    try{
      account.innerHTML='<div class="empty">در حال دریافت گردش حساب...</div>';
      const r=await fetch(`/api/admin/student-account?studentId=${id}&date=${encodeURIComponent(currentDate())}`,{credentials:"same-origin",headers:{Accept:"application/json"}});
      const d=await json(r);
      state.selectedId=id;
      const s=d.summary,st=d.student,terms=d.terms||[],payments=d.payments||[];
      const status=s.status==="debtor"?"بدهکار":s.status==="creditor"?"بستانکار":"تسویه";
      account.innerHTML=`<div class="sal-head"><div><h2>${esc(st.name)}</h2><span class="sal-status ${s.status}">${status}</span></div><button class="sal-print" type="button" onclick="window.print()">پرینت گردش حساب</button></div><div class="sal-cards"><div class="sal-card"><span>جمع صورتحساب</span><b>${money(s.totalInvoiced)}</b></div><div class="sal-card"><span>جمع پرداخت‌ها</span><b>${money(s.totalPaid)}</b></div><div class="sal-card debt"><span>بدهکار</span><b>${money(s.totalBalance)}</b></div><div class="sal-card credit"><span>بستانکار</span><b>${money(s.credit)}</b></div></div><article class="sal-panel sal-section"><h3>گردش حساب دوره‌ها</h3><div class="sal-table-wrap"><table class="sal-table"><thead><tr><th>کلاس</th><th>ترم</th><th>صورتحساب</th><th>پرداخت</th><th>بدهکار</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${terms.map(x=>`<tr><td>${esc(x.classTitle)}</td><td>${money(x.termNumber)}</td><td>${money(x.invoiceAmount)}</td><td>${money(x.paidAmount)}</td><td>${money(x.balance)}</td><td>${esc(x.financialStatus)}</td><td>${x.invoiceId&&Number(x.balance)>0?`<button type="button" class="sal-pay-btn" data-open-payment="${Number(x.invoiceId)}">ثبت پرداخت شهریه</button><form class="sal-payment-form" data-payment-form="${Number(x.invoiceId)}"><input data-payment-amount type="number" min="1" max="${Number(x.balance)}" step="1" placeholder="مبلغ"><select data-payment-method><option value="">روش پرداخت</option><option value="cash">نقدی</option><option value="pos">کارتخوان</option><option value="transfer">انتقال</option><option value="online">آنلاین</option><option value="other">سایر</option></select><input data-payment-reference type="text" maxlength="200" placeholder="شماره پیگیری"><input data-payment-note type="text" maxlength="500" placeholder="یادداشت"><button type="submit" class="sal-pay-btn">ثبت</button><span data-payment-status class="sal-payment-status"></span></form>`:"—"}</td></tr>`).join("")||'<tr><td colspan="7">دوره مالی ثبت نشده است.</td></tr>'}</tbody></table></div></article><article class="sal-panel sal-section"><h3>سابقه پرداخت شهریه</h3><div class="sal-table-wrap"><table class="sal-table"><thead><tr><th>تاریخ</th><th>کلاس</th><th>ترم</th><th>مبلغ</th><th>روش</th><th>مرجع</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc(String(p.paidAt||"").slice(0,10))}</td><td>${esc(p.classTitle)}</td><td>${money(p.termNumber)}</td><td>${money(p.amount)}</td><td>${esc(methods[p.method]||p.method||"—")}</td><td>${esc(p.reference||"—")}</td></tr>`).join("")||'<tr><td colspan="6">پرداختی ثبت نشده است.</td></tr>'}</tbody></table></div></article><div class="sal-note">پرداخت شهریه از همین بخش روی صورتحساب همان دوره ثبت می‌شود و بلافاصله در مانده و سابقه پرداخت به‌روزرسانی خواهد شد.</div>`;
      renderList();
    }catch(e){account.innerHTML=`<div class="finance-error">${esc(e.message)}</div>`;}
  }

  list.addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(b)loadAccount(Number(b.dataset.id));});
  account.addEventListener("click",e=>{const b=e.target.closest("[data-open-payment]");if(!b)return;const form=account.querySelector(`[data-payment-form="${b.dataset.openPayment}"]`);if(form){form.classList.toggle("is-open");if(form.classList.contains("is-open"))form.querySelector("[data-payment-amount]")?.focus();}});
  account.addEventListener("submit",e=>{const form=e.target.closest("form[data-payment-form]");if(!form)return;e.preventDefault();submitPayment(Number(form.dataset.paymentForm),form);});
  search.addEventListener("input",renderList);
  document.querySelector("#salSearchBtn").addEventListener("click",renderList);

  const observer=new MutationObserver(()=>{if(dateInput.dataset.iso!==state.lastDate){state.lastDate=dateInput.dataset.iso||"";loadRows();}});
  observer.observe(dateInput,{attributes:true,attributeFilter:["data-iso"]});
  state.lastDate=dateInput.dataset.iso||"";
  loadRows();
})();
