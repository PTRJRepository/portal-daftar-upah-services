import { Database } from "../db/client";

async function checkHrColumnsTopOne() {
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_1");

    try {
        const query1 = `SELECT TOP 1 * FROM HR_EMPLOYEE`;
        const result1 = await db.query(query1);
        if (result1.length > 0) {
            console.log("HR_EMPLOYEE COLUMNS:", Object.keys(result1[0]).join(", "));
        }
        
        const query2 = `SELECT TOP 1 * FROM HR_PAYROLL`;
        const result2 = await db.query(query2);
        if (result2.length > 0) {
            console.log("HR_PAYROLL COLUMNS:", Object.keys(result2[0]).join(", "));
        }
        
        // Also check if there's any table like HR_FAMILY or similar by query
        // Let's just try selecting from HR_FAMILY
        try {
            const result3 = await db.query(`SELECT TOP 1 * FROM HR_FAMILY`);
            if (result3.length > 0) console.log("HR_FAMILY exists:", Object.keys(result3[0]).join(", "));
        } catch { console.log("HR_FAMILY does not exist."); }
        
        try {
            const result4 = await db.query(`SELECT TOP 1 * FROM HR_DEPENDENT`);
            if (result4.length > 0) console.log("HR_DEPENDENT exists:", Object.keys(result4[0]).join(", "));
        } catch { console.log("HR_DEPENDENT does not exist."); }

    } catch (e) {
        console.error("Error:", e);
    }
}

checkHrColumnsTopOne();
