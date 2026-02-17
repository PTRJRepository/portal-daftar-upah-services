
import { harvesterService } from "../../backend/src/services/harvesterService";
import { Database } from "../../backend/src/db/client";

async function testHarvest() {
    const db = Database.getInstance();

    try {
        console.log("Searching for a harvester with weight data...");
        // Find an employee with weight data in 2024 or 2025
        const query = `
            SELECT TOP 1 EmpCode, MONTH(TrxDate) as Month, YEAR(TrxDate) as Year, SUM(TotalWeight) as TotalWeight
            FROM PR_HARVESTERLN_ARC
            WHERE TotalWeight > 0 AND TrxDate >= '2024-01-01'
            GROUP BY EmpCode, MONTH(TrxDate), YEAR(TrxDate)
            ORDER BY TotalWeight DESC
        `;

        const rows = await db.query<any>(query);

        if (rows.length === 0) {
            console.log("No harvest data with weight found. Trying to find any harvest data...");
            const queryFallback = `
                SELECT TOP 1 EmpCode, MONTH(TrxDate) as Month, YEAR(TrxDate) as Year
                FROM PR_HARVESTERLN_ARC
                WHERE TrxDate >= '2024-01-01'
            `;
            const rowsFallback = await db.query<any>(queryFallback);
            if (rowsFallback.length === 0) {
                console.log("No harvest data found at all.");
                return;
            }
            rows.push(rowsFallback[0]);
        }

        const target = rows[0];
        console.log(`Testing with Employee: ${target.EmpCode}, Period: ${target.Month}/${target.Year}`);

        const results = await harvesterService.getDailyEmployeeHarvest(target.EmpCode, target.Month, target.Year);

        console.log(`Found ${results.length} daily records.`);
        if (results.length > 0) {
            console.log("Sample Record:", results[0]);
            const totalWeight = results.reduce((sum, r) => sum + (r.TotalWeight || 0), 0);
            const totalBunches = results.reduce((sum, r) => sum + (r.TotalBunches || 0), 0);
            console.log(`Total Weight: ${totalWeight} Kg`);
            console.log(`Total Bunches: ${totalBunches} Jjg`);
        } else {
            console.log("No results returned from service.");
        }

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        // process.exit(0); // Optional, might needed if DB connection hangs
    }
}

testHarvest();
