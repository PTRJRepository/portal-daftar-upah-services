import { Database } from "../db/client";

async function checkHrColumns() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        const query1 = `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_EMPLOYEE'
            ORDER BY ORDINAL_POSITION;
        `;
        const result1 = await db.query(query1);
        console.log("HR_EMPLOYEE COLUMNS:", result1.map(r => r.COLUMN_NAME).join(", "));
        
        const query2 = `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_PAYROLL'
            ORDER BY ORDINAL_POSITION;
        `;
        const result2 = await db.query(query2);
        console.log("HR_PAYROLL COLUMNS:", result2.map(r => r.COLUMN_NAME).join(", "));

    } catch (e) {
        console.error("Error:", e);
    }
}

checkHrColumns();
