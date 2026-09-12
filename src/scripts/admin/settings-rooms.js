/*
 * Settings — Rooms tab (spec section 47.3).
 * Single-file controller, same pattern as the daily dashboard: one state
 * object, pure render, delegated events.
 */
(() => {
  if (location.pathname !== "/admin/settings") return;

  const root = document.querySelector("#settingsRoot");
  if (!root) return;

  const state = { rooms: [], loading: false, saving: false, message: null, messageType: null, editingId: null };

  const els = {
    list: root.querySelector("#roomList"),
    form: root.querySelector("#roomForm"),
    message: root.querySelector("#roomMessage"),
  };

  function esc(value) {
    const el = document.createElement("div");
    el.textContent = String(value ?? "");
    return el.innerHTML;
  }

  async function responseJson(response) {
    const text = await response.text();
    if (!text.trim()) throw new Error(`پاسخ خالی از سرور دریافت شد (${response.status})`);
    try { return JSON.parse(text); }
    catch { throw new Error(`پاسخ JSON نامعتبر از سرور دریافت شد (${response.status})`); }
  }

  async function apiListRooms() {
    const response = await fetch("/api/admin/rooms", { credentials: "same-origin", headers: { Accept: "application/json" } });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "دریافت اتاق‌ها با خطا مواجه شد.");
    return data.rooms;
  }
  async function apiCreateRoom(payload) {
    const response = await fetch("/api/admin/rooms", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "افزودن اتاق با خطا مواجه شد.");
    return data.room;
  }
  async function apiUpdateRoom(id, payload) {
    const response = await fetch("/api/admin/rooms", {
      method: "PATCH", credentials: "same-origin",
      headers: { "content-type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "ویرایش اتاق با خطا مواجه شد.");
    return data.room;
  }
  async function apiDeleteRoom(id) {
    const response = await fetch(`/api/admin/rooms?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" } });
    const data = await responseJson(response);
    if (!response.ok || !data.success) throw new Error(data.message || "حذف اتاق با خطا مواجه شد.");
    return data;
  }

  function render() {
    renderList();
    renderMessage();
  }

  function renderList() {
    if (state.loading) { els.list.innerHTML = `<div class="empty-note">در حال بارگذاری…</div>`; return; }
    if (!state.rooms.length) { els.list.innerHTML = `<div class="empty-note">هنوز اتاقی ثبت نشده است.</div>`; return; }
    els.list.innerHTML = state.rooms.map((room) => {
      const editing = state.editingId === room.id;
      if (editing) {
        return `
          <form class="room-row" data-action="save-edit" data-room-id="${room.id}" onsubmit="return false">
            <input type="text" name="name" value="${esc(room.name)}" maxlength="80" required style="flex:1 1 160px;min-width:120px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)" />
            <input type="number" name="capacity" min="1" value="${room.capacity}" style="width:80px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)" />
            <div class="room-row-actions">
              <button type="submit" ${state.saving ? "disabled" : ""}>ذخیره</button>
              <button type="button" data-action="cancel-edit">انصراف</button>
            </div>
          </form>`;
      }
      return `
        <div class="room-row ${room.status === "inactive" ? "is-inactive" : ""}" data-room-id="${room.id}">
          <span class="room-row-name">${esc(room.name)}</span>
          <span class="room-status-pill ${room.status}">${room.status === "active" ? "فعال" : "غیرفعال"}</span>
          <span class="room-row-meta">ظرفیت: ${room.capacity} نفر${room.notes ? ` — ${esc(room.notes)}` : ""}</span>
          <div class="room-row-actions">
            <button type="button" data-action="edit" data-room-id="${room.id}">ویرایش</button>
            <button type="button" data-action="toggle-status" data-room-id="${room.id}" data-next="${room.status === "active" ? "inactive" : "active"}">${room.status === "active" ? "غیرفعال کردن" : "فعال کردن"}</button>
            <button type="button" class="danger" data-action="delete" data-room-id="${room.id}">حذف</button>
          </div>
        </div>`;
    }).join("");
  }

  function renderMessage() {
    if (!state.message) { els.message.hidden = true; return; }
    els.message.hidden = false;
    els.message.className = `settings-message ${state.messageType}`;
    els.message.textContent = state.message;
  }

  async function load() {
    state.loading = true; render();
    try {
      state.rooms = await apiListRooms();
    } catch (err) {
      state.message = err.message || "دریافت اتاق‌ها با خطا مواجه شد.";
      state.messageType = "error";
    } finally {
      state.loading = false; render();
    }
  }

  root.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === "edit") { state.editingId = Number(actionEl.dataset.roomId); render(); }
    else if (action === "cancel-edit") { state.editingId = null; render(); }
    else if (action === "toggle-status") toggleStatus(Number(actionEl.dataset.roomId), actionEl.dataset.next);
    else if (action === "delete") deleteRoom(Number(actionEl.dataset.roomId));
  });

  root.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-action]");
    if (!form) return;
    event.preventDefault();
    if (form === els.form) createRoom(form);
    else if (form.dataset.action === "save-edit") saveEdit(form);
  });

  async function createRoom(form) {
    const name = form.elements.name.value.trim();
    const capacity = Number(form.elements.capacity.value) || 1;
    if (!name) return;
    state.saving = true; state.message = null; render();
    try {
      await apiCreateRoom({ name, capacity });
      form.reset(); form.elements.capacity.value = "1";
      state.message = "اتاق با موفقیت افزوده شد."; state.messageType = "success";
      await load();
    } catch (err) {
      state.message = err.message || "افزودن اتاق با خطا مواجه شد."; state.messageType = "error"; render();
    } finally {
      state.saving = false;
    }
  }

  async function saveEdit(form) {
    const id = Number(form.dataset.roomId);
    const name = form.elements.name.value.trim();
    const capacity = Number(form.elements.capacity.value) || 1;
    if (!name) return;
    state.saving = true; render();
    try {
      await apiUpdateRoom(id, { name, capacity });
      state.editingId = null;
      state.message = "تغییرات ذخیره شد."; state.messageType = "success";
      await load();
    } catch (err) {
      state.message = err.message || "ویرایش اتاق با خطا مواجه شد."; state.messageType = "error"; render();
    } finally {
      state.saving = false;
    }
  }

  async function toggleStatus(id, next) {
    state.saving = true; render();
    try {
      await apiUpdateRoom(id, { status: next });
      state.message = next === "active" ? "اتاق فعال شد." : "اتاق غیرفعال شد."; state.messageType = "success";
      await load();
    } catch (err) {
      state.message = err.message || "تغییر وضعیت با خطا مواجه شد."; state.messageType = "error"; render();
    } finally {
      state.saving = false;
    }
  }

  async function deleteRoom(id) {
    if (!confirm("آیا از حذف این اتاق مطمئن هستید؟ این عملیات قابل بازگشت نیست.")) return;
    state.saving = true; render();
    try {
      await apiDeleteRoom(id);
      state.message = "اتاق حذف شد."; state.messageType = "success";
      await load();
    } catch (err) {
      // Delete is blocked (409) when the room is still referenced by
      // sessions/schedules/classes — the API message explains this and
      // suggests deactivating instead (see src/server/rooms.ts).
      state.message = err.message || "حذف اتاق با خطا مواجه شد."; state.messageType = "error"; render();
    } finally {
      state.saving = false;
    }
  }

  load();
})();
