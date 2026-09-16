(() => {
  if (location.pathname !== '/admin/daily') return;
  if (window.__dailyClosedFeedbackInstalled) return;
  window.__dailyClosedFeedbackInstalled = true;

  const CLOSED_MESSAGE = 'این روز بسته شده است و تغییرات عملیاتی جدید برای آن مجاز نیست.';
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!response || response.status !== 409) return response;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response;

    try {
      const payload = await response.clone().json();
      if (payload?.code !== 'DAILY_CLOSED') return response;

      const normalized = {
        ...payload,
        message: CLOSED_MESSAGE,
        ui_code: 'DAILY_CLOSED',
      };
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };
})();
