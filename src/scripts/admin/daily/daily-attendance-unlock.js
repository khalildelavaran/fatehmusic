/*
 * Attendance controls are intentionally never locked by unrelated saves.
 * The dashboard controller still uses the shared saving counter for payment,
 * renewal and schedule edits. Attendance must remain reversible at all times.
 */
(() => {
  if (location.pathname !== "/admin/daily") return;
  const root = document.querySelector("#dailyDashboardRoot");
  if (!root) return;

  // The legacy controller renders `disabled` from the global saving counter.
  // Remove that accidental UI lock before the browser dispatches the click.
  // This is deliberately scoped to attendance buttons only.
  root.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("button.dd-attendance-button");
    if (button?.disabled) button.disabled = false;
  }, true);

  // Also make keyboard activation behave the same way after a render.
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const button = event.target.closest("button.dd-attendance-button");
    if (button?.disabled) button.disabled = false;
  }, true);
})();
