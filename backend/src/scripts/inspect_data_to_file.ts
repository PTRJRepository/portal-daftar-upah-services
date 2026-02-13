
import { Database } from "../db/client";
import { write } from "bun";

async function main() {
    const dbMill = Database.getMillInstance();
    const dbPayroll = Database.getInstance();
    let output = "";

    try {
        output += "=== WM_TICKET (Top 20) ===\n";
        const tickets = await dbMill.query<any>(`
            SELECT TOP 20 
                TicketNo, CustomerCode, TransporterCode, VehicleCode, 
                DriverCode, BlkCode, NetWeight, DateReceived
            FROM [dbo].[WM_TICKET]
            ORDER BY DateReceived DESC
        `);
        output += JSON.stringify(tickets, null, 2) + "\n\n";

        output += "=== PR_TASKREGLN (Top 1) ===\n";
        const taskReg = await dbPayroll.query<any>(`
            SELECT TOP 1 * FROM PR_TASKREGLN
        `);
        if (taskReg.length > 0) {
            output += "Columns: " + Object.keys(taskReg[0]).join(", ") + "\n";
            output += JSON.stringify(taskReg[0], null, 2) + "\n";
        } else {
            output += "PR_TASKREGLN is empty.\n";
        }

    } catch (e) {
        output += "Error: " + e.message + "\n";
    }

    await write("inspection_results.txt", output);
    console.log("Written to inspection_results.txt");
}

main().catch(console.error);
