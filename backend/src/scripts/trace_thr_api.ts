/**
 * Trace the exact THR data flow from API call through to response
 * Simulates: OtherIncomesService.getIncomes -> dataExtractorService lookup
 */
import { Database } from "../db/client";
import { OtherIncomesService } from "../services/otherIncomesService";

function cleanNameFormat(name: string): string {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
    const dbExt = Database.getExtendedInstance();
    const db = Database.getInstance();
    const month = 3, year = 2026;
    const gangCode = 'B2N';

    console.log('=== TRACE: OtherIncomesService.getIncomes ===\n');

    // Step 1: Call getIncomes (same as dataExtractorService does)
    const incomes = await OtherIncomesService.getIncomes(year, month, undefined, gangCode);
    console.log(`getIncomes returned ${incomes.length} records`);

    const thrRecords = incomes.filter(i => i.income_type === 'THR');
    console.log(`THR records: ${thrRecords.length}`);

    if (thrRecords.length === 0) {
        console.log('ERROR: No THR records returned from getIncomes!');
        console.log('First 3 incomes:', JSON.stringify(incomes.slice(0, 3), null, 2));
        process.exit(1);
    }

    // Step 2: Show first few THR records
    console.log('\nFirst 3 THR records:');
    for (const t of thrRecords.slice(0, 3)) {
        console.log(`  nik=${t.nik}, emp_code=${t.emp_code || '(empty)'}, emp_name=${t.emp_name}, amount=${t.amount}`);
    }

    // Step 3: Build lookup maps (exactly as dataExtractorService does)
    const dbThpIncomesMap = new Map<string, number>();
    const dbOtherIncomesByNik = new Map<string, any[]>();
    const nikCount = new Map<string, number>();

    for (const inc of incomes) {
        const nik = String(inc.nik || '').trim().toUpperCase();
        if (nik) nikCount.set(nik, (nikCount.get(nik) || 0) + 1);
    }

    for (const inc of incomes) {
        const nik = String(inc.nik || '').trim().toUpperCase();
        const empCode = String(inc.emp_code || '').trim().toUpperCase();
        const dbEmpName = String(inc.emp_name || '').trim().toUpperCase();
        const dbCleanName = cleanNameFormat(dbEmpName);
        const nikNameKey = nik ? `${nik}||${dbCleanName}` : '';

        if (inc.is_paid_in_thp) {
            if (empCode) dbThpIncomesMap.set(empCode, (dbThpIncomesMap.get(empCode) || 0) + Number(inc.amount));
            if (nik) dbThpIncomesMap.set(nik, (dbThpIncomesMap.get(nik) || 0) + Number(inc.amount));
            if (nik && nikCount.get(nik)! > 1 && nikNameKey) {
                dbThpIncomesMap.set(nikNameKey, (dbThpIncomesMap.get(nikNameKey) || 0) + Number(inc.amount));
            }
        }
        if (empCode) {
            if (!dbOtherIncomesByNik.has(empCode)) dbOtherIncomesByNik.set(empCode, []);
            dbOtherIncomesByNik.get(empCode)!.push({ type: inc.income_type, name: inc.income_type, amount: Number(inc.amount) });
        }
        if (nik) {
            if (!dbOtherIncomesByNik.has(nik)) dbOtherIncomesByNik.set(nik, []);
            dbOtherIncomesByNik.get(nik)!.push({ type: inc.income_type, name: inc.income_type, amount: Number(inc.amount) });
            if (nikCount.get(nik)! > 1 && nikNameKey) {
                if (!dbOtherIncomesByNik.has(nikNameKey)) dbOtherIncomesByNik.set(nikNameKey, []);
                dbOtherIncomesByNik.get(nikNameKey)!.push({ type: inc.income_type, name: inc.income_type, amount: Number(inc.amount) });
            }
        }
    }

    console.log(`\nMaps built: thp=${dbThpIncomesMap.size}, byNik=${dbOtherIncomesByNik.size}`);

    // Step 4: Get gang members and test lookup
    const gangMembers = await db.query<any>(`
        SELECT
            RTRIM(e.EmpCode) as emp_code,
            RTRIM(e.NewICNo) as actual_nik,
            RTRIM(e.EmpName) as emp_name,
            e.Gender as gender
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE RTRIM(gl.GangCode) = ?
        ORDER BY e.EmpCode
    `, [gangCode]);

    console.log(`\nGang ${gangCode} members: ${gangMembers.length}`);

    // Step 5: Test lookup for first 3 members
    console.log('\n--- Lookup Test ---');
    for (const emp of gangMembers.slice(0, 3)) {
        const empNik = String(emp.actual_nik || '').trim().toUpperCase();
        const empCodeKey = String(emp.emp_code || '').trim().toUpperCase();
        const empName = String(emp.emp_name || '').trim().toUpperCase();
        const empNameForKey = cleanNameFormat(empName);
        const nikNameKey = empNik && empNameForKey ? `${empNik}||${empNameForKey}` : '';

        // Lookup
        let thrAmount = 0;
        let foundVia = '';

        if (empNik && dbThpIncomesMap.has(empNik)) {
            thrAmount = dbThpIncomesMap.get(empNik)!;
            foundVia = 'NIK';
        } else if (nikNameKey && dbThpIncomesMap.has(nikNameKey)) {
            thrAmount = dbThpIncomesMap.get(nikNameKey)!;
            foundVia = 'NIK+NAME';
        } else if (empCodeKey && dbThpIncomesMap.has(empCodeKey)) {
            thrAmount = dbThpIncomesMap.get(empCodeKey)!;
            foundVia = 'EC';
        }

        // Also get via lookupOtherIncomes
        const empOtherIncomes = empNik ? (dbOtherIncomesByNik.get(empNik) || []) : [];
        const getOiByType = (type: string) => empOtherIncomes
            .filter((oi: any) => (oi.type || '').toUpperCase() === type.toUpperCase())
            .reduce((sum: number, oi: any) => sum + Number(oi.amount || 0), 0);
        const pendapatan_thr = getOiByType('THR');

        console.log(`  ${emp.emp_code} NIK=${empNik} name=${empName.substring(0,20)}`);
        console.log(`    dbThpIncomesMap lookup: Rp${thrAmount.toLocaleString()} [${foundVia || 'NOT FOUND'}]`);
        console.log(`    dbOtherIncomesByNik lookup: Rp${pendapatan_thr.toLocaleString()}`);
        console.log(`    empOtherIncomes entries: ${empOtherIncomes.length}`);
    }

    // Step 6: Check map keys
    console.log(`\n--- Map Key Check ---`);
    console.log(`Map has NIK 1906042509710001? ${dbThpIncomesMap.has('1906042509710001')}`);
    console.log(`Map has EC B0065? ${dbThpIncomesMap.has('B0065')}`);
    console.log(`byNik has NIK 1906042509710001? ${dbOtherIncomesByNik.has('1906042509710001')}`);
    const sampleNikKeys = [...dbOtherIncomesByNik.keys()].filter(k => k.length > 5).slice(0, 3);
    console.log(`Sample byNik keys: ${sampleNikKeys}`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
