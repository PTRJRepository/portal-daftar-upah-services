import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(process.cwd(), "backend", "data", "users.db");
const db = new Database(dbPath, { create: false });

const rows = db.query("SELECT username, role, divisions FROM users WHERE username LIKE 'kerani_%'").all();
console.log(JSON.stringify(rows, null, 2));
