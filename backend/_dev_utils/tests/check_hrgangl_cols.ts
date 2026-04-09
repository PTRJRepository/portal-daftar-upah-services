import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== HR_GANGLN columns ===\n");
    const cols = await db.query<any>(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HR_GANGLN'
    `);
    console.log(`HR_GANGLN columns: ${cols.length}`);
    cols.forEach(r => console.log(`  ${r.COLUMN_NAME}`));
}

main().catch(console.error);
