const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SESSION_COOKIE = "__Host-admin_session";
const PBKDF2_ITERATIONS = 210_000;

export interface AdminEnv {
  DB: D1Database;
  SESSION: KVNamespace;
}

export interface AdminSession {
  userId: number;
  username: string;
  role: string;
  expiresAt: number;
  token?: string;
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) {
    throw new Error("Invalid hex");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(
      hex.slice(i * 2, i * 2 + 2),
      16
    );
  }

  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS
): Promise<ArrayBuffer> {

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    {
      name: "PBKDF2"
    },
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    key,
    256
  );
}

export async function hashPassword(password: string): Promise<string> {

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hash = new Uint8Array(
    await derive(password, salt)
  );

  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}


async function verifyPassword(
  password: string,
  encoded: string
): Promise<boolean> {

  const parts = encoded.split("$");

  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2-sha256"
  ) {
    console.log("VERIFY FORMAT ERROR", encoded);
    return false;
  }


  const iterations = Number(parts[1]);
  const saltHex = parts[2];
  const hashHex = parts[3];


  if (
    !Number.isInteger(iterations) ||
    iterations < 100000 ||
    iterations > 1000000
  ) {
    console.log("VERIFY ITERATION ERROR", iterations);
    return false;
  }


  try {

    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      {
        name: "PBKDF2"
      },
      false,
      ["deriveBits"]
    );


    const derived = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: hexToBytes(saltHex),
        iterations,
        hash: "SHA-256"
      },
      passwordKey,
      256
    );


    const actualHash = bytesToHex(
      new Uint8Array(derived)
    );


    console.log("VERIFY DEBUG", {
      passwordLength: password.length,
      iterations,
      saltHex,
      expectedHash: hashHex,
      actualHash,
      match: actualHash === hashHex
    });


    return actualHash === hashHex;


  } catch (error) {

    console.log(
      "VERIFY ERROR",
      String(error)
    );

    return false;
  }
}


function randomToken(): string {

  const bytes = crypto.getRandomValues(
    new Uint8Array(32)
  );

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function cookies(request: Request): Record<string, string> {

  const result: Record<string, string> = {};

  for (
    const part of request.headers.get("Cookie")?.split(";") ?? []
  ) {

    const i = part.indexOf("=");

    if (i >= 0) {

      result[
        part.slice(0, i).trim()
      ] =
        decodeURIComponent(
          part.slice(i + 1).trim()
        );
    }
  }

  return result;
}


function setCookie(
  token: string,
  maxAge = SESSION_TTL_SECONDS
): string {

  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}



export async function authenticateAdmin(
  username: string,
  password: string,
  env: AdminEnv
): Promise<AdminSession | null> {


  const user = await env.DB.prepare(
    `
    SELECT id, username, password_hash, role, is_active
    FROM admin_users
    WHERE username = ?1
    LIMIT 1
    `
  )
  .bind(username)
  .first<{
    id:number;
    username:string;
    password_hash:string;
    role:string;
    is_active:number;
  }>();
  console.log("FULL ADMIN HASH DEBUG", {
    username: user?.username,
    hash: user?.password_hash,
    active: user?.is_active
  });

  if (!user) {

    console.log(
      "ADMIN DEBUG: user not found"
    );

    return null;
  }


  console.log(
    "ADMIN DEBUG:",
    {
      username:user.username,
      active:user.is_active,
      hashPrefix:user.password_hash.slice(0,25)
    }
  );


  const valid = await verifyPassword(
    password,
    user.password_hash
  );


  console.log(
    "ADMIN DEBUG verify:",
    valid
  );


  if (
    user.is_active !== 1 ||
    !valid
  ) {
    return null;
  }



  const token = randomToken();


  const session: AdminSession = {

    userId:user.id,
    username:user.username,
    role:user.role,
    expiresAt:
      Date.now() +
      SESSION_TTL_SECONDS * 1000,

    token
  };


  const {
    token: _,
    ...stored
  } = session;


  await env.SESSION.put(
    `admin:${token}`,
    JSON.stringify(stored),
    {
      expirationTtl:SESSION_TTL_SECONDS
    }
  );


  return session;
}



export function createSessionResponse(
  session: AdminSession
): Response {

  const {
    token,
    ...user
  } = session;


  return json(
    {
      success:true,
      user
    },
    200,
    {
      "Set-Cookie":setCookie(token ?? "")
    }
  );
}



export async function getAdminSession(
  request: Request,
  env: AdminEnv
): Promise<AdminSession | null> {


  const token =
    cookies(request)[SESSION_COOKIE];


  if (!token) {
    return null;
  }


  const raw =
    await env.SESSION.get(
      `admin:${token}`
    );


  if (!raw) {
    return null;
  }


  try {

    const session =
      JSON.parse(raw) as AdminSession;


    if (
      !session.expiresAt ||
      session.expiresAt <= Date.now()
    ) {

      await env.SESSION.delete(
        `admin:${token}`
      );

      return null;
    }


    return session;


  } catch {

    await env.SESSION.delete(
      `admin:${token}`
    );

    return null;
  }
}



export async function requireAdmin(
  request: Request,
  env: AdminEnv
): Promise<Response | null> {

  return (
    await getAdminSession(request, env)
  )
    ? null
    : json(
        {
          success:false,
          message:"دسترسی مدیریت معتبر نیست."
        },
        401
      );
}



export async function logoutAdmin(
  request: Request,
  env: AdminEnv
): Promise<void> {

  const token =
    cookies(request)[SESSION_COOKIE];


  if (token) {

    await env.SESSION.delete(
      `admin:${token}`
    );
  }
}



export function clearSessionCookie(): string {

  return setCookie(
    "",
    0
  );
}
