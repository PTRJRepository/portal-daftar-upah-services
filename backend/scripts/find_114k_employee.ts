import { Database } from "../src/db/client";
import { dataExtractorService } from "../src/services/dataExtractorService";

async function findEmployee() {
    console.log("Searching for employee with wage ~114,686 in AB1...");

    // We need to bypass the filter temporarily to see "All" employees
    // But since I can't easily change the service code dynamically, 
    // I will use the debug logs I added OR rely on the fact that the service returns them if I didn't filter them?
    // Wait, I DID add the filter. So dataExtractorService WILL filter them.
    // To find the "missing" person, I need to see who IS filtered.
    // The filter logs to console if it skips.

    // HOWEVER, I can also query the raw HK data directly here to see who has low HK.

    const targetDiff = 114686;

    // 1. Get List from Service (Filtered)
    const result = await dataExtractorService.extractPayrollData(1, 2026, "ALL", "AB1", null, "SERVER_PROFILE_1");

    console.log(`Service returned ${result.data_rows.length} employees.`);

    // Check if anyone in the Result matches the diff (maybe positive diff?)
    const match = result.data_rows.find(r => Math.abs(r.upah_bersih - targetDiff) < 1000);
    if (match) {
        console.log(`[MATCH IN ACTIVE LIST] ${match.nama} (${match.nik}): ${match.upah_bersih}`);
    } else {
        console.log("No match in active list.");
    }

    // 2. We suspect the person is FILTERED out.
    // Let's manually fetch all employees in AB1 and check their HK/Wage potential.

    const db = Database.getInstance(undefined, "SERVER_PROFILE_1");
    const employees = await db.query<any>(`
        SELECT RTRIM(e.EmpCode) as emp_code, e.EmpName 
        FROM HR_EMPLOYEE e
        JOIN HR_GANGLN gl ON gl.GangMember = e.EmpCode
        WHERE gl.GangCode IN (SELECT GangCode FROM HR_GANG WHERE DivisionCode = 'AB1')
    `);

    console.log(`Total DB Employees in AB1: ${employees.length}`);

    // Identify who is NOT in the result
    const activeCodes = new Set(result.data_rows.map(r => r.nik));
    const missing = employees.filter(e => !activeCodes.has(e.emp_code));

    console.log(`Missing/Filtered Employees: ${missing.length}`);

    // For each missing employee, let's try to estimate their wage or check if they have ANY attendance
    // We can use the 'getAttendance' helper if we could access it, or just query raw.

    for (const m of missing) {
        // Check HK
        const att = await db.query<any>(`
            SELECT COUNT(DISTINCT TrxDate) as hk, SUM(Amount) as amount
            FROM PR_TASKREGLN
            WHERE EmpCode = '${m.emp_code}' 
            AND TrxDate >= '2026-01-21' AND TrxDate <= '2026-02-20' -- Approx period? Wait, month 1 2026 = Dec 21 - Jan 20 typically?
            -- Actually dataExtractorService uses dynamic period.
            -- Let's just rely on the fact that if they are missing, it's likely due to the filter.
        `);

        // Wait, I need correct dates.
        // Jan 2026 = 2025-12-21 to 2026-01-20 usually? Or calendar?
        // Plantware usually uses 21-20.
        // Let's assume standard period for check.
    }

    // BETTER APPROACH:
    // The previous debug log in dataExtractorService ALREADY logs "Action: SKIP" for F0474.
    // I should just look at the output of my previous run or run this again and watch logs?
    // But I want to find the SPECIFIC person with ~114k.

    // Let's query the specific stored aggregation history to see if we can find the old value?
    // Aggregation history stores totals, not individuals.

    // Let's just look at the user provided image 1 (List View).
    // Can I see the image? I can't "see" it but I can ask the user.
    // But wait, the user said "114k".

    // Let's Try to find anyone with Upah ~114k.
    const potential = await db.query<any>(`
         SELECT RTRIM(EmpCode) as EmpCode, SUM(Amount) as TotalAmount
         FROM PR_TASKREGLN
         WHERE TrxDate BETWEEN '2025-12-21' AND '2026-01-20'
         AND EmpCode IN (SELECT EmpCode FROM HR_EMPLOYEE WHERE LocCode LIKE 'AB1%') -- Approximate
         GROUP BY EmpCode
         HAVING SUM(Amount) > 110000 AND SUM(Amount) < 120000
    `);

    if (potential.length > 0) {
        console.log("Potential candidates with ~114k raw wages in period:");
        console.log(potential);
    }
}

findEmployee();
