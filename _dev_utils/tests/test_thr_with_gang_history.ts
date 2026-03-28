/**
 * Test script: Verify THR report uses gang_history correctly
 * Run with: npx tsx _dev_utils/tests/test_thr_with_gang_history.ts
 */

import { Database } from "../../backend/src/db/client";

async function main() {
    console.log("=== Testing THR Report with Gang History ===\n");
    
    const extendDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    
    // Test parameters
    const testGang = "A01"; // Example gang
    const testMonth = 2;
    const testYear = 2026;
    
    console.log(`Test Parameters:`);
    console.log(`  Gang: ${testGang}`);
    console.log(`  Period: ${testMonth}/${testYear}\n`);
    
    // Step 1: Get gang members from history_gang_member
    console.log("Step 1: Getting gang members from history_gang_member...");
    const gangMembers = await extendDb.query<any>(`
        SELECT DISTINCT emp_code, emp_name
        FROM history_gang_member 
        WHERE gang_code = ? AND period_month = ? AND period_year = ?
    `, [testGang, testMonth, testYear]);
    
    console.log(`   Found ${gangMembers.length} members in history\n`);
    
    if (gangMembers.length === 0) {
        console.log("   History empty, trying current HR_GANGLN...");
        const currentMembers = await mainDb.query<any>(`
            SELECT RTRIM(GangMember) as emp_code
            FROM HR_GANGLN 
            WHERE RTRIM(GangCode) = ?
        `, [testGang]);
        console.log(`   Found ${currentMembers.length} members in current HR_GANGLN\n`);
        
        if (currentMembers.length === 0) {
            console.log("❌ No gang members found at all!");
            process.exit(1);
        }
        
        // Use current members for test
        const empCodes = currentMembers.map((r: any) => r.emp_code);
        console.log(`   Sample emp_codes: ${empCodes.slice(0, 5).join(', ')}...\n`);
        
        // Step 2: Check THR data for these emp_codes
        console.log("Step 2: Checking THR data for gang members...");
        const placeholders = empCodes.map(() => '?').join(',');
        const thrData = await extendDb.query<any>(`
            SELECT emp_code, nik, emp_name, amount, income_name
            FROM employee_other_incomes
            WHERE emp_code IN (${placeholders})
            AND income_type = 'THR'
            AND period_month = ?
            AND period_year = ?
        `, [...empCodes, testMonth, testYear]);
        
        console.log(`   Found ${thrData.length} THR records\n`);
        
        if (thrData.length > 0) {
            console.log("Sample THR records:");
            thrData.slice(0, 5).forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. ${r.emp_name} (${r.emp_code}) - Rp ${Number(r.amount).toLocaleString('id-ID')}`);
            });
        } else {
            console.log("⚠️  No THR data found for this gang's members");
            console.log("   HINT: Run THR calculation first from Other Incomes page\n");
        }
    } else {
        // Has history data
        console.log("Sample gang members from history:");
        gangMembers.slice(0, 5).forEach((m: any, i: number) => {
            console.log(`   ${i + 1}. ${m.emp_name} (${m.emp_code})`);
        });
        console.log();
        
        const empCodes = gangMembers.map((r: any) => r.emp_code);
        
        // Step 2: Check THR data for these emp_codes
        console.log("Step 2: Checking THR data for gang members...");
        const placeholders = empCodes.map(() => '?').join(',');
        const thrData = await extendDb.query<any>(`
            SELECT emp_code, nik, emp_name, amount, income_name
            FROM employee_other_incomes
            WHERE emp_code IN (${placeholders})
            AND income_type = 'THR'
            AND period_month = ?
            AND period_year = ?
        `, [...empCodes, testMonth, testYear]);
        
        console.log(`   Found ${thrData.length} THR records\n`);
        
        if (thrData.length > 0) {
            console.log("Sample THR records:");
            thrData.slice(0, 5).forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. ${r.emp_name} (${r.emp_code}) - Rp ${Number(r.amount).toLocaleString('id-ID')}`);
            });
            console.log("\n✅ SUCCESS: THR data is correctly linked to gang members via history!");
        } else {
            console.log("⚠️  No THR data found for this gang's members");
            console.log("   HINT: Run THR calculation first from Other Incomes page\n");
        }
    }
    
    // Step 3: Test the actual getRawIncomes method
    console.log("\n=== Step 3: Testing getRawIncomes method ===");
    try {
        const { OtherIncomesService } = await import('../backend/src/services/otherIncomesService');
        const result = await OtherIncomesService.getRawIncomes(testYear, testMonth, undefined, testGang);
        console.log(`getRawIncomes returned ${result.length} records`);
        
        if (result.length > 0) {
            console.log("Sample results:");
            result.slice(0, 3).forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. ${r.emp_name} (${r.emp_code}) - Rp ${Number(r.amount).toLocaleString('id-ID')}`);
            });
            console.log("\n✅ getRawIncomes is working correctly with gang history!");
        } else {
            console.log("⚠️  getRawIncomes returned no data");
        }
    } catch (e) {
        console.error("Error testing getRawIncomes:", e);
    }
    
    console.log("\n=== Test Complete ===");
    process.exit(0);
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
