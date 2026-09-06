const form = document.querySelector("#studentCreateForm");
const statusEl = document.querySelector("#studentCreateStatus");

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

function collectBody(form) {
  const data = new FormData(form);
  const rawBirthYear = data.get("birthYear") ? Number(data.get("birthYear")) : null;
  return {
    nationalCode: String(data.get("nationalCode") || "").trim(),
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    fatherName: String(data.get("fatherName") || "").trim(),
    birthYear: Number.isFinite(rawBirthYear) ? rawBirthYear : null,
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    occupation: String(data.get("occupation") || "").trim(),
    idIssuePlace: String(data.get("idIssuePlace") || "").trim(),
    emergencyContact: String(data.get("emergencyContact") || "").trim(),
    status: String(data.get("status") || "active"),
    address: String(data.get("address") || "").trim(),
    notes: String(data.get("notes") || "").trim()
  };
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const body = collectBody(form);

  submitButton?.setAttribute("disabled", "true");
  setStatus("در حال ثبت...");

  try {
    const response = await fetch("/api/admin/students", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const result = await response.json().catch(() => ({ success: false, message: "پاسخ نامعتبر از سرور." }));

    if (!response.ok || !result.success) {
      setStatus(result.message || `ثبت هنرجو انجام نشد (${response.status}).`, true);
      return;
    }

    if (result.profile?.student?.id) {
      location.assign(`/admin/students?id=${encodeURIComponent(result.profile.student.id)}`);
      return;
    }

    setStatus("هنرجو با موفقیت ثبت شد.");
    form.reset();
  } catch (error) {
    console.error("[admin/students] create failed", error);
    setStatus("ارتباط با سرور برقرار نشد. اتصال اینترنت و وضعیت سرور را بررسی کنید.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
