/**
 * Test Script for Duplicate NIK Mitigation Service
 * 
 * This script tests the duplicate NIK handling functionality
 * 
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_duplicate_nik_mitigation.ts
 */

import { duplicateNikMitigationService } from '../../../backend/src/services/DuplicateNikMitigationService';
import { employeeGangHistoryService } from '../../../backend/src/services/employeeGangHistoryService';

async function testDuplicateNikMitigation() {
    console.log('=== Testing Duplicate NIK Mitigation Service ===\n');

    // =========================================================================
    // TEST 1: Detect all duplicate NIKs
    // =========================================================================
    console.log('📋 TEST 1: Detecting all duplicate NIKs in the system...');
    console.log('-'.repeat(60));
    
    const report = await duplicateNikMitigationService.generateDuplicateReport();
    
    console.log(`Total Duplicate NIKs: ${report.total_duplicate_niks}`);
    console.log(`Total Affected Employees: ${report.total_affected_employees}`);
    console.log(`Resolved Count: ${report.resolved_count}`);
    console.log(`Unresolved Count: ${report.unresolved_count}`);
    
    if (report.duplicates.length > 0) {
        console.log('\n📝 Top 5 Duplicate NIKs:');
        report.duplicates.slice(0, 5).forEach((dup, idx) => {
            console.log(`\n  ${idx + 1}. NIK: ${dup.nik}`);
            console.log(`     Employee Count: ${dup.employee_count}`);
            console.log(`     Is Resolved: ${dup.is_resolved}`);
            console.log(`     Resolution Method: ${dup.resolution_method || 'N/A'}`);
            console.log(`     Employees:`);
            dup.employees.forEach(emp => {
                console.log(`       - ${emp.emp_code} | ${emp.emp_name} | Gang: ${emp.gang_code || 'N/A'} | Status: ${emp.status === '1' ? 'Active' : 'Inactive'}`);
            });
        });
    } else {
        console.log('\n✅ No duplicate NIKs found in the system!');
    }

    console.log('\n');

    // =========================================================================
    // TEST 2: Test with a specific NIK (if duplicates exist)
    // =========================================================================
    if (report.duplicates.length > 0) {
        const testNik = report.duplicates[0].nik;
        
        console.log(`📋 TEST 2: Testing resolution for NIK ${testNik}...`);
        console.log('-'.repeat(60));

        // Test 2a: Basic resolution
        console.log('\n2a. Basic Resolution (no context):');
        const basicResolution = await duplicateNikMitigationService.resolveEmpCode(testNik);
        console.log(`   Resolved EmpCode: ${basicResolution.resolved_emp_code}`);
        console.log(`   Resolution Method: ${basicResolution.resolution_method}`);
        console.log(`   Confidence: ${basicResolution.confidence}`);
        console.log(`   Notes: ${basicResolution.notes}`);
        console.log(`   All EmpCodes: ${basicResolution.all_emp_codes.join(', ')}`);

        // Test 2b: Resolution with preferred gang
        if (report.duplicates[0].employees[0]?.gang_code) {
            const preferredGang = report.duplicates[0].employees[0].gang_code;
            console.log(`\n2b. Resolution with Preferred Gang (${preferredGang}):`);
            const gangResolution = await duplicateNikMitigationService.resolveEmpCode(testNik, {
                preferredGang
            });
            console.log(`   Resolved EmpCode: ${gangResolution.resolved_emp_code}`);
            console.log(`   Resolution Method: ${gangResolution.resolution_method}`);
            console.log(`   Confidence: ${gangResolution.confidence}`);
        }

        // Test 2c: Get all EmpCodes
        console.log('\n2c. Get All EmpCodes for NIK:');
        const empCodeMap = await duplicateNikMitigationService.getAllEmpCodesForNik(testNik);
        console.log(`   Primary EmpCode: ${empCodeMap.primary_emp_code}`);
        console.log(`   All EmpCodes: ${empCodeMap.emp_codes.join(', ')}`);

        // Test 2d: Build history query filter
        console.log('\n2d. Build History Query Filter:');
        const filter = await duplicateNikMitigationService.buildHistoryQueryFilter(testNik);
        console.log(`   WHERE clause: ${filter.where}`);
        console.log(`   Params: ${filter.params.join(', ')}`);

        console.log('\n');
    }

    // =========================================================================
    // TEST 3: Test EmployeeGangHistoryService integration
    // =========================================================================
    console.log('📋 TEST 3: Testing EmployeeGangHistoryService integration...');
    console.log('-'.repeat(60));

    if (report.duplicates.length > 0) {
        const testNik = report.duplicates[0].nik;

        // Test 3a: Get latest EmpCode
        console.log('\n3a. Get Latest EmpCode (via EmployeeGangHistoryService):');
        const latestEmpCode = await employeeGangHistoryService.getLatestEmpCodeByNik(testNik);
        console.log(`   Latest EmpCode: ${latestEmpCode}`);

        // Test 3b: Get all EmpCodes
        console.log('\n3b. Get All EmpCodes (via EmployeeGangHistoryService):');
        const allEmpCodes = await employeeGangHistoryService.getAllEmpCodesByNik(testNik);
        console.log(`   All EmpCodes: ${allEmpCodes.join(', ')}`);

        // Test 3c: Check for duplicate
        console.log('\n3c. Check if NIK has duplicates:');
        const hasDuplicate = await employeeGangHistoryService.hasDuplicateNik(testNik);
        console.log(`   Has Duplicate: ${hasDuplicate}`);

        // Test 3d: Get gang history with resolution
        console.log('\n3d. Get Gang History with Resolution:');
        const historyWithResolution = await employeeGangHistoryService.getGangHistoryWithResolution(testNik);
        console.log(`   History Entries Found: ${historyWithResolution.length}`);
        if (historyWithResolution.length > 0) {
            const firstEntry = historyWithResolution[0];
            console.log(`   Latest Entry:`);
            console.log(`     - EmpCode: ${firstEntry.emp_code}`);
            console.log(`     - Gang: ${firstEntry.gang_code}`);
            console.log(`     - Period: ${firstEntry.period_month}/${firstEntry.period_year}`);
            console.log(`     - Is Duplicate NIK: ${firstEntry.is_duplicate_nik}`);
            if (firstEntry.resolution_info) {
                console.log(`     - Resolution Method: ${firstEntry.resolution_info.resolution_method}`);
                console.log(`     - Confidence: ${firstEntry.resolution_info.confidence}`);
            }
        }
    } else {
        console.log('   ⚠️  No duplicate NIKs to test with. Skipping integration tests.');
    }

    console.log('\n');

    // =========================================================================
    // TEST 4: Test name-based fallback (if needed)
    // =========================================================================
    console.log('📋 TEST 4: Testing name-based fallback...');
    console.log('-'.repeat(60));

    if (report.duplicates.length > 0) {
        const testEmployee = report.duplicates[0].employees[0];
        const testName = testEmployee.emp_name.split(' ')[0]; // Use first name

        console.log(`\nSearching for employees with name containing "${testName}"...`);
        const nameMatches = await duplicateNikMitigationService.findEmployeesByName(testName, {
            limit: 5
        });

        console.log(`   Found ${nameMatches.length} employees:`);
        nameMatches.forEach(emp => {
            console.log(`     - ${emp.emp_code} | ${emp.emp_name} | Gang: ${emp.gang_code || 'N/A'}`);
        });
    }

    console.log('\n');

    // =========================================================================
    // TEST 5: Test bulk resolution
    // =========================================================================
    console.log('📋 TEST 5: Testing bulk resolution...');
    console.log('-'.repeat(60));

    if (report.duplicates.length > 0) {
        const testNiks = report.duplicates.slice(0, 3).map(d => d.nik);
        
        console.log(`\nBulk resolving ${testNiks.length} NIKs...`);
        const bulkResults = await duplicateNikMitigationService.bulkResolveEmpCodes(testNiks);

        bulkResults.forEach((result, nik) => {
            console.log(`\n   NIK: ${nik}`);
            console.log(`     Resolved EmpCode: ${result.resolved_emp_code}`);
            console.log(`     Method: ${result.resolution_method}`);
            console.log(`     Confidence: ${result.confidence}`);
        });
    }

    console.log('\n');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   - Duplicate NIKs Found: ${report.total_duplicate_niks}`);
    console.log(`   - Affected Employees: ${report.total_affected_employees}`);
    console.log(`   - Resolution Success Rate: ${((report.resolved_count / (report.total_duplicate_niks || 1)) * 100).toFixed(2)}%`);
    console.log('\n💡 Recommendations:');
    
    if (report.unresolved_count > 0) {
        console.log(`   ⚠️  ${report.unresolved_count} NIK(s) still unresolved - manual review recommended`);
    } else {
        console.log('   ✅ All duplicate NIKs have been resolved automatically');
    }

    if (report.total_duplicate_niks > 0) {
        console.log('   📝 Consider cleaning up duplicate entries in HR_EMPLOYEE table');
    }

    console.log('\n');
}

// Run the test
testDuplicateNikMitigation()
    .then(() => {
        console.log('Test finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed with error:', error);
        process.exit(1);
    });
