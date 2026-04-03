/**
 * Diagnostic Test: Jabatan + THR + Kontanan Chain
 *
 * Tests the full flow: gang → empcode → NIK → THR/jabatan/kontanan
 *
 * This verifies the NIK-based lookup approach for:
 * 1. THR (Tunjangan Hari Raya) from employee_other_incomes
 * 2. Jabatan (job title) from employee_estate
 * 3. Kontanan (daily allowance) from employee_other_incomes
 *
 * Run: cd backend && bun run src/scripts/test_jabatan_thr_kontan_chain.ts
 */

import { Database } from "../db/client";
import { OtherIncomesService } from "../services/otherIncomesService";
import { employeeGangHistoryService } from "../services/employeeGangHistoryService";
import { employeeEstateService } from "../services/employeeEstateService";
import { gangService } from "../services/gangService";

const TEST_GANG = process.argv[2] || 'H1H';
const TEST_MONTH = parseInt(process.argv[3] || '3');
const TEST_YEAR = parseInt(process.argv[4] || '2026');

async function runTest() {
    console.log('='.repeat(70));
    console.log('DIAGNOSTIC: Jabatan + THR + Kontanan Chain');
    console.log('='.repeat(70));
    console.log(`Params: gang=${TEST_GANG}, month=${TEST_MONTH}, year=${TEST_YEAR}`);
    console.log('');

    const dbMain = Database.getInstance();        // db_ptrj — HR_EMPLOYEE, HR_GANGLN
    const dbExt = Database.getExtendedInstance(); // extend_db_ptrj — employee_other_incomes, employee_estate

    // ==============================================================
    // STEP 1: Get gang → employees (emp_code + NIK)
    // ==============================================================
    console.log('[STEP 1] Gang → Employees (emp_code + NIK)');
    console.log('-'.repeat(70));

    const gangEmployees = await dbMain.query(`
        SELECT TOP 10
            RTRIM(e.EmpCode) as emp_code,
            RTRIM(e.NewICNo) as nik,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(gl.GangCode) as gang_code,
            e.Status
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
        INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE gl.GangCode = ?
        ORDER BY e.EmpName
    `, [TEST_GANG]);

    if (gangEmployees.length === 0) {
        console.log(`  ❌ No employees found for gang ${TEST_GANG}`);
        return;
    }

    console.log(`  ✅ Found ${gangEmployees.length} employees in gang ${TEST_GANG}`);
    console.log('  Sample employees:');
    gangEmployees.slice(0, 5).forEach((emp: any, i: number) => {
        console.log(`    ${i+1}. EmpCode: ${emp.emp_code}, NIK: ${emp.nik || '(empty)'}, Name: ${emp.emp_name}`);
    });

    const empCodes = gangEmployees.map((e: any) => e.emp_code);
    const niks = gangEmployees.map((e: any) => e.nik).filter(Boolean);

    // ==============================================================
    // STEP 2: Check employee_other_incomes for THR + KONTAN
    // ==============================================================
    console.log('\n[STEP 2] Check employee_other_incomes (THR + KONTAN)');
    console.log('-'.repeat(70));

    const otherIncomes = await OtherIncomesService.getIncomes(TEST_YEAR, TEST_MONTH, undefined, TEST_GANG);
    console.log(`  ✅ OtherIncomesService.getIncomes() returned ${otherIncomes.length} total records for ${TEST_MONTH}/${TEST_YEAR}`);

    const thrRecords = otherIncomes.filter(i => i.income_type === 'THR');
    const kontanRecords = otherIncomes.filter(i => i.income_type === 'KONTAN');
    const customRecords = otherIncomes.filter(i =>
        i.income_type && !['THR', 'BONUS', 'CUSTOM', 'KONTAN'].includes(i.income_type)
    );

    console.log(`  THR records: ${thrRecords.length}`);
    console.log(`  KONTAN records: ${kontanRecords.length}`);
    console.log(`  Other custom types: ${customRecords.length}`);
    customRecords.forEach(r => console.log(`    - Type: ${r.income_type}, Amount: ${r.amount}`));

    // Check what NIKs/emp_codes are in the other incomes
    const oiNikSet = new Set(otherIncomes.map(i => (i.nik || '').trim().toUpperCase()).filter(Boolean));
    const oiEmpCodeSet = new Set(otherIncomes.map(i => (i.emp_code || '').trim().toUpperCase()).filter(Boolean));

    console.log(`\n  Other incomes unique NIKs: ${oiNikSet.size}`);
    console.log(`  Other incomes unique emp_codes: ${oiEmpCodeSet.size}`);

    // Match against our gang employees
    let thrMatched = 0;
    let kontanMatched = 0;
    const unmatched: string[] = [];

    for (const emp of gangEmployees) {
        const nikKey = (emp.nik || '').trim().toUpperCase();
        const empCodeKey = (emp.emp_code || '').trim().toUpperCase();

        const hasThr = thrRecords.some(r =>
            ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
            ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
        );
        const hasKontan = kontanRecords.some(r =>
            ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
            ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
        );

        if (hasThr) thrMatched++;
        if (hasKontan) kontanMatched++;

        if (!hasThr && !hasKontan) {
            unmatched.push(`${emp.emp_name} (NIK: ${nikKey || 'N/A'}, EC: ${empCodeKey})`);
        }
    }

    console.log(`\n  THR matched to gang employees: ${thrMatched}/${gangEmployees.length}`);
    console.log(`  KONTAN matched to gang employees: ${kontanMatched}/${gangEmployees.length}`);
    if (unmatched.length > 0) {
        console.log(`  ❌ Unmatched employees (no THR/KONTAN):`);
        unmatched.slice(0, 5).forEach(u => console.log(`     - ${u}`));
        if (unmatched.length > 5) console.log(`     ... and ${unmatched.length - 5} more`);
    }

    // Show THR amounts for matched employees
    if (thrMatched > 0) {
        console.log(`\n  THR amounts for matched employees:`);
        for (const emp of gangEmployees) {
            const nikKey = (emp.nik || '').trim().toUpperCase();
            const empCodeKey = (emp.emp_code || '').trim().toUpperCase();
            const thr = thrRecords.find(r =>
                ((r.nik || '').trim().toUpperCase() === nikKey && nikKey) ||
                ((r.emp_code || '').trim().toUpperCase() === empCodeKey && empCodeKey)
            );
            if (thr) {
                console.log(`    - ${emp.emp_name}: Rp ${Number(thr.amount).toLocaleString('id-ID')} (NIK lookup: ${nikKey || empCodeKey})`);
            }
        }
    }

    // ==============================================================
    // STEP 3: Check employee_estate for JABATAN
    // ==============================================================
    console.log('\n[STEP 3] Check employee_estate (Jabatan)');
    console.log('-'.repeat(70));

    const estateRows = await dbExt.query(`
        SELECT empcode, employee_name, gang, jabatan
        FROM employee_estate
        WHERE empcode IN (${empCodes.map(() => '?').join(',')})
    `, empCodes);

    console.log(`  employee_estate records for gang ${TEST_GANG}: ${estateRows.length}/${gangEmployees.length}`);

    if (estateRows.length === 0) {
        console.log(`  ❌ NO records found in employee_estate for gang ${TEST_GANG}!`);
        console.log(`     This is why jabatan is showing as empty/default "karyawan panen"`);

        // Check if the table even has any data at all
        const totalEstateCount = await dbExt.query(`SELECT COUNT(*) as cnt FROM employee_estate`);
        console.log(`\n  Total records in employee_estate table: ${totalEstateCount[0]?.cnt || 0}`);
    } else {
        console.log(`  ✅ employee_estate has ${estateRows.length} records for this gang`);
        estateRows.slice(0, 5).forEach((row: any) => {
            console.log(`    - ${row.empcode}: "${row.jabatan}" (gang: ${row.gang})`);
        });
    }

    // ==============================================================
    // STEP 4: Test empcode → NIK resolution
    // ==============================================================
    console.log('\n[STEP 4] Test empcode → NIK resolution');
    console.log('-'.repeat(70));

    const resolvedMap = await employeeGangHistoryService.resolveLatestEmpCodes(niks, new Map(niks.map(n => [n, TEST_GANG])));
    console.log(`  Resolved ${resolvedMap.size} NIK → emp_code mappings`);

    let mismatchCount = 0;
    gangEmployees.slice(0, 5).forEach((emp: any) => {
        const nikKey = (emp.nik || '').trim().toUpperCase();
        const resolved = resolvedMap.get(nikKey);
        const match = resolved === emp.emp_code?.trim().toUpperCase();
        if (!match) mismatchCount++;
        console.log(`    NIK ${nikKey} → Resolved: ${resolved}, Original: ${emp.emp_code?.trim().toUpperCase()} ${match ? '✅' : '❌'}`);
    });

    if (mismatchCount > 0) {
        console.log(`  ⚠️  ${mismatchCount} NIK → emp_code mismatches detected`);
    }

    // ==============================================================
    // STEP 5: Simulate actual lookup (as dataExtractorService does)
    // ==============================================================
    console.log('\n[STEP 5] Simulate dataExtractorService lookup');
    console.log('-'.repeat(70));

    // Build maps exactly as dataExtractorService does
    const dbOtherIncomesByNik = new Map<string, any[]>();
    const dbOtherIncomesByNikName = new Map<string, any[]>();

    for (const inc of otherIncomes) {
        const nik = (inc.nik || '').trim().toUpperCase();
        const empCode = (inc.emp_code || '').trim().toUpperCase();
        const entry = { type: inc.income_type, name: inc.income_name || inc.income_type, amount: Number(inc.amount) };

        if (nik) {
            if (!dbOtherIncomesByNik.has(nik)) dbOtherIncomesByNik.set(nik, []);
            dbOtherIncomesByNik.get(nik)!.push(entry);
        }
        if (empCode) {
            if (!dbOtherIncomesByNik.has(empCode)) dbOtherIncomesByNik.set(empCode, []);
            dbOtherIncomesByNik.get(empCode)!.push(entry);
        }
    }

    // Simulate lookup for each employee
    let thrFound = 0;
    let kontanFound = 0;
    for (const emp of gangEmployees) {
        const nikKey = (emp.nik || '').trim().toUpperCase();
        const empCodeKey = (emp.emp_code || '').trim().toUpperCase();

        const entries = (dbOtherIncomesByNik.get(nikKey) || dbOtherIncomesByNik.get(empCodeKey) || []);
        const thrEntry = entries.find(e => e.type === 'THR');
        const kontanEntry = entries.find(e => e.type === 'KONTAN');

        if (thrEntry) thrFound++;
        if (kontanEntry) kontanFound++;
    }

    console.log(`  Simulated lookup results:`);
    console.log(`    THR found: ${thrFound}/${gangEmployees.length} employees`);
    console.log(`    KONTAN found: ${kontanFound}/${gangEmployees.length}`);

    // ==============================================================
    // SUMMARY
    // ==============================================================
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const issues: string[] = [];
    if (thrMatched === 0) issues.push('THR: No THR records found in employee_other_incomes for this period. Data may not be seeded yet.');
    if (kontanMatched === 0) issues.push('KONTAN: No KONTAN records found in employee_other_incomes. May need to be seeded via manual adjustment.');
    if (estateRows.length === 0) issues.push('JABATAN: employee_estate table has NO records for this gang. Seed the table with jabatan data.');
    if (resolvedMap.size === 0) issues.push('NIK RESOLUTION: No NIKs could be resolved from HR_EMPLOYEE. Check if employees have NewICNo filled.');

    if (issues.length === 0) {
        console.log('  ✅ All data sources are working correctly!');
        console.log(`  ✅ THR: ${thrMatched} matches`);
        console.log(`  ✅ KONTAN: ${kontanMatched} matches`);
        console.log(`  ✅ JABATAN: ${estateRows.length} records`);
    } else {
        console.log('  ❌ Issues detected:');
        issues.forEach(issue => console.log(`     - ${issue}`));
    }

    console.log('\n');
}

runTest().catch(console.error);
