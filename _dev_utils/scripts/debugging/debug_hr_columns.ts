/**
 * Check HR_EMPLOYEE columns and real NIK
 */
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance();

    // Check columns
    try {
        const cols = await db.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HR_EMPLOYEE'`);
        console.log('HR_EMPLOYEE columns:', cols.map((c: any) => c.COLUMN_NAME).join(', '));
    } catch (e: any) {
        console.log('Columns query failed:', e.message);
    }
    console.log('');

    // Try to get NIK for B0065
    try {
        const rows = await db.query(`SELECT TOP 1 * FROM HR_EMPLOYEE WHERE EmpCode = 'B0065'`);
        if (rows.length > 0) {
            console.log('B0065 employee:');
            Object.keys(rows[0]).forEach(k => console.log(`  ${k} = ${rows[0][k]}`));
        }
    } catch (e: any) {
        console.log('Employee query failed:', e.message);
    }

    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
