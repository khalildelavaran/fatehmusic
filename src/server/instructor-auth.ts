const TTL = 60 * 60 * 8;
const COOKIE = "__Host-instructor_session";
const ITERATIONS = 100_000;

export interface InstructorEnv { DB: D1Database; SESSION: KVNamespace; }
export interface InstructorSession { accountId: number; instructorId: number; username: string; expiresAt: number; token?: string; }

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}
function hex(b: Uint8Array) { return Array.from(b, x => x.toString(16).padStart(2, "0")).join(""); }
function bytes(s: string) { if (!/^[0-9a-f]+$/i.test(s) || s.length % 2) throw Error("invalid"); const b = new Uint8Array(s.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return b; }
async function derive(p: string, s: Uint8Array, n = ITERATIONS) { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(p), "PBKDF2", false, ["deriveBits"]); return crypto.subtle.deriveBits({ name: "PBKDF2", salt: s, iterations: n, hash: "SHA-256" }, k, 256); }
export async function hashInstructorPassword(p: string) { const s = crypto.getRandomValues(new Uint8Array(16)); return `pbkdf2-sha256$${ITERATIONS}$${hex(s)}$${hex(new Uint8Array(await derive(p, s)))}`; }
async function verify(p: string, e: string) { const x = e.split("$"); if (x.length !== 4 || x[0] !== "pbkdf2-sha256") return false; const n = Number(x[1]); if (!Number.isInteger(n) || n < 10000 || n > ITERATIONS) return false; try { const a = new Uint8Array(await derive(p, bytes(x[2]), n)), b = bytes(x[3]); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; } catch { return false; } }
export function normalizeUsername(v: string) { return v.trim().toLowerCase(); }
function token() { const b = crypto.getRandomValues(new Uint8Array(32)); let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function cookie(r: Request) { for (const p of r.headers.get("Cookie")?.split(";") ?? []) { const i = p.indexOf("="); if (i >= 0 && p.slice(0, i).trim() === COOKIE) return decodeURIComponent(p.slice(i + 1).trim()); } return null; }
function setCookie(t: string, maxAge = TTL) { return `${COOKIE}=${encodeURIComponent(t)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`; }

export async function authenticateInstructor(username: string, password: string, env: InstructorEnv): Promise<InstructorSession | null> {
  const normalized = normalizeUsername(username);
  if (!normalized || !password) return null;
  const account = await env.DB.prepare(
    "SELECT id, instructor_id, username, password_hash, is_active FROM instructor_accounts WHERE username = ? LIMIT 1",
  ).bind(normalized).first<{ id: number; instructor_id: number; username: string; password_hash: string; is_active: number }>();
  if (!account || account.is_active !== 1 || !(await verify(password, account.password_hash))) return null;

  const instructor = await env.DB.prepare("SELECT is_active FROM instructors WHERE id = ?").bind(account.instructor_id).first<{ is_active: number }>();
  if (!instructor || instructor.is_active !== 1) return null;

  const t = token();
  const session: InstructorSession = { accountId: account.id, instructorId: account.instructor_id, username: account.username, expiresAt: Date.now() + TTL * 1000, token: t };
  const { token: _discard, ...stored } = session;
  await env.SESSION.put(`instructor:${t}`, JSON.stringify(stored), { expirationTtl: TTL });
  await env.DB.prepare("UPDATE instructor_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").bind(account.id).run();
  return session;
}

export function createInstructorSessionResponse(s: InstructorSession) {
  const { token: _discard, ...user } = s;
  return json({ success: true, user }, 200, { "Set-Cookie": setCookie(s.token ?? "") });
}

export async function getInstructorSession(r: Request, env: InstructorEnv): Promise<InstructorSession | null> {
  const t = cookie(r);
  if (!t) return null;
  const raw = await env.SESSION.get(`instructor:${t}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as InstructorSession;
    if (s.expiresAt <= Date.now()) { await env.SESSION.delete(`instructor:${t}`); return null; }
    return s;
  } catch {
    await env.SESSION.delete(`instructor:${t}`);
    return null;
  }
}

export async function requireInstructor(r: Request, env: InstructorEnv): Promise<InstructorSession | Response> {
  return (await getInstructorSession(r, env)) ?? json({ success: false, message: "ورود مدرس معتبر نیست." }, 401);
}

export async function logoutInstructor(r: Request, env: InstructorEnv) {
  const t = cookie(r);
  if (t) await env.SESSION.delete(`instructor:${t}`);
}

export function clearInstructorCookie() {
  return setCookie("", 0);
}

export async function changeInstructorPassword(accountId: number, newPassword: string, env: InstructorEnv): Promise<boolean> {
  if (!newPassword || newPassword.length < 8) return false;
  const hash = await hashInstructorPassword(newPassword);
  const result = await env.DB.prepare(
    "UPDATE instructor_accounts SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
  ).bind(hash, accountId).run();
  return result?.meta?.changes !== 0;
}
