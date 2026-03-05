import { Database } from "../db/client";

async function debugSchema() {
    try {
        const db = Database.getInstance();
        console.log("Fetching sample data from HR_EMPLOYMENT...");
        
        const data = await db.query(`
            SELECT TOP 5 RTRIM(EmpCode) as EmpCode, AppJoinDate, AppJoinGrpDate
            FROM HR_EMPLOYMENT
        `);
        
        console.log("Sample HR_EMPLOYMENT data:");
        console.table(data);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugSchema();
