
import { Database } from "../db/client";

async function main() {
    const dbMill = Database.getMillInstance();
    const dbPayroll = Database.getInstance();

    try {
        // 1. Get a driver from WM_TICKET
        const tickets = await dbMill.query<any>(`
            SELECT TOP 5 DriverCode, SUM(NetWeight) as W
            FROM WM_TICKET 
            WHERE MONTH(DateReceived) = 2 AND YEAR(DateReceived) = 2026
            GROUP BY DriverCode
        `);

        console.log("Drivers:", tickets);

        if (tickets.length === 0) {
            console.log("No tickets found for Feb 2026.");
            return;
        }

        // 2. Find Gang for these drivers
        const driverCodes = tickets.map(t => `'${t.DriverCode}'`).join(",");
        const mappings = await dbPayroll.query<any>(`
            SELECT GangMember, GangCode 
            FROM HR_GANGLN 
            WHERE GangMember IN (${driverCodes})
        `);

        console.log("Mappings:", mappings);

    } catch (e) {
        console.error(e);
    }
}

main().catch(console.error);
