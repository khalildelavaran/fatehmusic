(() => {
  if (location.pathname !== '/admin/daily') return;
  const root = document.querySelector('#dailyDashboardRoot');
  if (!root) return;

  const json = async (response) => {
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`پاسخ نامعتبر از سرور دریافت شد (${response.status})`); }
    if (!response.ok || !data.success) throw new Error(data.message || `خطای سرور (${response.status})`);
    return data;
  };

  const refresh = () => document.querySelector('#refresh')?.click();
  const showError = (error) => {
    const box = document.querySelector('#error');
    if (box) { box.hidden = false; box.textContent = error instanceof Error ? error.message : String(error); }
  };

  function idsFor(target) {
    const row = target.closest('#dailyStudentRoster [data-enrollment-session-id], #dailyStudentRoster [data-student-row]');
    const enrollmentSessionId = Number(target.dataset.enrollmentSessionId || row?.dataset.enrollmentSessionId);
    let enrollmentId = Number(target.dataset.enrollmentId || row?.dataset.enrollmentId);
    if (!Number.isInteger(enrollmentId) || enrollmentId < 1) {
      const studentCard = root.querySelector(`[data-enrollment-session-id="${CSS.escape(String(enrollmentSessionId))}"]`);
      enrollmentId = Number(studentCard?.dataset.enrollmentId);
    }
    return { row, enrollmentSessionId, enrollmentId };
  }

  async function saveAttendance(button) {
    const { enrollmentSessionId, enrollmentId } = idsFor(button);
    const status = String(button.dataset.status || '');
    if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId < 1 || !Number.isInteger(enrollmentId) || enrollmentId < 1) throw new Error('شناسه هنرجو معتبر نیست.');
    button.disabled = true;
    const response = await fetch('/api/admin/daily-planner', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ enrollmentSessionId, enrollmentId, status }),
    });
    await json(response);
    refresh();
  }

  async function saveStudentTime(target) {
    const { row, enrollmentSessionId } = idsFor(target);
    if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId < 1) throw new Error('جلسه هنرجو پیدا نشد.');
    const current = String(target.dataset.startTime || row?.dataset.startTime || '').match(/^\d{2}:\d{2}$/)?.[0] || String(row?.textContent || '').match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/)?.[0] || '17:00';
    const startTime = window.prompt('ساعت شروع جدید هنرجو را وارد کنید (مثلاً 17:30):', current);
    if (startTime == null) return;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new Error('فرمت ساعت باید HH:MM باشد.');
    const [h, m] = startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + 30;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    target.disabled = true;
    const response = await fetch('/api/admin/daily-student-sessions', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ enrollmentSessionId, sessionDate: root.dataset.date || new Date().toLocaleDateString('en-CA'), startTime, endTime }),
    });
    await json(response);
    refresh();
  }

  async function saveIndividualTime(form) {
    const sessionCard = form.closest('.dd-session');
    const studentCard = sessionCard?.querySelector('[data-enrollment-session-id]');
    const enrollmentSessionId = Number(studentCard?.dataset.enrollmentSessionId);
    const startTime = form.elements.startTime?.value || '';
    if (!Number.isInteger(enrollmentSessionId) || enrollmentSessionId < 1 || !startTime) throw new Error('اطلاعات زمان هنرجو معتبر نیست.');
    const [h, m] = startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + 30;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const response = await fetch('/api/admin/daily-student-sessions', {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ enrollmentSessionId, sessionDate: root.dataset.date || new Date().toLocaleDateString('en-CA'), startTime, endTime }),
    });
    await json(response);
    refresh();
  }

  root.addEventListener('click', (event) => {
    const attendanceButton = event.target.closest('[data-action="attendance"]');
    const rosterAttendanceButton = event.target.closest('#dailyStudentRoster button[data-status]');
    const timeButton = event.target.closest('#dailyStudentRoster button');
    const target = attendanceButton || rosterAttendanceButton;
    if (target && root.contains(target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAttendance(target).catch((error) => { target.disabled = false; showError(error); });
      return;
    }
    if (timeButton && root.contains(timeButton) && /تغییر\s*ساعت/.test(timeButton.textContent || '')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveStudentTime(timeButton).catch((error) => { timeButton.disabled = false; showError(error); });
    }
  }, true);

  root.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-action="save-time"][data-individual="1"]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = form.querySelector('[data-action="submit-time"]');
    if (button) button.disabled = true;
    saveIndividualTime(form).catch((error) => { if (button) button.disabled = false; showError(error); });
  }, true);
})();