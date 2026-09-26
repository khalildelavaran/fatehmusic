/* Fateh Music Academy — lightweight field Core Web Vitals observer. */
(() => {
  const path = window.location.pathname;
  const samples = [];
  let reportedLcp = false;
  let clsValue = 0;
  let inpValue = 0;
  let currentSession = { startedAt: Date.now() };

  const rating = (metric, value) => {
    if (metric === "lcp") return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    if (metric === "inp") return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    if (metric === "cls") return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    return "unknown";
  };

  const emit = (metric, value) => {
    if (!Number.isFinite(value) || value < 0) return;
    const sample = {
      metric,
      value: Number(metric === "cls" ? value.toFixed(4) : value.toFixed(1)),
      rating: rating(metric, value),
      path,
      timestamp: Date.now()
    };
    samples.push(sample);
    window.__fatehWebVitals = samples.slice();

    const send = () => {
      if (typeof window.gtag !== "function") return false;
      window.gtag("event", "web_vital", {
        metric_name: sample.metric,
        metric_value: sample.value,
        metric_rating: sample.rating,
        page_path: sample.path
      });
      return true;
    };

    if (!send()) {
      let attempts = 0;
      const retry = () => {
        if (send() || attempts >= 10) return;
        attempts += 1;
        window.setTimeout(retry, 1000);
      };
      window.setTimeout(retry, 250);
    }
  };

  const resetForBfcache = () => {
    clsValue = 0;
    inpValue = 0;
    reportedLcp = false;
    currentSession = { startedAt: Date.now() };
  };

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) resetForBfcache();
  });

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        window.__fatehLcpEntry = last;
      }
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });

    const reportLcp = () => {
      if (reportedLcp || !window.__fatehLcpEntry) return;
      reportedLcp = true;
      emit("lcp", window.__fatehLcpEntry.startTime);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") reportLcp();
    }, { once: true });
    window.addEventListener("pagehide", reportLcp, { once: true });
  } catch {}

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        clsValue += entry.value || 0;
      }
      window.__fatehCls = clsValue;
    });
    observer.observe({ type: "layout-shift", buffered: true });
    const reportCls = () => emit("cls", clsValue);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") reportCls();
    }, { once: true });
    window.addEventListener("pagehide", reportCls, { once: true });
  } catch {}

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.interactionId || entry.duration <= inpValue) continue;
        inpValue = entry.duration;
        window.__fatehInp = inpValue;
      }
      if (inpValue > 0) {
        clearTimeout(window.__fatehInpTimer);
        window.__fatehInpTimer = window.setTimeout(() => emit("inp", inpValue), 1000);
      }
    });
    observer.observe({ type: "event", buffered: true, durationThreshold: 40 });
  } catch {}
})();
