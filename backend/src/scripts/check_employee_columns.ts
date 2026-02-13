
import { Database } from "../db/client";
import { write } from "bun";

async function main() {
    const db = Database.getInstance();
    try {
        const rows = await db.query<any>("SELECT TOP 1 * FROM HR_EMPLOYEE");
        if (rows.length > 0) {
            const columns = Object.keys(rows[0]).join(", ");
            await write("employee_columns.txt", columns);
            console.log("Written to employee_columns.txt");
        } else {
            console.log("HR_EMPLOYEE is empty.");
        }
    } catch (e) {
        console.log("Error checking HR_EMPLOYEE:", e.message);
    }
}
main().catch(console.error);
