import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 310_000;

const rl = createInterface({ input, output });
const username = (await rl.question("Admin username: ")).trim();
const password = await rl.question("Admin password: ", { hideEchoBack: true });
rl.close();

if (!username || !password) throw new Error("Username and password are required.");

const salt = randomBytes(16);
const hash = await pbkdf2Async(password, salt, ITERATIONS, 32, "sha256");
const b64url = (buffer) => buffer.toString("base64url");
const passwordHash = `pbkdf2$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
const escapedUsername = username.replaceAll("'", "''");
const escapedHash = passwordHash.replaceAll("'", "''");

console.log("\nRun this SQL against the production D1 database:\n");
console.log(`INSERT INTO admin_users (username, password_hash, role, is_active) VALUES ('${escapedUsername}', '${escapedHash}', 'admin', 1);`);
console.log("\nThe password itself is never written to the repository or printed by this script.");
