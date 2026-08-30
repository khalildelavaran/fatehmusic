const form = document.querySelector("#instructorForm");
const statusEl = document.querySelector("#instructorFormStatus");

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

function collectBody(form) {
  const data = new FormData(form);
  return {
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    specialty: String(data.get("specialty") || "").trim(),
    instruments: data.getAll("instruments").map(String),
    biography: String(data.get("biography") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
    ...(form.querySelector('input[name="isActive"]') ? { isActive: data.get("isActive") === "on" } : {})
  };
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const id = form.dataset.id ? Number(form.dataset.id) : null;
  const body = id ? { id, ...collectBody(form) } : collectBody(form);

  submitButton?.setAttribute("disabled", "true");
  setStatus(id ? "در حال ذخیره..." : "در حال ثبت...");

  try {
    const response = await fetch("/api/admin/instructors", {
      method: id ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      location.assign("/admin/login");
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    let result;
    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      result = { success: false, message: text || `خطای سرور (${response.status})` };
    }

    if (!response.ok || !result.success) {
      setStatus(result.message || `ذخیره‌سازی انجام نشد (${response.status}).`, true);
      return;
    }

    if (!id && result.profile?.instructor?.id) {
      location.assign(`/admin/instructors?id=${encodeURIComponent(result.profile.instructor.id)}`);
      return;
    }

    setStatus("تغییرات و دوره‌های مدرس با موفقیت ذخیره شد.");
  } catch (error) {
    console.error("[admin/instructors] save failed", error);
    setStatus("ارتباط با سرور برقرار نشد. اتصال اینترنت و وضعیت سرور را بررسی کنید.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
