/**
 * Check aggregation history for duplicates
 * Focus on F1BHL, WKS_PG (AMC), and probationary employees
 */
import { Database } from "./backend/src/db/client";

async function checkAggregationDuplicates() {
    console.log("=== CHECKING AGGREGATION HISTORY DUPLICATES ===\n");
    
    const db = Database.getExtendedInstance();
    
    // Check 1: F1BHL in aggregation history
    console.log("--- Check 1: F1BHL in Aggregation History ---");
    const f1bhlRows = await db.query<any>(`
        SELECT 
            division_code,
            gang_code,
            gang_description,
            period_month,
            period_year,
            total_employees,
            total_pph21,
            total_upah_bersih,
            created_at
        FROM dbo.daftar_upah_aggregation_history
        WHERE gang_code = 'F1BHL'
        ORDER BY period_year DESC, period_month DESC, created_at DESC
    `);
    
    if (f1bhlRows.length > 0) {
        console.log(`Found ${f1bhlRows.length} F1BHL aggregation records:`);
        f1bhlRows.forEach(row => {
            console.log(`  ${row.period_month}/${row.period_year} - ${row.division_code}: ${row.total_employees} employees, PPh21: ${row.total_pph21}, Bersih: ${row.total_upah_bersih}`);
        });
    } else {
        console.log("✅ No F1BHL aggregation records found\n");
    }
    
    // Check 2: WKS_PG / AMC in aggregation history
    console.log("\n--- Check 2: WKS_PG / AMC in Aggregation History ---");
    const wksPgRows = await db.query<any>(`
        SELECT 
            division_code,
            gang_code,
            gang_description,
            period_month,
            period_year,
            total_employees,
            total_pph21,
            total_upah_bersih,
            created_at
        FROM dbo.daftar_upah_aggregation_history
        WHERE gang_code = 'AMC' OR division_code = 'WKS_PG'
        ORDER BY period_year DESC, period_month DESC, gang_code, created_at DESC
    `);
    
    if (wksPgRows.length > 0) {
        console.log(`Found ${wksPgRows.length} WKS_PG/AMC aggregation records:`);
        wksPgRows.forEach(row => {
            console.log(`  ${row.period_month}/${row.period_year} - ${row.division_code}/${row.gang_code}: ${row.total_employees} employees, PPh21: ${row.total_pph21}, Bersih: ${row.total_upah_bersih}`);
        });
        
        // Check if AMC appears in P1A as well
        const amcInP1a = wksPgRows.filter(r => r.division_code === 'P1A' && r.gang_code === 'AMC');
        const amcInWksPg = wksPgRows.filter(r => r.division_code === 'WKS_PG' && r.gang_code === 'AMC');
        
        if (amcInP1a.length > 0 && amcInWksPg.length > 0) {
            console.log("\n⚠️ WARNING: AMC gang appears in BOTH P1A AND WKS_PG divisions!");
            console.log("  This will cause DUPLICATE counting!");
        }
    } else {
        console.log("✅ No WKS_PG/AMC aggregation records found\n");
    }
    
    // Check 3: Probationary gangs (BHL, P-prefix excluding PG/P1/P2)
    console.log("\n--- Check 3: Probationary Gangs (BHL/P-code) ---");
    const probRows = await db.query<any>(`
        SELECT 
            division_code,
            gang_code,
            gang_description,
            period_month,
            period_year,
            total_employees,
            total_pph21,
            total_upah_bersih,
            COUNT(*) OVER (PARTITION BY gang_code, period_month, period_year) as dup_count
        FROM dbo.daftar_upah_aggregation_history
        WHERE (gang_code LIKE '%BHL%' 
               OR (gang_code LIKE 'P%' 
                   AND gang_code NOT LIKE 'PG%' 
                   AND gang_code NOT LIKE 'P1%' 
                   AND gang_code NOT LIKE 'P2%'
                   AND gang_code NOT LIKE 'PGE%'))
        ORDER BY period_year DESC, period_month DESC, gang_code
    `);
    
    if (probRows.length > 0) {
        console.log(`Found ${probRows.length} probationary gang records:`);
        const duplicates = probRows.filter(r => r.dup_count > 1);
        if (duplicates.length > 0) {
            console.log(`\n⚠️ Found ${duplicates.length} DUPLICATE records:`);
            duplicates.forEach(row => {
                console.log(`  ${row.period_month}/${row.period_year} - ${row.division_code}/${row.gang_code}: ${row.dup_count} occurrences, ${row.total_employees} employees`);
            });
        } else {
            console.log("✅ No duplicates found in probationary gangs");
        }
    } else {
        console.log("✅ No probationary gang records found\n");
    }
    
    // Check 4: Find employees appearing in MULTIPLE gangs within same period
    console.log("\n--- Check 4: Cross-Gang Employee Duplication ---");
    // This requires checking the detail/history_gang_member table
    const crossGangEmps = await db.query<any>(`
        SELECT TOP 20
            emp_code,
            emp_name,
            period_month,
            period_year,
            COUNT(DISTINCT gang_code) as gang_count,
            STRING_AGG(gang_code, ', ') within group (order by gang_code) as gangs
        FROM dbo.history_gang_member
        GROUP BY emp_code, emp_name, period_month, period_year
        HAVING COUNT(DISTINCT gang_code) > 1
        ORDER BY gang_count DESC, emp_code
    `);
    
    if (crossGangEmps.length > 0) {
        console.log(`⚠️ Found ${crossGangEmps.length} employees appearing in multiple gangs:`);
        crossGangEmps.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} in ${row.period_month}/${row.period_year}: ${row.gang_count} gangs [${row.gangs}]`);
        });
    } else {
        console.log("✅ No cross-gang employee duplication found");
    }
    
    // Check 5: Check if same gang has MULTIPLE aggregation rows for same period
    console.log("\n--- Check 5: Multiple Aggregation Rows per Gang/Period ---");
    const multiRows = await db.query<any>(`
        SELECT 
            division_code,
            gang_code,
            period_month,
            period_year,
            COUNT(*) as row_count,
            SUM(total_employees) as sum_employees,
            STRING_AGG(CAST(total_employees AS VARCHAR), ', ') as employee_counts
        FROM dbo.daftar_upah_aggregation_history
        GROUP BY division_code, gang_code, period_month, period_year
        HAVING COUNT(*) > 1
        ORDER BY row_count DESC, period_year DESC, period_month DESC
    `);
    
    if (multiRows.length > 0) {
        console.log(`⚠️ Found ${multiRows.length} gang/period combinations with multiple rows:`);
        multiRows.slice(0, 20).forEach(row => {
            console.log(`  ${row.period_month}/${row.period_year} - ${row.division_code}/${row.gang_code}: ${row.row_count} rows, total employees: ${row.sum_employees} [${row.employee_counts}]`);
        });
        if (multiRows.length > 20) {
            console.log(`  ... and ${multiRows.length - 20} more`);
        }
    } else {
        console.log("✅ No duplicate aggregation rows found");
    }
    
    console.log("\n=== CHECK COMPLETE ===");
}

checkAggregationDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
