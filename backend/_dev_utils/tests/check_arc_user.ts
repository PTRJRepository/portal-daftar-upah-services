import { Database } from "bun:sqlite";
import { join } from "path";

function checkUser() {
    const dbPath = join(process.cwd(), "data", "users.db");
    const db = new Database(dbPath);

    const users = db.query("SELECT * FROM users").all() as any[];
    console.log("All users:");
    for (const u of users) {
        if (u.username !== 'admin') {
            console.log(`Username: ${u.username}, Divisions: ${u.divisions}`);
        }
    }
}

checkUser();
