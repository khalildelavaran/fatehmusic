import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

// Must match PBKDF2_ITERATIONS in src/server/admin-auth.ts.
const ITERATIONS = 210_000;

const username = (process.argv[2] ?? "").trim();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!username || !password) {
  console.error("Usage: ADMIN_PASSWORD='your-password' node scripts/create-admin-user.mjs <username>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await pbkdf2Async(password, salt, ITERATIONS, 32, "sha256");

// Format must match verifyPassword()'s "modern" branch in src/server/admin-auth.ts:
// pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>  (hex, not base64url)
const passwordHash = `pbkdf2-sha256$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;

const escapedUsername = username.replaceAll("'", "''");
const escapedHash = passwordHash.replaceAll("'", "''");

// ON CONFLICT lets this double as a password-reset command for an existing username.
console.log(
  `INSERT INTO admin_users (username, password_hash, role, is_active) VALUES ('${escapedUsername}', '${escapedHash}', 'admin', 1)\n` +
  `ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, updated_at = CURRENT_TIMESTAMP;`
);
