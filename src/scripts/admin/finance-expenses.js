(() => {
  if (location.pathname !== "/admin/finance") return;

  const root = document.querySelector("#academyTab");
  const dateInput = document.querySelector("#financeDate");
  if (!root || !dateInput || document.querySelector("#financeExpenseLedger")) return;

  const money = value => Number(value ?? 0).toLocaleString("fa-IR");
  const esc = value => { const d = document.createElement("div"); d.textContent = String(value ?? ""); return d.innerHTML; };
  const methods = { cash: "نقدی", pos: "کارتخوان", transfer: "انتقال", online: "آنلاین", other: "سایر" };
  const state = { lastDate: "" };

  const style = document.createElement("style");
  style.textContent = `
    #financeExpenseLedger{margin-top:16px}.fel-layout{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.6fr);gap:16px}.fel-form,.fel-list{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px}.fel-form h2,.fel-list h2{font-size:15px;margin:0 0 12px}.fel-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.fel-field{display:grid;gap:5px}.fel-field.full{grid-column:1/-1}.fel-field label{font-size:11px;opacity:.65}.fel-field input,.fel-field select,.fel-field textarea{width:100%;box-sizing:border-box;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:9px;font:inherit}.fel-field textarea{min-height:70px;resize:vertical}.fel-actions{display:flex;gap:8px;margin-top:10px}.fel-btn{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:8px 12px;font:inherit;font-weight:800;cursor:pointer}.fel-btn.primary{background:var(--primary);color:#fff;border-color:var(--primary)}.fel-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:12px}.fel-card{border:1px solid var(--border);border-radius:11px;padding:10px}.fel-card span{display:block;font-size:11px;opacity:.65;margin-bottom:4px}.fel-card b{font-size:17px}.fel-gold b{color:var(--gold-light)}.fel-table-wrap{overflow:auto}.fel-table{width:100%;border-collapse:collapse;font-size:12px}.fel-table th,.fel-table td{padding:8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}.fel-table th{opacity:.65}.fel-table tr:last-child td{border-bottom:0}.fel-delete{border:0;background:transparent;color:#d77;cursor:pointer;font:inherit;font-weight:800}.fel-status{font-size:11px;min-height:18px;margin-top:7px}.fel-status.ok{color:#6bcf7a}.fel-status.err{color:#d77}.fel-profit{margin-top:16px}.fel-profit-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.fel-profit-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px}.fel-profit-card span{display:block;font-size:11px;opacity:.65;margin-bottom:5px}.fel-profit-card b{font-size:20px}.fel-profit-card.net{border-color:var(--gold-light)}@media(max-width:900px){.fel-layout{grid-template-columns:1fr}}@media(max-width:520px){.fel-grid,.fel-summary,.fel-profit-grid{grid-template-columns:1fr}.fel-field.full{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "financeExpenseLedger";
  section.innerHTML = `
    <div class="fel-profit"><div class="fel-profit-grid" id="felProfitCards"></div></div>
    <div class="fel-layout" style="margin-top:16px">
      <form id="felForm" class="fel-form">
        <h2>ثبت هزینه آموزشگاه</h2>
        <div class="fel-grid">
          <div class="fel-field"><label for="felDate">تاریخ</label><input id="felDate" type="text" inputmode="numeric" dir="ltr" readonly></div>
          <div class="fel-field"><label for="felCategory">دسته‌بندی</label><select id="felCategory"><option value="اجاره">اجاره</option><option value="حقوق و دستمزد">حقوق و دستمزد</option><option value="قبوض">قبوض</option><option value="تجهیزات و ساز">تجهیزات و ساز</option><option value="تعمیرات">تعمیرات</option><option value="تبلیغات">تبلیغات</option><option value="لوازم مصرفی">لوازم مصرفی</option><option value="حمل‌ونقل">حمل‌ونقل</option><option value="سایر">سایر</option></select></div>
          <div class="fel-field"><label for="felAmount">مبلغ (تومان)</label><input id="felAmount" type="number" min="1" step="1" required></div>
          <div class="fel-field"><label for="felMethod">روش پرداخت</label><select id="felMethod"><option value="cash">نقدی</option><option value="pos">کارتخوان</option><option value="transfer">انتقال</option><option value="online">آنلاین</option><option value="other">سایر</option></select></div>
          <div class="fel-field full"><label for="felDescription">شرح هزینه</label><input id="felDescription" type="text" maxlength="500" placeholder="مثلاً پرداخت اجاره شعبه ۱"></div>
          <div class="fel-field full"><label for="felReference">شماره پیگیری / مرجع</label><input id="felReference" type="text" maxlength="200"></div>
          <div class="fel-field full"><label for="felNote">یادداشت</label><textarea id="felNote" maxlength="1000"></textarea></div>
        </div>
        <div class="fel-actions"><button class="fel-btn primary" type="submit">ثبت هزینه</button><button class="fel-btn" type="reset">پاک کردن</button></div>
        <div id="felStatus" class="fel-status" role="status"></div>
      </form>
      <article class="fel-list">
        <h2>دفتر هزینه‌ها</h2>
        <div id="felSummary" class="fel-summary"></div>
        <div class="fel-table-wrap"><table class="fel-table"><thead><tr><th>تاریخ</th><th>دسته</th><th>شرح</th><th>مبلغ</th><th>روش</th><th>عملیات</th></tr></thead><tbody id="felBody"></tbody></table></div>
      </article>
    </div>`;
  root.insertAdjacentElement("afterend", section);

  const form = document.querySelector("#felForm");
  const body = document.querySelector("#felBody");
  const summary = document.querySelector("#felSummary");
  const status = document.querySelector("#felStatus");
  const profitCards = document.querySelector("#felProfitCards");

  function currentIso() {
    return dateInput.dataset.iso || new Date().toISOString().slice(0, 10);
  }
  function setFormDate() {
    document.querySelector("#felDate").value = dateInput.value || "";
  }
  async function readJson(response) {
    const text = await response.text();
    try { return JSON.parse(text); } catch { throw new Error(`پاسخ نامعتبر از سرور (${response.status})`); }
  }
  async function load() {
    const date = currentIso();
    if (date === state.lastDate && body.children.length) return;
    state.lastDate = date;
    setFormDate();
    try {
      const [expenseResponse, financeResponse] = await Promise.all([
        fetch(`/api/admin/expenses?date=${encodeURIComponent(date)}`, { credentials: "same-origin", headers: { Accept: "application/json" } }),
        fetch(`/api/admin/daily-finance?date=${encodeURIComponent(date)}`, { credentials: "same-origin", headers: { Accept: "application/json" } }),
      ]);
      const d = await readJson(expenseResponse);
      const finance = await readJson(financeResponse);
      if (!expenseResponse.ok || !d.success) throw new Error(d.message || "دریافت هزینه‌ها ناموفق بود.");
      if (!financeResponse.ok || !finance.success) throw new Error(finance.message || "دریافت درآمد ناموفق بود.");
      const s = d.summary || {};
      const income = Number(finance.summary?.receivedTotal || 0);
      const expense = Number(s.dailyTotal || 0);
      const net = income - expense;
      profitCards.innerHTML = `<div class="fel-profit-card"><span>درآمد وصول‌شده امروز</span><b>${money(income)}</b></div><div class="fel-profit-card"><span>هزینه امروز</span><b>${money(expense)}</b></div><div class="fel-profit-card net"><span>سود خالص امروز</span><b>${money(net)}</b></div>`;
      summary.innerHTML = `<div class="fel-card fel-gold"><span>هزینه امروز</span><b>${money(s.dailyTotal)}</b></div><div class="fel-card"><span>هزینه ماه</span><b>${money(s.monthlyTotal)}</b></div><div class="fel-card"><span>تعداد هزینه ماه</span><b>${money(s.count)}</b></div>`;
      const rows = d.dailyExpenses || [];
      body.innerHTML = rows.length ? rows.map(x => `<tr><td>${esc(x.expense_date)}</td><td>${esc(x.category)}</td><td>${esc(x.description || "—")}</td><td>${money(x.amount)}</td><td>${esc(methods[x.payment_method] || x.payment_method)}</td><td><button class="fel-delete" type="button" data-delete-expense="${Number(x.id)}">حذف</button></td></tr>`).join("") : `<tr><td colspan="6" class="fel-status">برای این روز هزینه‌ای ثبت نشده است.</td></tr>`;
    } catch (error) {
      body.innerHTML = `<tr><td colspan="6" class="fel-status err">${esc(error instanceof Error ? error.message : "دریافت اطلاعات مالی ناموفق بود.")}</td></tr>`;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    status.className = "fel-status";
    status.textContent = "در حال ثبت...";
    const payload = { expenseDate: currentIso(), category: document.querySelector("#felCategory").value, amount: Number(document.querySelector("#felAmount").value), paymentMethod: document.querySelector("#felMethod").value, description: document.querySelector("#felDescription").value, reference: document.querySelector("#felReference").value, note: document.querySelector("#felNote").value };
    try {
      const r = await fetch("/api/admin/expenses", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      const d = await readJson(r);
      if (!r.ok || !d.success) throw new Error(d.message || "ثبت هزینه ناموفق بود.");
      status.className = "fel-status ok";
      status.textContent = "هزینه با موفقیت ثبت شد.";
      form.reset();
      setFormDate();
      state.lastDate = "";
      await load();
    } catch (error) {
      status.className = "fel-status err";
      status.textContent = error instanceof Error ? error.message : "ثبت هزینه ناموفق بود.";
    }
  });

  body.addEventListener("click", async event => {
    const button = event.target.closest("button[data-delete-expense]");
    if (!button) return;
    const id = Number(button.dataset.deleteExpense);
    if (!id || !confirm("این هزینه حذف شود؟")) return;
    try {
      const r = await fetch(`/api/admin/expenses?id=${id}`, { method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" } });
      const d = await readJson(r);
      if (!r.ok || !d.success) throw new Error(d.message || "حذف هزینه ناموفق بود.");
      state.lastDate = "";
      load();
    } catch (error) {
      status.className = "fel-status err";
      status.textContent = error instanceof Error ? error.message : "حذف هزینه ناموفق بود.";
    }
  });

  const observer = new MutationObserver(() => {
    const nextDate = dateInput.dataset.iso || "";
    if (nextDate !== state.lastDate) load();
  });
  observer.observe(dateInput, { attributes: true, attributeFilter: ["data-iso"] });
  setFormDate();
  load();
})();
