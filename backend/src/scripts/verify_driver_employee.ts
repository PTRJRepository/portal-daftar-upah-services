
import { Database } from "../db/client";

async function main() {
    const db = Database.getInstance();

    // Sample DriverCodes from previous inspection: E0075, A0255, L0028, B0679
    const sampleDrivers = ['E0075', 'A0255', 'L0028', 'B0679'];

    try {
        console.log("Checking HR_EMPLOYEE for DriverCodes:", sampleDrivers);

        const query = `
            SELECT EmployeeID, EmployeeName, GangCode 
            FROM HR_EMPLOYEE 
            WHERE EmployeeID IN (${sampleDrivers.map(d => `'${d}'`).join(',')})
        `;

        const rows = await db.query<any>(query);
        console.table(rows);

        if (rows.length === 0) {
            console.log("No matching employees found.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
