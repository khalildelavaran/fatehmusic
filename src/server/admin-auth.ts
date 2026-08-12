export interface AdminEnv {
  DB?: D1Database;
  SESSION?: KVNamespace;
}

export const ADMIN_SESSION_COOKIE = "__Host-fateh_admin";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const PBKDF2_ITERATIONS = 310_000;

export interface AdminSession {
  userId: number;
  username: string;
  role: string;
  expiresAt: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;

  try {
    const salt = fromBase64Url(parts[2]);
    const expected = fromBase64Url(parts[3]);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      expected.length * 8
    );
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i];
    return difference === 0;
  } catch {
    return false;
  }
}

function getCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const part of cookies.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

export async function getAdminSession(request: Request, env: AdminEnv): Promise<AdminSession | null> {
  if (!env.SESSION) return null;
  const sessionId = getCookie(request, ADMIN_SESSION_COOKIE);
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;

  const raw = await env.SESSION.get(`admin:${sessionId}`);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AdminSession;
    if (!session.userId || !session.username || !session.expiresAt || session.expiresAt <= Date.now()) {
      await env.SESSION.delete(`admin:${sessionId}`);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function createAdminSession(env: AdminEnv, session: AdminSession): Promise<string> {
  if (!env.SESSION) throw new Error("SESSION binding is not configured");
  const sessionId = crypto.randomUUID();
  await env.SESSION.put(`admin:${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  return sessionId;
}

export async function destroyAdminSession(request: Request, env: AdminEnv): Promise<void> {
  if (!env.SESSION) return;
  const sessionId = getCookie(request, ADMIN_SESSION_COOKIE);
  if (sessionId) await env.SESSION.delete(`admin:${sessionId}`);
}

export async function requireAdmin(request: Request, env: AdminEnv): Promise<AdminSession | Response> {
  const session = await getAdminSession(request, env);
  if (!session) {
    return json({ success: false, message: "نیاز به ورود به حساب مدیریت است." }, 401);
  }
  return session;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
