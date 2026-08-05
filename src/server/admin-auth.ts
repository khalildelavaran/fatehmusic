export interface AdminEnv {
  ADMIN_PASSWORD?: string;
}

export function verifyAdminRequest(request: Request, env: AdminEnv): Response | null {
  const configuredPassword = env.ADMIN_PASSWORD;

  if (!configuredPassword) {
    return json({ success: false, message: "رمز مدیریت روی سرور تنظیم نشده است." }, 503);
  }

  const password = request.headers.get("x-admin-password") ?? "";

  if (password !== configuredPassword) {
    return json({ success: false, message: "دسترسی مدیریت معتبر نیست." }, 401);
  }

  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}