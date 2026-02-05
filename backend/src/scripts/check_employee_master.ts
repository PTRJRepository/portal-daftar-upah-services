
import { Database } from "../db/client";

async function main() {
    console.log("Checking Employee Master for HM...");
    const db = Database.getInstance("db_ptrj", "SERVER_PROFILE_2");

    // Check HM
    try {
        const hm = await db.queryOne<{ DivisionCode: string, LocCode: string }>(`
            SELECT TOP 1 DivisionCode, LocCode FROM [dbo].[HR_M_Employee] 
            WHERE [GangCode] = 'HM'
        `);
        console.log("HM Employee:", hm);
    } catch (e) {
        console.log("Error checking HM:", e.message);
    }

    // Check HMC
    try {
        const hmc = await db.queryOne<{ DivisionCode: string, LocCode: string }>(`
            SELECT TOP 1 DivisionCode, LocCode FROM [dbo].[HR_M_Employee] 
            WHERE [GangCode] = 'HMC'
        `);
        console.log("HMC Employee:", hmc);
    } catch (e) {
        console.log("Error checking HMC:", e.message);
    }
}

main().catch(console.error);
