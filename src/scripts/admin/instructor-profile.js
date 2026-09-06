const form = document.querySelector("#instructorForm");
const statusEl = document.querySelector("#instructorFormStatus");

function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", isError);
}

function collectBody(form) {
  const data = new FormData(form);
  const rawPercentage = Number(data.get("payPercentage"));
  return {
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    specialty: String(data.get("specialty") || "").trim(),
    payPercentage: Number.isFinite(rawPercentage) ? rawPercentage : 50,
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

const accountForm = document.querySelector("#instructorAccountForm");
const accountStatusEl = document.querySelector("#instructorAccountFormStatus");

function setAccountStatus(text, isError = false) {
  if (!accountStatusEl) return;
  accountStatusEl.textContent = text;
  accountStatusEl.classList.toggle("is-error", isError);
}

accountForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = accountForm.querySelector('button[type="submit"]');
  const instructorId = Number(accountForm.dataset.instructorId);
  const data = new FormData(accountForm);
  const body = {
    instructorId,
    username: String(data.get("username") || "").trim(),
    password: String(data.get("password") || "")
  };

  submitButton?.setAttribute("disabled", "true");
  setAccountStatus("در حال ثبت...");

  try {
    const response = await fetch("/api/admin/instructor-accounts", {
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
      setAccountStatus(result.message || `ثبت حساب کاربری انجام نشد (${response.status}).`, true);
      return;
    }

    setAccountStatus(result.message || "حساب کاربری مدرس با موفقیت تنظیم شد.");
    accountForm.reset();
  } catch (error) {
    console.error("[admin/instructor-accounts] save failed", error);
    setAccountStatus("ارتباط با سرور برقرار نشد. اتصال اینترنت و وضعیت سرور را بررسی کنید.", true);
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
