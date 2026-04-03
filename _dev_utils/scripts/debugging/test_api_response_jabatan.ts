/**
 * Simulate the division-raw-tree API response to check if jabatan_jumlah is present
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_api_response_jabatan.ts
 */

import { dataExtractorService } from "../../../backend/src/services/dataExtractorService";
import { Config } from "../../../backend/src/config";

function slimEmployee(emp: any): any {
    const { shortage_details, excess_details, other_incomes, lembur_records, ...rest } = emp;
    return rest;
}

async function test() {
    const month = 3;
    const year = 2026;
    const division = 'AB1';

    console.log(`\n=== Simulating /division-raw-tree API response ===`);

    const result = await dataExtractorService.extractPayrollData(
        month, year, "ALL", division, null, Config.DB_PROFILE, false, null, undefined, true
    );

    console.log(`data_rows: ${result.data_rows.length}`);

    // Group by gang (like the API does)
    const gangsMap: Record<string, any[]> = {};
    for (const row of result.data_rows) {
        const gang = row.gang_code;
        if (!gangsMap[gang]) gangsMap[gang] = [];
        gangsMap[gang].push(row);
    }

    // Build gangsList (like the API does)
    const gangsList = Object.entries(gangsMap)
        .map(([gang_code, employees]) => ({
            gang_code,
            employees: employees.map(slimEmployee),  // Strip heavy arrays
            employee_count: employees.length,
            // gang_totals added below
        }))
        .sort((a, b) => a.gang_code.localeCompare(b.gang_code));

    // Add gang_totals
    for (const g of gangsList) {
        const empList = gangsMap[g.gang_code];
        g.gang_totals = {
            employee_count: empList.length,
            jabatan_jumlah: empList.reduce((s, e) => s + (e.jabatan_jumlah || 0), 0),
            beras_jumlah: empList.reduce((s, e) => s + (e.beras_jumlah || 0), 0),
        };
    }

    // Check if jabatan_jumlah is in the slimmed employees
    console.log(`\nChecking FIRST gang (${gangsList[0]?.gang_code})...`);
    const firstGang = gangsList[0];
    const firstEmp = firstGang.employees[0];
    console.log(`  Employees in gang: ${firstGang.employees.length}`);
    console.log(`  gang_totals.jabatan_jumlah: ${firstGang.gang_totals.jabatan_jumlah}`);
    console.log(`  First employee keys (containing 'jab' or 'tunj'):`);
    const relevantKeys = Object.keys(firstEmp).filter(k => k.toLowerCase().includes('jab') || k.toLowerCase().includes('tunj'));
    for (const k of relevantKeys) {
        console.log(`    ${k} = ${(firstEmp as any)[k]}`);
    }

    // Check all gangs for those with jabatan_jumlah
    console.log(`\nAll gangs with jabatan_jumlah > 0 in gang_totals:`);
    for (const g of gangsList) {
        if (g.gang_totals.jabatan_jumlah > 0) {
            console.log(`  ${g.gang_code}: ${g.gang_totals.jabatan_jumlah} (${g.employees.length} employees)`);
        }
    }

    // How many employees in the API response have jabatan_jumlah > 0?
    let totalWithJabatan = 0;
    for (const g of gangsList) {
        for (const emp of g.employees) {
            if ((emp.jabatan_jumlah || 0) > 0) totalWithJabatan++;
        }
    }
    console.log(`\nTotal employees with jabatan_jumlah > 0 in API response: ${totalWithJabatan}`);

    console.log(`\n=== END ===`);
}

test().catch(console.error).finally(() => process.exit());
