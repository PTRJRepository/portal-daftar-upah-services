import { Database } from "./src/db/client";

async function checkHistorySchema() {
    const db = Database.getExtendedInstance();
    
    console.log("\n=== payroll_history_header columns ===");
    const headerCols = await db.query<any>(`
        SELECT TOP 1 * FROM payroll_history_header
    `, []);
    if (headerCols.length > 0) {
        console.log("Columns:", Object.keys(headerCols[0]).join(', '));
        console.log("Total columns:", Object.keys(headerCols[0]).length);
    }
    
    console.log("\n=== history_gang_member columns ===");
    const gangMemberCols = await db.query<any>(`
        SELECT TOP 1 * FROM history_gang_member
    `, []);
    if (gangMemberCols.length > 0) {
        console.log("Columns:", Object.keys(gangMemberCols[0]).join(', '));
        console.log("Total columns:", Object.keys(gangMemberCols[0]).length);
    }
    
    process.exit(0);
}

checkHistorySchema().catch(err => {
    console.error(err);
    process.exit(1);
});
