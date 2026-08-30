const form = document.querySelector("#studentEditForm");
const statusEl = document.querySelector("#studentEditStatus");

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const id = Number(form.dataset.id);
  const data = new FormData(form);

  const body = {
    id,
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    fatherName: String(data.get("fatherName") || "").trim(),
    birthYear: data.get("birthYear") ? Number(data.get("birthYear")) : null,
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    occupation: String(data.get("occupation") || "").trim(),
    idIssuePlace: String(data.get("idIssuePlace") || "").trim(),
    emergencyContact: String(data.get("emergencyContact") || "").trim(),
    address: String(data.get("address") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
    status: String(data.get("status") || "active")
  };

  submitButton?.setAttribute("disabled", "true");
  setStatus("در حال ذخیره...");

  try {
    const response = await fetch("/api/admin/students", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const result = await response.json();
    if (!result.success) {
      setStatus(result.message || "ذخیره تغییرات با خطا مواجه شد.", true);
      return;
    }

    setStatus("تغییرات ذخیره شد.");
  } catch {
    setStatus("خطای شبکه هنگام ذخیره‌سازی.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
