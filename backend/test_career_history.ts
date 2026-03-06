/**
 * Test Employee Career History Service
 * 
 * Tests the employee career history tracking functionality
 */

import { employeeCareerHistoryService } from './src/services/employeeCareerHistoryService';

async function testCareerHistory() {
    console.log('=== Testing Employee Career History Service ===\n');

    // Test 1: Resolve EmpCode by NIK
    console.log('--- Test 1: Resolve EmpCode by NIK ---');
    const testNik = '198204152010012001'; // Example NIK
    const resolved = await employeeCareerHistoryService.resolveEmpCodesByIdentifier(testNik);
    console.log('Resolved:', resolved);

    // Test 2: Get Career History
    console.log('\n--- Test 2: Get Career History ---');
    if (resolved.emp_codes.length > 0) {
        const history = await employeeCareerHistoryService.getCareerHistory(resolved.emp_codes[0], {
            includeCurrent: true
        });
        console.log(`Found ${history.length} career history entries`);
        if (history.length > 0) {
            console.log('Latest entry:', history[0]);
            console.log('Oldest entry:', history[history.length - 1]);
        }
    }

    // Test 3: Get Gang Changes
    console.log('\n--- Test 3: Get Gang Changes (Perpindahan Gang) ---');
    if (resolved.emp_codes.length > 0) {
        const changes = await employeeCareerHistoryService.getGangChanges(resolved.emp_codes[0]);
        console.log(`Found ${changes.length} gang changes`);
        changes.forEach((change, idx) => {
            console.log(`  ${idx + 1}. ${change.from_gang_code} -> ${change.to_gang_code} (${change.change_month}/${change.change_year})`);
        });
    }

    // Test 4: Get Career Summary
    console.log('\n--- Test 4: Get Career Summary ---');
    if (resolved.emp_codes.length > 0) {
        const summary = await employeeCareerHistoryService.getCareerSummary(resolved.emp_codes[0]);
        if (summary) {
            console.log('Career Summary:');
            console.log(`  NIK: ${summary.nik}`);
            console.log(`  Name: ${summary.emp_name}`);
            console.log(`  Current Gang: ${summary.current_gang_code}`);
            console.log(`  Current Division: ${summary.current_division_code}`);
            console.log(`  Total Divisions: ${summary.total_divisions}`);
            console.log(`  Total Gangs: ${summary.total_gangs}`);
            console.log(`  Service Years: ${summary.total_service_years}`);
            console.log(`  Gang Changes: ${summary.gang_changes.length}`);
        } else {
            console.log('No career summary found');
        }
    }

    // Test 5: Search by Name
    console.log('\n--- Test 5: Search by Name ---');
    const searchName = 'JAMILA';
    const searchResults = await employeeCareerHistoryService.searchByName(searchName, 5);
    console.log(`Found ${searchResults.length} employees matching "${searchName}"`);
    searchResults.forEach((summary, idx) => {
        console.log(`  ${idx + 1}. ${summary.emp_name} (${summary.nik}) - ${summary.current_gang_code}`);
    });

    // Test 6: Get Gang Transfers by Period
    console.log('\n--- Test 6: Get Gang Transfers by Period ---');
    const testMonth = 1;
    const testYear = 2026;
    const transfers = await employeeCareerHistoryService.getGangTransfers(testMonth, testYear);
    console.log(`Found ${transfers.length} gang transfers in ${testMonth}/${testYear}`);
    transfers.slice(0, 5).forEach((transfer, idx) => {
        console.log(`  ${idx + 1}. ${transfer.emp_name}: ${transfer.from_gang_code} -> ${transfer.to_gang_code}`);
    });

    console.log('\n=== Tests Complete ===');
}

// Run tests
testCareerHistory()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test failed:', error);
        process.exit(1);
    });
