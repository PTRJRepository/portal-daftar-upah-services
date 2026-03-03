import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(process.cwd(), "backend", "data", "users.db");
const db = new Database(dbPath, { create: false });

try {
    // Check users before update
    console.log("BEFORE UPDATE:");
    const before = db.query("SELECT id, username, divisions FROM users WHERE username = 'kerani_wks_ar'").all();
    console.log(JSON.stringify(before, null, 2));

    // Update
    db.run("UPDATE users SET divisions = '[\"WKS_AR\"]' WHERE username = 'kerani_wks_ar'");

    // Check users after update
    console.log("AFTER UPDATE:");
    const after = db.query("SELECT id, username, divisions FROM users WHERE username = 'kerani_wks_ar'").all();
    console.log(JSON.stringify(after, null, 2));
} catch (e) {
    console.error(e);
}
