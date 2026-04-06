/**
 * Debug script: Test taxReportService flow step by step
 */
import { Database } from "../../../src/db/client";
import { gangService } from "../../../src/services/gangService";
import { divisionDefinition } from "../../../src/services/divisionDefinition";

async function main() {
    console.log("=== DEBUG: Step-by-Step Tax Report Flow ===\n");

    const db = Database.getInstance('extend_db_ptrj', 'SERVER_PROFILE_1');

    const month = 3;
    const year = 2026;
    const divisionCode = 'P1A';
    const gangCode = 'ALL';

    // Step 1: Check gangService.getAllDivisionAliases
    console.log("1. gangService.getAllDivisionAliases('P1A'):");
    try {
        const aliases = gangService.getAllDivisionAliases(divisionCode);
        console.log("   Aliases:", aliases);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // Step 2: Check divisionDefinition.getSourceDivisionsForAggregation
    console.log("\n2. divisionDefinition.getSourceDivisionsForAggregation('P1A'):");
    try {
        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
        console.log("   Source divisions:", sourceDivs);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // Step 3: Get master IDs for ALL headers
    console.log("\n3. Master IDs for ALL headers (M=${month}, Y=${year}):");
    const allMasters = await db.query(`
        SELECT id, gang_code, division_code
        FROM dbo.payroll_history_header
        WHERE period_month = ${month} AND period_year = ${year}
    `);
    console.log("   Total master records:", allMasters.length);

    // Step 4: Get master IDs filtered by P1A division
    console.log("\n4. Master IDs with division IN ('P1A', 'PG1A', 'AB1', 'ARB1'):");
    const p1aMasters = await db.query(`
        SELECT id, gang_code, division_code
        FROM dbo.payroll_history_header
        WHERE period_month = ${month} AND period_year = ${year}
        AND division_code IN ('P1A', 'PG1A', 'AB1', 'ARB1', 'ALL')
    `);
    console.log("   Master records matching:", p1aMasters.length);
    if (p1aMasters.length > 0) {
        console.log("   Sample:", p1aMasters.slice(0, 3));
    }

    // Step 5: Check if there's a mismatch issue
    // Headers with division 'PG2B' but details with division 'P1A'
    console.log("\n5. Check header-division vs detail-division mismatch:");
    const mismatchCheck = await db.query(`
        SELECT TOP 5 h.id as master_id, h.division_code as header_div, d.division_code as detail_div, d.emp_code
        FROM dbo.payroll_history_header h
        INNER JOIN dbo.payroll_history_detail d ON d.master_id = h.id
        WHERE h.period_month = ${month} AND h.period_year = ${year}
        AND d.division_code = 'P1A'
    `);
    console.log("   Details with division_code='P1A':", mismatchCheck.length);
    if (mismatchCheck.length > 0) {
        console.log("   Sample (header_div vs detail_div):");
        mismatchCheck.slice(0, 3).forEach((r: any) => {
            console.log(`      Master ${r.master_id}: header=${r.header_div}, detail=${r.detail_div}, emp=${r.emp_code}`);
        });
    }

    // Step 6: Query details using the ACTUAL query from getHistoricalPayrollDataAsExtractorFormat
    console.log("\n6. Simulate getHistoricalPayrollDataAsExtractorFormat query for P1A:");

    // First get all master IDs
    const allMasterIds = allMasters.map((m: any) => m.id);
    const allMasterIdList = allMasterIds.join(',');

    // Then filter by P1A division in details
    const p1aDetails = await db.query(`
        SELECT COUNT(*) as cnt
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (${allMasterIdList})
        AND (division_code IN ('P1A', 'PG1A', 'AB1', 'ARB1') OR loc_code IN ('P1A', 'PG1A', 'AB1', 'ARB1'))
    `);
    console.log("   Details matching P1A:", p1aDetails[0].cnt);

    // Step 7: Check what happens with gang filtering
    console.log("\n7. Check if gang_code filtering causes issues:");
    const gangCounts = await db.query(`
        SELECT gang_code, COUNT(*) as cnt
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (${allMasterIdList})
        AND division_code = 'P1A'
        GROUP BY gang_code
        ORDER BY cnt DESC
    `);
    console.log("   Gangs with P1A division:", gangCounts.slice(0, 10));

    // Step 8: Direct query to check total details
    console.log("\n8. Total details without any division filter:");
    const totalDetails = await db.query(`
        SELECT COUNT(*) as cnt
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (${allMasterIdList})
    `);
    console.log("   Total:", totalDetails[0].cnt);

    // Step 9: Try the actual query with P1A filter
    console.log("\n9. Actual query for P1A (simulating the service):");
    const actualP1A = await db.query(`
        SELECT d.id, d.emp_code, d.emp_name, d.gang_code, d.division_code, d.pph21_ter
        FROM dbo.payroll_history_detail d
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_header
            WHERE period_month = ${month} AND period_year = ${year}
        )
        AND (division_code IN ('P1A', 'PG1A', 'AB1', 'ARB1') OR loc_code IN ('P1A', 'PG1A', 'AB1', 'ARB1'))
        LIMIT 5
    `);
    console.log("   P1A details found:", actualP1A.length);
    if (actualP1A.length > 0) {
        console.log("   Sample:", JSON.stringify(actualP1A[0], null, 2));
    }

    console.log("\n=== END ===");
}

main().catch(console.error);
