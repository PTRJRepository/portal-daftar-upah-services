/**
 * Diagnostic script: Check THR data in extend_db_ptrj database
 * Run with: npx tsx _dev_utils/tests/diagnose_thr_report.ts
 */

import { Database } from "../../backend/src/db/client";

async function main() {
    console.log("=== THR REPORT DIAGNOSTIC ===\n");
    
    const db = Database.getExtendedInstance();
    
    // 1. Check if employee_other_incomes table exists
    console.log("1. Checking table existence...");
    const tableCheck = await db.query(`
        SELECT COUNT(*) as cnt 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'employee_other_incomes' AND TABLE_SCHEMA = 'dbo'
    `) as any[];
    
    console.log(`   Table exists: ${tableCheck[0]?.cnt > 0 ? 'YES' : 'NO'}`);
    if (tableCheck[0]?.cnt === 0) {
        console.log("   ERROR: Table employee_other_incomes does not exist!");
        console.log("   SOLUTION: Run the THR calculation first to create the table and save data.\n");
        return;
    }
    
    // 2. Check for THR data in current period (Feb 2026)
    console.log("\n2. Checking THR data for period 2/2026...");
    const thrCount = await db.query(`
        SELECT COUNT(*) as cnt 
        FROM employee_other_incomes 
        WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
    `) as any[];
    
    console.log(`   THR records found: ${thrCount[0]?.cnt || 0}`);
    
    if (!thrCount[0] || thrCount[0].cnt === 0) {
        console.log("   ⚠️  NO THR DATA FOUND!");
        console.log("   SOLUTION: Go to Other Incomes page and click 'Calculate THR' button.\n");
    } else {
        console.log("   ✓ THR data exists.\n");
    }
    
    // 3. Check data by division
    console.log("3. THR data breakdown by division:");
    const byDivision = await db.query(`
        SELECT division_code, COUNT(*) as cnt, SUM(amount) as total
        FROM employee_other_incomes 
        WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
        GROUP BY division_code
        ORDER BY division_code
    `) as any[];
    
    if (byDivision.length === 0) {
        console.log("   No data found.\n");
    } else {
        console.log("   Division breakdown:");
        byDivision.forEach((row: any) => {
            console.log(`   - ${row.division_code}: ${row.cnt} employees, Total: Rp ${Number(row.total).toLocaleString('id-ID')}`);
        });
        console.log();
    }
    
    // 4. Check data by gang
    console.log("4. THR data breakdown by gang (top 10):");
    const byGang = await db.query(`
        SELECT TOP 10 gang_code, COUNT(*) as cnt, SUM(amount) as total
        FROM employee_other_incomes 
        WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
        GROUP BY gang_code
        ORDER BY cnt DESC
    `) as any[];
    
    if (byGang.length === 0) {
        console.log("   No data found.\n");
    } else {
        console.log("   Gang breakdown (top 10):");
        byGang.forEach((row: any) => {
            console.log(`   - ${row.gang_code}: ${row.cnt} employees, Total: Rp ${Number(row.total).toLocaleString('id-ID')}`);
        });
        console.log();
    }
    
    // 5. Sample records
    console.log("5. Sample THR records (first 5):");
    const samples = await db.query(`
        SELECT TOP 5 
            nik, emp_name, division_code, gang_code, 
            amount, income_name,
            CASE WHEN details_json IS NULL THEN 'NULL' 
                 ELSE LEFT(details_json, 80) + '...' 
            END as details_preview
        FROM employee_other_incomes 
        WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
        ORDER BY created_at DESC
    `) as any[];
    
    if (samples.length === 0) {
        console.log("   No sample records.\n");
    } else {
        samples.forEach((row: any, i: number) => {
            console.log(`   ${i + 1}. ${row.emp_name} (${row.nik})`);
            console.log(`      Div: ${row.division_code} | Gang: ${row.gang_code}`);
            console.log(`      Amount: Rp ${Number(row.amount).toLocaleString('id-ID')}`);
            console.log(`      Income Name: ${row.income_name}`);
            console.log(`      Details: ${row.details_preview}\n`);
        });
    }
    
    // 6. Check details_json content
    console.log("6. Checking details_json content...");
    const withDetails = await db.query(`
        SELECT COUNT(*) as cnt 
        FROM employee_other_incomes 
        WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
        AND details_json IS NOT NULL
    `) as any[];
    
    console.log(`   Records with details_json: ${withDetails[0]?.cnt || 0}`);
    
    const sampleDetails = await db.query(`
        SELECT TOP 1 details_json
        FROM employee_other_incomes 
        WHERE income_type = 'THR' AND period_month = 2 AND period_year = 2026
        AND details_json IS NOT NULL
    `) as any[];
    
    if (sampleDetails[0]?.details_json) {
        try {
            const parsed = JSON.parse(sampleDetails[0].details_json);
            console.log("   Sample variables from details_json:");
            if (parsed.variables) {
                Object.keys(parsed.variables).forEach(key => {
                    console.log(`      - ${key}: ${parsed.variables[key]}`);
                });
            }
        } catch (e) {
            console.log("   Could not parse details_json:", e);
        }
    }
    console.log();
    
    // 7. Summary
    console.log("=== DIAGNOSTIC SUMMARY ===");
    if (!thrCount[0] || thrCount[0].cnt === 0) {
        console.log("❌ ISSUE: No THR data found in database.");
        console.log("✅ FIX: Go to 'Pendapatan Tidak Tetap' page and click 'Hitung THR' button.");
    } else {
        console.log("✓ THR data exists in database.");
        console.log("✓ If report still doesn't show, check:");
        console.log("  - Division filter in the report page");
        console.log("  - Browser console for API errors");
        console.log("  - Backend logs for query errors");
    }
    
    process.exit(0);
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
