/**
 * Script untuk mengecek data THR di database employee_other_incomes
 * Usage: bun run _dev_utils/scripts/debugging/check_thr_data_in_db.ts
 */

import { Database } from "../../../backend/src/db/client";

async function checkThrData() {
    const db = Database.getExtendedInstance();
    
    console.log("=== CHECK THR DATA IN employee_other_incomes ===\n");
    
    // 1. Check schema
    console.log("1. CHECK TABLE SCHEMA:");
    const schema = await db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'employee_other_incomes'
        ORDER BY ORDINAL_POSITION
    `);
    console.log("Columns:", schema);
    console.log();
    
    // 2. Check total data THR
    console.log("2. TOTAL DATA THR PER PERIODE:");
    const totalPerPeriode = await db.query(`
        SELECT 
            period_year,
            period_month,
            income_type,
            COUNT(*) as total_rows,
            COUNT(emp_code) as with_emp_code,
            COUNT(CASE WHEN emp_code IS NULL OR emp_code = '' THEN 1 END) as without_emp_code
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        GROUP BY period_year, period_month, income_type
        ORDER BY period_year DESC, period_month DESC
    `);
    console.log(totalPerPeriode);
    console.log();
    
    // 3. Sample data THR (latest 10)
    console.log("3. SAMPLE DATA THR (10 TERBARU):");
    const sample = await db.query(`
        SELECT TOP 10
            id,
            nik,
            emp_name,
            division_code,
            gang_code,
            emp_code,
            period_year,
            period_month,
            income_type,
            amount,
            details_json
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        ORDER BY id DESC
    `);
    console.log(sample);
    console.log();
    
    // 4. Check emp_code distribution
    console.log("4. EMP_CODE DISTRIBUTION:");
    const empCodeDist = await db.query(`
        SELECT 
            CASE 
                WHEN emp_code IS NULL THEN 'NULL'
                WHEN emp_code = '' THEN 'EMPTY'
                ELSE 'HAS_VALUE'
            END as emp_code_status,
            COUNT(*) as count
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        GROUP BY 
            CASE 
                WHEN emp_code IS NULL THEN 'NULL'
                WHEN emp_code = '' THEN 'EMPTY'
                ELSE 'HAS_VALUE'
            END
    `);
    console.log(empCodeDist);
    console.log();
    
    // 5. Check for THR data with NULL emp_code but has division_code/gang_code
    console.log("5. THR DATA WITHOUT emp_code BUT HAS division/gang:");
    const withoutEmpCode = await db.query(`
        SELECT TOP 10
            id,
            nik,
            emp_name,
            division_code,
            gang_code,
            emp_code,
            period_year,
            period_month,
            amount
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        AND (emp_code IS NULL OR emp_code = '')
        ORDER BY id DESC
    `);
    console.log(withoutEmpCode);
    console.log();
    
    // 6. Check history_gang_member for current period
    console.log("6. HISTORY_GANG_MEMBER (SAMPLE):");
    const gangHistory = await db.query(`
        SELECT TOP 10 *
        FROM history_gang_member
        ORDER BY id DESC
    `);
    console.log(gangHistory);
    console.log();
    
    // 7. Test query: Try to fetch THR data WITHOUT emp_code filter
    console.log("7. TEST QUERY: Fetch THR without emp_code filter (March 2026):");
    const testQuery = await db.query(`
        SELECT *
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        AND period_year = 2026
        AND period_month = 3
    `);
    console.log(`Found ${testQuery.length} rows`);
    if (testQuery.length > 0) {
        console.log("Sample row:", testQuery[0]);
    }
    console.log();
    
    // 8. Test query: Try with division_code filter
    console.log("8. TEST QUERY: Fetch THR with division_code filter:");
    const testQueryDiv = await db.query(`
        SELECT *
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        AND period_year = 2026
        AND period_month = 3
        AND division_code IN ('P1A', 'PG1A', 'Plasma 1A')
    `);
    console.log(`Found ${testQueryDiv.length} rows for division P1A/PG1A`);
    if (testQueryDiv.length > 0) {
        console.log("Sample row:", testQueryDiv[0]);
    }
    console.log();
    
    console.log("=== CHECK COMPLETE ===");
}

checkThrData()
    .then(() => {
        console.log("\nDone!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Error:", err);
        process.exit(1);
    });
