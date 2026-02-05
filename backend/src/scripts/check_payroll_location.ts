
import { Database } from "../db/client";

async function main() {
    console.log("Checking Payroll Division for Workshop Gangs...");
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_2");

    // Check for gangs like HM and HMC
    const rows = await db.query<any>(`
        SELECT TOP 20 [GangCode], [Division], COUNT(*) as count
        FROM [dbo].[HR_T_PYWeekly_M]
        WHERE [GangCode] IN ('HM', 'HMC') 
          AND [PYNumber] LIKE 'PYW/PTRJ/202601%'
        GROUP BY [GangCode], [Division]
    `);

    console.log("Payroll Gang Locations:", rows);
}

main().catch(console.error);
