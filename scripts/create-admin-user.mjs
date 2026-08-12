import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 310_000;
const username = (process.argv[2] ?? "").trim();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!username || !password) {
  console.error("Usage: ADMIN_PASSWORD='your-password' node scripts/create-admin-user.mjs <username>");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await pbkdf2Async(password, salt, ITERATIONS, 32, "sha256");
const b64url = (buffer) => buffer.toString("base64url");
const passwordHash = `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
const escapedUsername = username.replaceAll("'", "''");
const escapedHash = passwordHash.replaceAll("'", "''");

console.log(`INSERT INTO admin_users (username, password_hash, role, is_active) VALUES ('${escapedUsername}', '${escapedHash}', 'admin', 1);`);
