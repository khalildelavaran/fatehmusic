export interface AdminEnv {
  DB: D1Database;
  SESSION: KVNamespace;
  ADMIN_PASSWORD?: string;
  ADMIN_USERNAME?: string;
}

const SESSION_COOKIE = "fateh_admin_session";
const SESSION_TTL = 60 * 60 * 8;
const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, hashText] = stored.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2-sha256" || !Number.isSafeInteger(iterations) || iterations < 50_000 || !saltText || !hashText) {
    return false;
  }

  const expected = base64ToBytes(hashText);
  const actual = await derivePasswordHash(password, base64ToBytes(saltText), iterations);
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

function newSessionId(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function cookieHeader(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function createSession(env: AdminEnv, user: { id: number; username: string; role: string }): Promise<string> {
  const sessionId = newSessionId();
  await env.SESSION.put(
    `admin:${sessionId}`,
    JSON.stringify({ userId: user.id, username: user.username, role: user.role, createdAt: Date.now() }),
    { expirationTtl: SESSION_TTL }
  );
  return sessionId;
}

export async function getAdminSession(request: Request, env: AdminEnv): Promise<{ userId: number; username: string; role: string } | null> {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  const raw = await env.SESSION.get(`admin:${match[1]}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { userId: number; username: string; role: string };
  } catch {
    return null;
  }
}

export async function requireAdminSession(request: Request, env: AdminEnv): Promise<Response | null> {
  const session = await getAdminSession(request, env);
  if (!session) return json({ success: false, message: "ورود به مدیریت لازم است." }, 401);
  return null;
}

export async function loginAdmin(env: AdminEnv, username: string, password: string): Promise<{ sessionId: string; username: string; role: string } | null> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername || !password) return null;

  let user = await env.DB.prepare(
    "SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username=? LIMIT 1"
  ).bind(normalizedUsername).first<{ id: number; username: string; password_hash: string; role: string; is_active: number }>();

  // One-time bootstrap from the existing Cloudflare secret. After the first user is created,
  // authentication always uses the password hash stored in D1.
  if (!user && env.ADMIN_USERNAME && env.ADMIN_PASSWORD && normalizedUsername === env.ADMIN_USERNAME.trim().toLowerCase()) {
    if (password !== env.ADMIN_PASSWORD) return null;
    const passwordHash = await hashPassword(password);
    await env.DB.prepare(
      "INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, 'admin')"
    ).bind(normalizedUsername, passwordHash).run();
    user = await env.DB.prepare(
      "SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username=? LIMIT 1"
    ).bind(normalizedUsername).first<{ id: number; username: string; password_hash: string; role: string; is_active: number }>();
  }

  if (!user || user.is_active !== 1) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;

  await env.DB.prepare("UPDATE admin_users SET last_login_at=datetime('now'), updated_at=datetime('now') WHERE id=?").bind(user.id).run();
  const sessionId = await createSession(env, { id: user.id, username: user.username, role: user.role });
  return { sessionId, username: user.username, role: user.role };
}

export async function logoutAdmin(request: Request, env: AdminEnv): Promise<void> {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (match) await env.SESSION.delete(`admin:${match[1]}`);
}

export function sessionCookie(sessionId: string): string {
  return cookieHeader(sessionId);
}

export function clearSessionCookie(): string {
  return clearCookieHeader();
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
