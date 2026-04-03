/**
 * Test how CustomPayrollTable processes the API data
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_flatten_and_display.ts
 */

import { dataExtractorService } from "../../../backend/src/services/dataExtractorService";
import { Config } from "../../../backend/src/config";

function slimEmployee(emp: any): any {
    const { shortage_details, excess_details, other_incomes, lembur_records, ...rest } = emp;
    return rest;
}

// Simulate PayrollAggregator.flattenData
function flattenData(data: any) {
    const flatRows = [];
    for (const gang of (data.gangs || [])) {
        if (gang.employees && Array.isArray(gang.employees)) {
            for (const emp of gang.employees) {
                flatRows.push({ ...emp, gang_code: gang.gang_code });
            }
        }
    }
    // Business rule filter: exclude hari_kerja <= 0
    const filtered = flatRows.filter((row: any) => (row.hari_kerja || row.kehadiran || 0) > 0);
    return filtered;
}

async function test() {
    const month = 3;
    const year = 2026;
    const division = 'AB1';
    const gangCode = 'G1H'; // specific gang

    console.log(`\n=== Simulating CustomPayrollTable for G1H (${month}/${year}) ===`);

    const result = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, Config.DB_PROFILE, false, null, undefined, true
    );

    // Group by gang
    const gangsMap: Record<string, any[]> = {};
    for (const row of result.data_rows) {
        const gang = row.gang_code;
        if (!gangsMap[gang]) gangsMap[gang] = [];
        gangsMap[gang].push(row);
    }

    const gangsList = Object.entries(gangsMap)
        .map(([gang_code, employees]) => ({
            gang_code,
            employees: employees.map(slimEmployee),
        }));

    // Simulate API response
    const apiData = { gangs: gangsList };

    console.log(`\nAPI data: ${apiData.gangs.length} gangs`);
    for (const g of apiData.gangs) {
        console.log(`  Gang ${g.gang_code}: ${g.employees.length} employees`);
        const withJab = g.employees.filter((e: any) => (e.jabatan_jumlah || 0) > 0);
        console.log(`    With jabatan_jumlah > 0: ${withJab.length}`);
        for (const emp of withJab.slice(0, 3)) {
            console.log(`      ${emp.emp_code} (${emp.nama}): jabatan_jumlah = ${emp.jabatan_jumlah}, hari_kerja = ${emp.hari_kerja}`);
        }
    }

    // Now simulate flattenData (what CustomPayrollTable does)
    console.log(`\n--- Simulating PayrollAggregator.flattenData ---`);
    const flatRows = flattenData(apiData);

    console.log(`\nFlat rows after filter (hari_kerja > 0): ${flatRows.length}`);

    // Check for jabatan_jumlah
    const withJabAll = flatRows.filter((r: any) => (r.jabatan_jumlah || 0) > 0);
    console.log(`Rows with jabatan_jumlah > 0: ${withJabAll.length}`);

    if (withJabAll.length > 0) {
        console.log(`\nFirst 5 rows with jabatan_jumlah > 0:`);
        for (const r of withJabAll.slice(0, 5)) {
            console.log(`  ${r.emp_code} (${r.nama}): jabatan_jumlah = ${r.jabatan_jumlah}, hari_kerja = ${r.hari_kerja}`);
        }
    }

    // Check the columns CustomPayrollTable would show
    if (flatRows.length > 0) {
        const emp = flatRows[0];
        const cols = Object.keys(emp);
        const tunjCols = cols.filter(c => c.includes('jabatan') || c.includes('tunjangan'));
        console.log(`\nTunjangan-related columns in row:`);
        for (const c of tunjCols) {
            console.log(`  ${c} = ${(emp as any)[c]}`);
        }
    }

    console.log(`\n=== END ===`);
}

test().catch(console.error).finally(() => process.exit());
