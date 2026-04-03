/**
 * Test dataExtractorService.extractPayrollData directly to check jabatan_jumlah
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_extract_payroll_jabatan.ts
 */

import { dataExtractorService } from "../../../backend/src/services/dataExtractorService";
import { Config } from "../../../backend/src/config";

async function test() {
    const month = 3;
    const year = 2026;
    const division = 'AB1';

    console.log(`Testing dataExtractorService.extractPayrollData for ${division} (${month}/${year})`);
    console.log(`DB_PROFILE: ${Config.DB_PROFILE}`);
    console.log(`RUN_MODE: ${Config.RUN_MODE}`);

    const result = await dataExtractorService.extractPayrollData(
        month,
        year,
        "ALL",      // gangCode
        division,   // divisionCode
        null,        // specificEmpCode
        Config.DB_PROFILE,
        false,       // includeVirtual
        null,        // useHistoryDb
        undefined,   // gangPrefix
        true         // skipHarvest
    );

    console.log(`\nResult: ${result.data_rows.length} employees`);
    console.log(`Meta:`, result.meta);

    // Check for jabatan_jumlah
    const withJabatan = result.data_rows.filter(r => (r.jabatan_jumlah || 0) > 0);
    const withoutJabatan = result.data_rows.filter(r => (r.jabatan_jumlah || 0) === 0);

    console.log(`\nEmployees with jabatan_jumlah > 0: ${withJabatan.length}`);
    console.log(`Employees with jabatan_jumlah = 0: ${withoutJabatan.length}`);

    if (withJabatan.length > 0) {
        console.log(`\nFirst 10 with jabatan_jumlah > 0:`);
        for (const r of withJabatan.slice(0, 10)) {
            console.log(`  ${r.emp_code} (${r.nama}): jabatan_jumlah = ${r.jabatan_jumlah}, jabatan_rate = ${r.jabatan_rate}`);
        }
    }

    // Check all fields for first employee
    if (result.data_rows.length > 0) {
        const emp = result.data_rows[0];
        const fields = Object.keys(emp).filter(k => k.includes('jabatan') || k.includes('tunjangan'));
        console.log(`\nFields with 'jabatan' or 'tunjangan' for first employee:`);
        for (const f of fields) {
            console.log(`  ${f} = ${emp[f]}`);
        }
    }

    console.log(`\n=== END ===`);
}

test().catch(console.error).finally(() => process.exit());
