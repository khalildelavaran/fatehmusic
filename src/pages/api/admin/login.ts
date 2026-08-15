import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { json, type AdminEnv } from "../../../server/admin-auth";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export const POST: APIRoute = async ({ request }) => {
  const runtimeEnv = env as AdminEnv;
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "درخواست نامعتبر است." }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const debugInfo: Record<string, unknown> = {
    receivedUsername: username,
    receivedUsernameLen: username.length,
    receivedPasswordLen: password.length,
  };

  try {
    debugInfo.hasDB = !!runtimeEnv.DB;
    const user = await runtimeEnv.DB.prepare(
      "SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username = ?1 LIMIT 1"
    ).bind(username).first<{ id: number; username: string; password_hash: string; role: string; is_active: number }>();

    debugInfo.userFound = !!user;
    if (user) {
      debugInfo.isActive = user.is_active;
      debugInfo.hashFull = user.password_hash;
      const [algo, iterStr, saltHex, hashHex] = user.password_hash.split("$");
      debugInfo.parsedAlgo = algo;
      debugInfo.parsedIterations = iterStr;
      debugInfo.parsedSaltLen = saltHex?.length;
      debugInfo.parsedHashLen = hashHex?.length;

      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
      const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: Number(iterStr), hash: "SHA-256" },
        key,
        256
      );
      const derivedHex = bytesToHex(new Uint8Array(derivedBits));
      debugInfo.derivedHex = derivedHex;
      debugInfo.matches = derivedHex === hashHex;
    }
  } catch (e) {
    debugInfo.error = String(e);
  }

  return json({ success: false, message: "DEBUG MODE - REMOVE AFTER USE", debugInfo }, 401);
};
