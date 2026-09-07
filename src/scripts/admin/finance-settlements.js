(() => {
  if (location.pathname !== "/admin/finance") return;
  const root = document.querySelector("#instructorsTab");
  const dateInput = document.querySelector("#financeDate");
  if (!root || !dateInput || document.querySelector("#financeSettlementLedger")) return;

  const money = value => Number(value ?? 0).toLocaleString("fa-IR");
  const esc = value => { const d = document.createElement("div"); d.textContent = String(value ?? ""); return d.innerHTML; };
  const methods = { cash: "نقدی", pos: "کارتخوان", transfer: "انتقال", online: "آنلاین", other: "سایر" };
  const state = { lastMonth: "" };

  const style = document.createElement("style");
  style.textContent = `
    #financeSettlementLedger{margin-top:0}.fsl-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px}.fsl-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px}.fsl-card span{display:block;font-size:11px;opacity:.65;margin-bottom:5px}.fsl-card b{font-size:19px}.fsl-card.gold{border-color:var(--gold-light)}.fsl-card.pending{border-color:#b89500}.fsl-card.paid{border-color:#2f8f46}.fsl-panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px}.fsl-panel h2{font-size:15px;margin:0 0 12px}.fsl-table-wrap{overflow:auto}.fsl-table{width:100%;border-collapse:collapse;font-size:13px}.fsl-table th,.fsl-table td{padding:10px 8px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}.fsl-table th{font-size:11px;opacity:.65}.fsl-table tr:last-child td{border-bottom:0}.fsl-status{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid var(--border)}.fsl-status.paid{border-color:#2f8f46}.fsl-status.pending{border-color:#b89500}.fsl-pay{border:1px solid var(--primary);background:var(--primary);color:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.fsl-pay:disabled{opacity:.5;cursor:not-allowed}.fsl-note{font-size:11px;opacity:.6;margin-top:12px}.fsl-error{padding:12px;border:1px solid #a33;border-radius:10px}.fsl-paid-date{font-size:10px;opacity:.6;display:block;margin-top:3px}@media(max-width:1100px){.fsl-summary{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.fsl-summary{grid-template-columns:1fr 1fr}.fsl-table{min-width:850px}}@media(max-width:450px){.fsl-summary{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "financeSettlementLedger";
  section.innerHTML = `<div id="fslSummary" class="fsl-summary"></div><article class="fsl-panel"><h2 id="fslTitle">تسویه اساتید</h2><div class="fsl-table-wrap"><table class="fsl-table"><thead><tr><th>استاد</th><th>درصد سهم</th><th>جلسات قابل پرداخت</th><th>مبنای سهم</th><th>مبلغ قابل پرداخت</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody id="fslBody"></tbody></table></div><div class="fsl-note">مبلغ قابل پرداخت از کارکرد همان ماه و درصد سهم ثبت‌شده برای استاد محاسبه می‌شود. ثبت تسویه فقط برای مدیر آموزشگاه مجاز است.</div></article>`;
  root.innerHTML = "";
  root.appendChild(section);

  const body = document.querySelector("#fslBody");
  const summary = document.querySelector("#fslSummary");
  const title = document.querySelector("#fslTitle");

  function currentIso() { return dateInput.dataset.iso || new Date().toISOString().slice(0, 10); }
  function currentMonth() { return currentIso().slice(0, 7); }
  function formatMonth(month) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "long" }).formatToParts(d);
    const year = parts.find(p => p.type === "year")?.value || y;
    const monthName = parts.find(p => p.type === "month")?.value || String(m);
    return `${monthName} ${year}`;
  }
  async function readJson(response) {
    const text = await response.text();
    try { return JSON.parse(text); } catch { throw new Error(`پاسخ نامعتبر از سرور (${response.status})`); }
  }
  async function load(force = false) {
    const month = currentMonth();
    if (!force && month === state.lastMonth && body.children.length) return;
    state.lastMonth = month;
    title.textContent = `تسویه اساتید — ${formatMonth(month)}`;
    body.innerHTML = `<tr><td colspan="7" class="fsl-note">در حال محاسبه کارکرد و وضعیت تسویه...</td></tr>`;
    try {
      const r = await fetch(`/api/admin/instructor-settlements?month=${encodeURIComponent(month)}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const d = await readJson(r);
      if (!r.ok || !d.success) throw new Error(d.message || "دریافت تسویه اساتید ناموفق بود.");
      const t = d.totals || {};
      summary.innerHTML = `<div class="fsl-card gold"><span>کل مبلغ قابل پرداخت</span><b>${money(t.payableAmount)}</b></div><div class="fsl-card paid"><span>پرداخت‌شده</span><b>${money(t.paidAmount)}</b></div><div class="fsl-card pending"><span>در انتظار تسویه</span><b>${money(t.pendingAmount)}</b></div><div class="fsl-card paid"><span>تعداد تسویه‌شده</span><b>${money(t.paidCount)}</b></div><div class="fsl-card pending"><span>تعداد در انتظار</span><b>${money(t.pendingCount)}</b></div>`;
      const rows = d.instructors || [];
      body.innerHTML = rows.length ? rows.map(x => {
        const paidDate = x.paidAt ? `<span class="fsl-paid-date">${esc(new Date(x.paidAt.replace(" ", "T") + "Z").toLocaleDateString("fa-IR"))}</span>` : "";
        const action = x.status === "paid" ? `<span class="fsl-status paid">پرداخت شده${paidDate}</span>` : `<button class="fsl-pay" type="button" data-settle="${Number(x.instructorId)}" data-amount="${Number(x.payableAmount)}" ${x.payableAmount <= 0 ? "disabled" : ""}>ثبت تسویه</button>`;
        return `<tr><td><b>${esc(x.instructorName)}</b></td><td>${money(x.payPercentage)}٪</td><td>${money(x.compensableSessions)}</td><td>${money(x.sessionValueTotal)}</td><td><b>${money(x.payableAmount)}</b></td><td>${x.status === "paid" ? `<span class="fsl-status paid">پرداخت شده${paidDate}</span>` : `<span class="fsl-status pending">در انتظار تسویه</span>`}</td><td>${action}</td></tr>`;
      }).join("") : `<tr><td colspan="7" class="fsl-note">استاد فعالی برای این ماه پیدا نشد.</td></tr>`;
    } catch (error) {
      summary.innerHTML = "";
      body.innerHTML = `<tr><td colspan="7"><div class="fsl-error">${esc(error instanceof Error ? error.message : "دریافت اطلاعات تسویه ناموفق بود.")}</div></td></tr>`;
    }
  }

  body.addEventListener("click", async event => {
    const button = event.target.closest("button[data-settle]");
    if (!button) return;
    const instructorId = Number(button.dataset.settle);
    const amount = Number(button.dataset.amount);
    const method = window.prompt(`مبلغ قابل پرداخت: ${money(amount)} تومان\nروش پرداخت را وارد کنید: cash / pos / transfer / online / other`, "cash");
    if (!method || !methods[method.trim()]) return;
    const note = window.prompt("یادداشت تسویه (اختیاری):", "") || "";
    button.disabled = true;
    try {
      const r = await fetch("/api/admin/instructor-settlements", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ instructorId, month: currentMonth(), paymentMethod: method.trim(), note }) });
      const d = await readJson(r);
      if (!r.ok || !d.success) throw new Error(d.message || "ثبت تسویه ناموفق بود.");
      await load(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "ثبت تسویه ناموفق بود.");
      button.disabled = false;
    }
  });

  const observer = new MutationObserver(() => {
    if (currentMonth() !== state.lastMonth) load();
  });
  observer.observe(dateInput, { attributes: true, attributeFilter: ["data-iso"] });
  load();
})();
