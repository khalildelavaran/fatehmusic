(() => {
  if (location.pathname !== "/admin/daily") return;

  const shell = document.querySelector(".daily-shell");
  const summary = document.querySelector("#summary");
  const sessions = document.querySelector("#sessions");
  if (!shell || !summary || !sessions || document.querySelector("#dailyOperationsPanels")) return;

  const state = { date: localDateString(), month: localDateString().slice(0, 7) };

  const style = document.createElement("style");
  style.textContent = `
    #dailyOperationsPanels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:0 0 22px}
    .dop-panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px}
    .dop-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .dop-head h2{margin:2px 0 0;font-size:20px}.dop-kicker{font-size:11px;opacity:.65}
    .dop-btn{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:7px 11px;cursor:pointer;font-family:inherit}
    .dop-btn:hover{border-color:var(--primary)}
    .dop-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:12px}
    .dop-card{border:1px solid var(--border);border-radius:11px;padding:10px;background:rgba(255,255,255,.03)}
    .dop-card span{display:block;font-size:11px;opacity:.65;margin-bottom:4px}.dop-card b{font-size:17px}.dop-gold b{color:var(--gold-light)}
    .dop-methods{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px}.dop-chip{border:1px solid var(--border);border-radius:999px;padding:6px 9px;font-size:12px}.dop-chip b{margin-inline-start:4px}
    .dop-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.dop-columns h3{font-size:14px;margin:0 0 8px}.dop-list{display:grid;gap:7px;max-height:260px;overflow:auto}
    .dop-row{border:1px solid var(--border);border-radius:10px;padding:9px}.dop-row-main{display:flex;align-items:center;justify-content:space-between;gap:8px}.dop-row small{display:block;opacity:.65;margin-top:4px}.dop-amount{font-weight:800;color:var(--gold-light)}
    .dop-month{display:flex;align-items:center;gap:6px;font-size:12px}.dop-month input{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;padding:6px}
    .dop-table-wrap{overflow:auto}.dop-table{width:100%;border-collapse:collapse;font-size:12px}.dop-table th,.dop-table td{padding:8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}.dop-table th{opacity:.65}.dop-table td:first-child{font-weight:700}
    .dop-note{font-size:11px;opacity:.6;margin:10px 0 0}.dop-empty{opacity:.6;text-align:center;padding:16px}
    @media(max-width:1050px){#dailyOperationsPanels{grid-template-columns:1fr}}@media(max-width:900px){.dop-columns{grid-template-columns:1fr}.dop-cards{grid-template-columns:1fr 1fr}}@media(max-width:480px){.dop-cards{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const wrapper = document.createElement("section");
  wrapper.id = "dailyOperationsPanels";
  wrapper.dir = "rtl";
  wrapper.innerHTML = `
    <section class="dop-panel" aria-labelledby="dopFinanceTitle">
      <div class="dop-head"><div><span class="dop-kicker">امور مالی</span><h2 id="dopFinanceTitle">دریافتی و بدهی</h2></div><button id="dopRefreshFinance" class="dop-btn" type="button">به‌روزرسانی</button></div>
      <div id="dopFinanceCards" class="dop-cards"></div><div id="dopFinanceMethods" class="dop-methods"></div>
      <div class="dop-columns"><div><h3>ریز دریافتی‌ها</h3><div id="dopPayments" class="dop-list"></div></div><div><h3>ریز بدهکاران</h3><div id="dopDebts" class="dop-list"></div></div></div>
    </section>
    <section class="dop-panel" aria-labelledby="dopWorkloadTitle">
      <div class="dop-head"><div><span class="dop-kicker">کارکرد اساتید</span><h2 id="dopWorkloadTitle">کارکرد ماهانه</h2></div><label class="dop-month">ماه<input id="dopWorkloadMonth" type="month"></label><button id="dopRefreshWorkload" class="dop-btn" type="button">محاسبه</button></div>
      <div id="dopWorkloadCards" class="dop-cards"></div><div class="dop-table-wrap"><table class="dop-table"><thead><tr><th>استاد</th><th>درصد</th><th>جلسات کلاس</th><th>جلسات هنرجو</th><th>حاضر</th><th>غایب</th><th>قابل محاسبه</th><th>سهم استاد</th></tr></thead><tbody id="dopWorkloadBody"></tbody></table></div>
      <p class="dop-note">جلسات حاضر و غایب، جلسات برگزارشده و قابل محاسبه هستند؛ غیبت هنرجو از تعداد جلسات قابل محاسبه کم نمی‌شود. مرخصی و ثبت‌نشده محاسبه نمی‌شوند.</p>
    </section>`;
  summary.insertAdjacentElement("afterend", wrapper);

  const money = value => Number(value ?? 0).toLocaleString("fa-IR");
  const esc = value => { const d = document.createElement("div"); d.textContent = String(value ?? ""); return d.innerHTML; };
  const methodLabels = { cash: "نقدی", pos: "پوز", transfer: "انتقال", online: "آنلاین", other: "سایر" };

  function normalizeStudentPaymentMethods() {
    sessions.querySelectorAll("select[data-payment-method]").forEach(select => {
      if (select.dataset.normalized === "1") return;
      select.innerHTML = `<option value="">روش پرداخت</option><option value="cash">نقدی</option><option value="pos">پوز</option><option value="transfer">انتقال</option><option value="online">آنلاین</option>`;
      select.dataset.normalized = "1";
    });
  }

  const observer = new MutationObserver(normalizeStudentPaymentMethods);
  observer.observe(sessions, { childList: true, subtree: true });
  normalizeStudentPaymentMethods();

  async function json(response) {
    const text = await response.text();
    if (!text.trim()) throw new Error(`پاسخ خالی از سرور دریافت شد (${response.status})`);
    try { return JSON.parse(text); } catch { throw new Error(`پاسخ JSON نامعتبر از سرور دریافت شد (${response.status})`); }
  }

  async function loadFinance() {
    try {
      const r = await fetch(`/api/admin/daily-finance?date=${encodeURIComponent(state.date)}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const d = await json(r);
      if (!r.ok || !d.success) throw new Error(d.message || `خطا در دریافت اطلاعات مالی (${r.status})`);
      const s = d.summary || {};
      document.querySelector("#dopFinanceCards").innerHTML = `<div class="dop-card dop-gold"><span>دریافتی این روز</span><b>${money(s.receivedTotal)}</b></div><div class="dop-card"><span>کل بدهی باز</span><b>${money(s.outstandingTotal)}</b></div><div class="dop-card"><span>بدهی معوق</span><b>${money(s.overdueTotal)}</b></div>`;
      document.querySelector("#dopFinanceMethods").innerHTML = Object.entries(methodLabels).map(([key,label]) => `<span class="dop-chip">${label}<b>${money(s.methodTotals?.[key] || 0)}</b></span>`).join("");
      document.querySelector("#dopPayments").innerHTML = d.payments?.length ? d.payments.map(p => `<div class="dop-row"><div class="dop-row-main"><strong>${esc(p.student_name)}</strong><span class="dop-amount">${money(p.amount)}</span></div><small>${esc(p.class_title || "بدون کلاس")} · ${esc(methodLabels[p.method] || p.method)} · ${esc(p.paid_at || "")}</small></div>`).join("") : `<div class="dop-empty">در این روز دریافتی ثبت نشده است.</div>`;
      document.querySelector("#dopDebts").innerHTML = d.debts?.length ? d.debts.map(p => `<div class="dop-row"><div class="dop-row-main"><strong>${esc(p.student_name)}</strong><span class="dop-amount">${money(p.balance)}</span></div><small>${esc(p.class_title || "بدون کلاس")} · سررسید: ${esc(p.due_date || "—")}</small></div>`).join("") : `<div class="dop-empty">بدهی بازی ثبت نشده است.</div>`;
    } catch (error) {
      document.querySelector("#dopFinanceCards").innerHTML = `<div class="dop-empty">${esc(error instanceof Error ? error.message : "دریافت اطلاعات مالی ناموفق بود")}</div>`;
    }
  }

  async function loadWorkload() {
    try {
      const month = document.querySelector("#dopWorkloadMonth").value || state.month;
      const r = await fetch(`/api/admin/teacher-workload?month=${encodeURIComponent(month)}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const d = await json(r);
      if (!r.ok || !d.success) throw new Error(d.message || `خطا در محاسبه کارکرد (${r.status})`);
      const t = d.totals || {};
      document.querySelector("#dopWorkloadCards").innerHTML = `<div class="dop-card"><span>جلسات کلاس</span><b>${money(t.classSessions)}</b></div><div class="dop-card"><span>جلسات قابل محاسبه</span><b>${money(t.compensableSessions)}</b></div><div class="dop-card dop-gold"><span>جمع سهم اساتید</span><b>${money(t.instructorShare)}</b></div>`;
      document.querySelector("#dopWorkloadBody").innerHTML = d.instructors?.length ? d.instructors.map(x => `<tr><td>${esc(x.instructorName)}</td><td>${money(x.payPercentage)}٪</td><td>${money(x.classSessions)}</td><td>${money(x.studentSessions)}</td><td>${money(x.presentSessions)}</td><td>${money(x.absentSessions)}</td><td>${money(x.compensableSessions)}</td><td>${x.hasSessionBasedAmount ? money(x.instructorShare) : "—"}</td></tr>`).join("") : `<tr><td colspan="8" class="dop-empty">استاد فعالی برای این ماه پیدا نشد.</td></tr>`;
    } catch (error) {
      document.querySelector("#dopWorkloadBody").innerHTML = `<tr><td colspan="8" class="dop-empty">${esc(error instanceof Error ? error.message : "محاسبه کارکرد ناموفق بود")}</td></tr>`;
    }
  }

  function updateDateState(delta) {
    const p = state.date.split("-").map(Number);
    const date = new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
    date.setDate(date.getDate() + delta);
    state.date = localDateString(date);
    state.month = state.date.slice(0, 7);
  }

  document.querySelector("#prev")?.addEventListener("click", () => setTimeout(() => { updateDateState(-1); document.querySelector("#dopWorkloadMonth").value = state.month; loadFinance(); loadWorkload(); }, 50));
  document.querySelector("#next")?.addEventListener("click", () => setTimeout(() => { updateDateState(1); document.querySelector("#dopWorkloadMonth").value = state.month; loadFinance(); loadWorkload(); }, 50));
  document.querySelector("#today")?.addEventListener("click", () => setTimeout(() => { state.date = localDateString(); state.month = state.date.slice(0, 7); document.querySelector("#dopWorkloadMonth").value = state.month; loadFinance(); loadWorkload(); }, 50));
  document.querySelector("#dopRefreshFinance")?.addEventListener("click", loadFinance);
  document.querySelector("#dopRefreshWorkload")?.addEventListener("click", loadWorkload);
  document.querySelector("#dopWorkloadMonth").value = state.month;

  loadFinance();
  loadWorkload();
})();
