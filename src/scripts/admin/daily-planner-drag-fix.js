(() => {
  if (location.pathname !== "/admin/daily") return;

  const root = document.querySelector("#dailyPlanner");
  if (!root || root.dataset.dragFixBound === "1") return;
  root.dataset.dragFixBound = "1";

  const css = document.createElement("style");
  css.textContent = `
    #dailyPlanner .dp-track{position:absolute!important;inset-inline-start:112px!important;inset-inline-end:0!important;top:0!important;bottom:0!important;direction:ltr!important;overflow:visible!important}
    #dailyPlanner .dp-card{touch-action:none!important;user-select:none!important;cursor:grab!important;transform:none!important}
    #dailyPlanner .dp-card:hover{transform:none!important}
    #dailyPlanner .dp-card[data-dp-dragging="1"]{cursor:grabbing!important;z-index:100!important;transition:none!important}
    #dailyPlanner .dp-row[data-dp-drop="1"] .dp-track{outline:1px dashed rgba(212,175,55,.7);outline-offset:-2px}
  `;
  document.head.appendChild(css);

  const parse = (value) => {
    const [h, m] = String(value || "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const format = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const snap = (value) => Math.round(value / 15) * 15;

  const timeline = () => {
    const labels = [...root.querySelectorAll(".dp-hours .dp-hour")];
    const start = parse(labels[0]?.textContent?.trim());
    const end = parse(labels[labels.length - 1]?.textContent?.trim());
    return { start: Number.isFinite(start) ? start : 960, end: Number.isFinite(end) ? end : 1320 };
  };

  const drawGrid = () => {
    const labels = [...root.querySelectorAll(".dp-hours .dp-hour")];
    if (labels.length < 2) return;
    const step = 100 / (labels.length - 1);
    root.querySelectorAll(".dp-track").forEach(track => {
      track.style.backgroundImage = `repeating-linear-gradient(to right,rgba(255,255,255,.085) 0,rgba(255,255,255,.085) 1px,transparent 1px,transparent ${step}%),repeating-linear-gradient(to right,rgba(212,175,55,.16) 0,rgba(212,175,55,.16) 1px,transparent 1px,transparent ${step * 4}%)`;
      track.style.backgroundSize = `${step}% 100%,${step * 4}% 100%`;
      track.style.backgroundRepeat = "repeat-x,repeat-x";
      track.style.backgroundPosition = "0 0,0 0";
    });
  };

  const timeOfCard = (card) => {
    const text = card.querySelector("time")?.textContent?.trim() || "";
    const [start, end] = text.split("–");
    return { start: parse(start), end: parse(end) };
  };

  const freeLane = (track, start, end, card) => {
    const occupied = [...track.querySelectorAll(":scope > .dp-card")]
      .filter(other => other !== card)
      .map(other => {
        const t = timeOfCard(other);
        return { start: t.start, end: t.end, lane: Math.max(0, Math.round((parseFloat(other.style.top || "10") - 10) / 84)) };
      });
    let lane = 0;
    while (occupied.some(item => item.lane === lane && item.start != null && item.end != null && item.start < end && item.end > start)) lane += 1;
    return lane;
  };

  const rowFromPoint = (x, y) => {
    const element = document.elementFromPoint(x, y);
    return element?.closest?.(".dp-row") || null;
  };

  const updateStudentCards = (card, oldTime, newTime, roomName) => {
    const nameText = card.querySelector("strong")?.textContent?.trim() || "";
    root.querySelectorAll(".dp-student-card").forEach(studentCard => {
      const studentName = studentCard.dataset.studentName || "";
      const timeEl = studentCard.querySelector(".dp-student-meta span[dir='ltr']");
      if (!timeEl || !nameText || !studentName || !nameText.includes(studentName)) return;
      if (timeEl.textContent.trim() !== oldTime) return;
      timeEl.textContent = newTime;
      const roomEl = studentCard.querySelectorAll(".dp-student-meta")[1]?.querySelectorAll("span")[1];
      if (roomEl && roomName) roomEl.textContent = roomName;
    });
  };

  const save = async (card, start, end, roomId) => {
    const response = await fetch("/api/admin/daily-planner", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sessionId: Number(card.dataset.sessionId),
        sessionDate: (() => {
          const input = document.querySelector('input[type="date"][data-daily-date], input[type="date"][data-date], .daily-shell input[type="date"]');
          return input?.value || new Date().toISOString().slice(0, 10);
        })(),
        startTime: start,
        endTime: end,
        roomId: roomId == null || roomId === "" ? null : Number(roomId)
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || "ذخیره تغییر زمان‌بندی ناموفق بود");
  };

  const drag = {
    card: null,
    pointerId: null,
    mode: null,
    oldStart: null,
    oldEnd: null,
    oldRoomId: null,
    oldRoomName: null,
    oldTrack: null,
    lastStart: null,
    lastEnd: null,
    lastRoomId: null,
    lastRoomName: null
  };

  const clearDrop = () => root.querySelectorAll(".dp-row[data-dp-drop='1']").forEach(row => delete row.dataset.dpDrop);

  root.addEventListener("pointerdown", event => {
    if (event.target.closest(".dp-student-time-value,.dp-student-time-form")) return;
    const card = event.target.closest(".dp-card");
    if (!card) return;
    const resize = event.target.closest(".dp-resize")?.dataset.resize || null;
    const current = timeOfCard(card);
    const track = card.closest(".dp-track");
    const row = card.closest(".dp-row");
    drag.card = card;
    drag.pointerId = event.pointerId;
    drag.mode = resize || "move";
    drag.oldStart = current.start;
    drag.oldEnd = current.end;
    drag.oldRoomId = track?.dataset.roomId || card.dataset.roomId || null;
    drag.oldRoomName = track?.dataset.roomName || row?.dataset.roomName || null;
    drag.oldTrack = track;
    drag.lastStart = current.start;
    drag.lastEnd = current.end;
    drag.lastRoomId = drag.oldRoomId;
    drag.lastRoomName = drag.oldRoomName;
    card.dataset.dpDragging = "1";
    card.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, true);

  root.addEventListener("pointermove", event => {
    if (drag.card == null || drag.pointerId !== event.pointerId) return;
    const card = drag.card;
    const { start: rangeStart, end: rangeEnd } = timeline();
    const targetRow = drag.mode === "move" ? rowFromPoint(event.clientX, event.clientY) : card.closest(".dp-row");
    const targetTrack = targetRow?.querySelector(".dp-track") || drag.oldTrack;
    if (!targetTrack) return;

    clearDrop();
    if (drag.mode === "move" && targetRow) {
      targetRow.dataset.dpDrop = "1";
      if (card.parentElement !== targetTrack) targetTrack.appendChild(card);
      drag.lastRoomId = targetTrack.dataset.roomId || null;
      drag.lastRoomName = targetTrack.dataset.roomName || targetRow.dataset.roomName || null;
      card.dataset.roomId = drag.lastRoomId || "";
    }

    const rect = targetTrack.getBoundingClientRect();
    const duration = Math.max(15, (drag.oldEnd ?? rangeStart + 30) - (drag.oldStart ?? rangeStart));
    const raw = rangeStart + ((event.clientX - rect.left) / Math.max(1, rect.width)) * (rangeEnd - rangeStart);
    let nextStart = snap(raw);
    nextStart = Math.max(rangeStart, Math.min(rangeEnd - duration, nextStart));
    let nextEnd = nextStart + duration;

    if (drag.mode === "start") {
      nextStart = Math.max(rangeStart, Math.min((drag.oldEnd ?? nextEnd) - 15, snap(raw)));
      nextEnd = drag.oldEnd;
    } else if (drag.mode === "end") {
      nextStart = drag.oldStart;
      nextEnd = Math.max(nextStart + 15, Math.min(rangeEnd, snap(raw)));
    }

    drag.lastStart = nextStart;
    drag.lastEnd = nextEnd;
    const left = ((nextStart - rangeStart) / (rangeEnd - rangeStart)) * 100;
    const width = ((nextEnd - nextStart) / (rangeEnd - rangeStart)) * 100;
    card.style.left = `${left}%`;
    card.style.width = `${Math.max(1.8, width)}%`;
    if (drag.mode === "move" && targetTrack) card.style.top = `${10 + freeLane(targetTrack, nextStart, nextEnd, card) * 84}px`;
    const timeEl = card.querySelector("time");
    if (timeEl) timeEl.textContent = `${format(nextStart)}–${format(nextEnd)}`;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  root.addEventListener("pointerup", async event => {
    if (drag.card == null || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const card = drag.card;
    const oldTime = `${format(drag.oldStart)}–${format(drag.oldEnd)}`;
    const newTime = `${format(drag.lastStart)}–${format(drag.lastEnd)}`;
    const changed = drag.lastStart !== drag.oldStart || drag.lastEnd !== drag.oldEnd || String(drag.lastRoomId) !== String(drag.oldRoomId);
    const oldTrack = drag.oldTrack;
    const oldRoomId = drag.oldRoomId;
    const oldRoomName = drag.oldRoomName;
    const newRoomId = drag.lastRoomId;
    const newRoomName = drag.lastRoomName;
    drag.card = null;
    drag.pointerId = null;
    drag.mode = null;
    clearDrop();
    delete card.dataset.dpDragging;

    if (!changed) {
      if (oldTrack && card.parentElement !== oldTrack) oldTrack.appendChild(card);
      card.dataset.roomId = oldRoomId || "";
      card.querySelector("time").textContent = oldTime;
      return;
    }

    try {
      await save(card, format(drag.lastStart), format(drag.lastEnd), newRoomId);
      updateStudentCards(card, oldTime, newTime, newRoomName);
      window.dispatchEvent(new CustomEvent("daily-planner-session-changed", { detail: { sessionId: Number(card.dataset.sessionId), roomId: newRoomId, startTime: format(drag.lastStart), endTime: format(drag.lastEnd) } }));
    } catch (error) {
      if (oldTrack) oldTrack.appendChild(card);
      card.dataset.roomId = oldRoomId || "";
      card.querySelector("time").textContent = oldTime;
      const { start: rangeStart, end: rangeEnd } = timeline();
      card.style.left = `${((drag.oldStart - rangeStart) / (rangeEnd - rangeStart)) * 100}%`;
      card.style.width = `${Math.max(1.8, ((drag.oldEnd - drag.oldStart) / (rangeEnd - rangeStart)) * 100)}%`;
      void oldRoomName;
      void error;
    }
  }, true);

  root.addEventListener("pointercancel", event => {
    if (drag.card == null || drag.pointerId !== event.pointerId) return;
    const card = drag.card;
    if (drag.oldTrack) drag.oldTrack.appendChild(card);
    card.dataset.roomId = drag.oldRoomId || "";
    card.querySelector("time").textContent = `${format(drag.oldStart)}–${format(drag.oldEnd)}`;
    drag.card = null;
    drag.pointerId = null;
    drag.mode = null;
    clearDrop();
    delete card.dataset.dpDragging;
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(drawGrid));
  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener("resize", drawGrid);
  requestAnimationFrame(drawGrid);
})();
