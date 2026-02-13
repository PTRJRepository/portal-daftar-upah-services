
import { Database } from "../db/client";

async function main() {
    console.log("Connecting to Mill DB...");
    const db = Database.getMillInstance();

    try {
        // Get sample tickets - limit to last 3 months just in case
        // Removing WHERE clause to see if ANY data exists
        const rows = await db.query<any>(`
            SELECT TOP 10 
                TicketNo, CustomerCode, TransporterCode, VehicleCode, 
                DriverCode, DriverName, BlkCode, Subblock, NetWeight, DateReceived
            FROM [dbo].[WM_TICKET]
            ORDER BY DateReceived DESC
        `);

        if (rows.length > 0) {
            console.log(`Found ${rows.length} tickets.`);
            console.table(rows);
            // Print one row in detail
            console.log("Detail Row:", JSON.stringify(rows[0], null, 2));
        } else {
            console.log("No tickets found in WM_TICKET.");
        }

    } catch (e) {
        console.error("Error querying WM_TICKET:", e);
    }
}

main().catch(console.error);
