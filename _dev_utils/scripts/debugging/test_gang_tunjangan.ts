/**
 * Test API response structure for gangs with jabatan_jumlah
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_gang_tunjangan.ts
 */

import { dataExtractorService } from "../../../backend/src/services/dataExtractorService";
import { Config } from "../../../backend/src/config";

async function test() {
    const month = 3;
    const year = 2026;
    const division = 'AB1';

    console.log(`Testing API endpoint flow for ${division} (${month}/${year})`);

    const result = await dataExtractorService.extractPayrollData(
        month, year, "ALL", division, null, Config.DB_PROFILE, false, null, undefined, true
    );

    // Simulate what the API route does
    const gangsMap: Record<string, any[]> = {};
    for (const row of result.data_rows) {
        const gang = row.gang_code;
        if (!gangsMap[gang]) gangsMap[gang] = [];
        gangsMap[gang].push(row);
    }

    console.log(`Total gangs: ${Object.keys(gangsMap).length}`);

    // Show employees with jabatan_jumlah per gang
    for (const [gang, employees] of Object.entries(gangsMap)) {
        const withJab = employees.filter((e: any) => (e.jabatan_jumlah || 0) > 0);
        if (withJab.length > 0) {
            console.log(`\nGang ${gang}: ${employees.length} employees, ${withJab.length} with jabatan_jumlah > 0`);
            for (const emp of withJab.slice(0, 3)) {
                console.log(`  ${emp.emp_code} (${emp.nama}): jabatan_jumlah = ${emp.jabatan_jumlah}`);
            }
        }
    }

    // Check what the API returns (after gang grouping)
    const gangsList = Object.entries(gangsMap)
        .map(([gang_code, employees]) => ({
            gang_code,
            employees,
            gang_totals: {
                jabatan_jumlah: employees.reduce((s: number, e: any) => s + (e.jabatan_jumlah || 0), 0)
            }
        }));

    // Check a sample gang from gangsList
    if (gangsList.length > 0) {
        const g = gangsList[0];
        console.log(`\nSample gang ${g.gang_code} from gangsList:`);
        console.log(`  Total employees: ${g.employees.length}`);
        console.log(`  gang_totals.jabatan_jumlah: ${g.gang_totals.jabatan_jumlah}`);
        if (g.employees.length > 0) {
            console.log(`  First employee fields:`);
            const emp = g.employees[0];
            const tunjanganFields = Object.keys(emp).filter(k => k.includes('jabatan') || k.includes('tunjangan'));
            for (const f of tunjanganFields) {
                console.log(`    ${f} = ${(emp as any)[f]}`);
            }
        }
    }

    console.log(`\n=== END ===`);
}

test().catch(console.error).finally(() => process.exit());
