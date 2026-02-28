import { Database } from "bun:sqlite";
const db = new Database("data/users.db");
const rows = db.query("SELECT * FROM users").all();
console.log(JSON.stringify(rows, null, 2));
