
import { Database } from "../db/client";

async function main() {
    console.log("Connecting to Mill DB...");
    const db = Database.getMillInstance();

    try {
        // Get sample tickets
        const rows = await db.query<any>(`
            SELECT TOP 10 
                TicketNo, CustomerCode, TransporterCode, VehicleCode, 
                DriverCode, DriverName, BlkCode, Subblock, NetWeight, DateReceived
            FROM [dbo].[WM_TICKET]
            WHERE DateReceived >= '2025-01-01'
            ORDER BY DateReceived DESC
        `);

        console.log("Sample WM_TICKET Rows:");
        console.table(rows);

        // Check if DriverCode exists in HR_EMPLOYEE (in Payroll DB)
        // We can't join across DBs easily in this script without linked servers, 
        // so we'll just print Drivers and manually check or assume.

        if (rows.length > 0) {
            const sampleDriver = rows[0].DriverCode;
            console.log(`\nChecking if DriverCode '${sampleDriver}' pattern matches Employee IDs...`);
        }

    } catch (e) {
        console.error("Error querying WM_TICKET:", e);
    }
}

main().catch(console.error);
