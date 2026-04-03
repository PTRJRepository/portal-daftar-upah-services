/**
 * Deep diagnostic for jabatan tunjangan and THR/KONTAN mapping via NIK
 * Tests: jabatan PR_ADTRANS lookup, employee_other_incomes NIK matching
 */
import { Database } from '../../src/db/client';
import { currentPeriodService } from '../../src/services/currentPeriodService';
import { gangService } from '../../src/services/gangService';

const mainDb = Database.getInstance();
const extDb = Database.getExtendedInstance();

async function run() {
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    console.log(`\n=== DEEP DIAGNOSTIC: JABATAN & THR/KONTAN via NIK ===`);
    console.log(`Period: ${month}/${year}, startDate: ${startDate}, endDate: ${endDate}`);

    // ----------------------------------------------------
    // 1. JABATAN FROM PR_ADTRANS
    // ----------------------------------------------------
    console.log(`\n--- 1. JABATAN TUNJANGAN from PR_ADTRANS ---`);
    const jabatanRows = await mainDb.query<any>(`
        SELECT TOP 20 RTRIM(t.EmpCode) as emp_code, t.DocDesc, SUM(ln.Amount) as total
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%JABATAN%'
          AND ln.Amount > 0
        GROUP BY RTRIM(t.EmpCode), t.DocDesc
        ORDER BY total DESC
    `, [startDate, endDate]);

    if (jabatanRows.length === 0) {
        console.log('NO jabatan records in PR_ADTRANS for current period (live table)');
        
        // Check ARC table
        const jabatanArcRows = await mainDb.query<any>(`
            SELECT TOP 20 RTRIM(t.EmpCode) as emp_code, t.DocDesc, SUM(ln.Amount) as total
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%JABATAN%'
              AND ln.Amount > 0
            GROUP BY RTRIM(t.EmpCode), t.DocDesc
            ORDER BY total DESC
        `, [startDate, endDate]);
        
        if (jabatanArcRows.length === 0) {
            console.log('NO jabatan records in PR_ADTRANS_ARC either!');
        } else {
            console.log(`Found ${jabatanArcRows.length} jabatan records in ARC table:`);
            for (const r of jabatanArcRows.slice(0, 5)) {
                console.log(`  EmpCode=${r.emp_code}, DocDesc="${r.DocDesc}", total=${r.total}`);
            }
        }
    } else {
        console.log(`Found ${jabatanRows.length} jabatan records:`);
        for (const r of jabatanRows.slice(0, 5)) {
            console.log(`  EmpCode=${r.emp_code}, DocDesc="${r.DocDesc}", total=${r.total}`);
        }
    }

    // ----------------------------------------------------
    // 2. CHECK employee_estate for jabatan role assignments
    // ----------------------------------------------------
    console.log(`\n--- 2. EMPLOYEE_ESTATE jabatan assignments ---`);
    const estateRows = await extDb.query<any>(`
        SELECT TOP 20 empcode, jabatan, employee_name, gang, divisi_id
        FROM employee_estate
        WHERE jabatan IS NOT NULL AND jabatan <> ''
        ORDER BY updated_at DESC
    `);
    if (estateRows.length === 0) {
        console.log('NO records in employee_estate table!');
    } else {
        console.log(`${estateRows.length} records in employee_estate:`);
        for (const r of estateRows.slice(0, 10)) {
            console.log(`  EmpCode=${r.empcode}, Jabatan=${r.jabatan}, Name=${r.employee_name}, Gang=${r.gang}`);
        }
    }

    // ----------------------------------------------------
    // 3. NIK MATCHING for employee_other_incomes
    // ----------------------------------------------------
    console.log(`\n--- 3. employee_other_incomes NIK check for THR/KONTAN ---`);
    const oiRows = await extDb.query<any>(`
        SELECT TOP 20 id, nik, emp_code, emp_name, income_type, amount, period_year, period_month
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ?
        ORDER BY income_type, amount DESC
    `, [year, month]);

    if (oiRows.length === 0) {
        console.log(`NO other_incomes records for ${month}/${year}!`);
        
        // Check other periods
        const anyRows = await extDb.query<any>(`
            SELECT DISTINCT period_year, period_month, COUNT(*) as cnt
            FROM employee_other_incomes
            GROUP BY period_year, period_month
            ORDER BY period_year DESC, period_month DESC
        `);
        console.log(`Available periods in other_incomes:`);
        for (const r of anyRows) {
            console.log(`  ${r.period_month}/${r.period_year}: ${r.cnt} records`);
        }
    } else {
        console.log(`Found ${oiRows.length} other_incomes records for ${month}/${year}:`);
        const byType: Record<string, any[]> = {};
        for (const r of oiRows) {
            if (!byType[r.income_type]) byType[r.income_type] = [];
            byType[r.income_type].push(r);
        }
        for (const [type, recs] of Object.entries(byType)) {
            console.log(`\n  Type: ${type} (${recs.length} records)`);
            for (const r of recs.slice(0, 3)) {
                console.log(`    NIK=${r.nik}, EmpCode=${r.emp_code}, Name=${r.emp_name}, Amount=${r.amount}`);
            }
        }
    }

    // ----------------------------------------------------
    // 4. PG1A gang members - check if NIK in HR_EMPLOYEE matches NIK in other_incomes
    // ----------------------------------------------------
    console.log(`\n--- 4. PG1A gang members NIK vs employee_other_incomes NIK matching ---`);

    const gangs = await gangService.fetchGangs('PG1A');
    const gangCodes = gangs.map((g: any) => `'${g.gang_code}'`).join(',');

    if (!gangCodes) {
        console.log('No gangs found for PG1A!');
        process.exit(0);
    }

    const gangMembers = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangCode) as gang_code, RTRIM(gl.GangMember) as emp_code, 
               RTRIM(e.EmpName) as emp_name, RTRIM(e.NewICNo) as nik
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode IN (${gangCodes})
    `);

    console.log(`Found ${gangMembers.length} gang members in PG1A`);

    // Get all NIKs from other_incomes for this period
    const oiNiksRaw = await extDb.query<any>(`
        SELECT DISTINCT nik, income_type FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ?
    `, [year, month]);
    const oiNiksByType = new Map<string, Set<string>>();
    for (const r of oiNiksRaw) {
        const type = (r.income_type || '').toUpperCase();
        const nik = (r.nik || '').trim().toUpperCase();
        if (!oiNiksByType.has(type)) oiNiksByType.set(type, new Set());
        oiNiksByType.get(type)!.add(nik);
    }

    let matchedTHR = 0, unmatchedTHR = 0, matchedKONTAN = 0, unmatchedKONTAN = 0;
    const unmatchedTHRList: any[] = [];
    const unmatchedKONTANList: any[] = [];

    const thrNiks = oiNiksByType.get('THR') || new Set();
    const kontanNiks = oiNiksByType.get('KONTAN') || new Set();

    for (const m of gangMembers) {
        const nik = (m.nik || '').trim().toUpperCase();
        if (!nik) continue;

        if (thrNiks.has(nik)) matchedTHR++;
        else { unmatchedTHR++; unmatchedTHRList.push(m); }

        if (kontanNiks.size > 0) {
            if (kontanNiks.has(nik)) matchedKONTAN++;
            else { unmatchedKONTAN++; unmatchedKONTANList.push(m); }
        }
    }

    console.log(`\nTHR matching: ${matchedTHR} matched, ${unmatchedTHR} unmatched`);
    if (unmatchedTHRList.length > 0 && unmatchedTHRList.length <= 20) {
        console.log(`Unmatched THR (first 10):`);
        for (const m of unmatchedTHRList.slice(0, 10)) {
            console.log(`  Gang=${m.gang_code}, EmpCode=${m.emp_code}, NIK=${m.nik}, Name=${m.emp_name}`);
        }
    }

    if (kontanNiks.size > 0) {
        console.log(`\nKONTAN matching: ${matchedKONTAN} matched, ${unmatchedKONTAN} unmatched`);
    } else {
        console.log(`\nNo KONTAN records found for ${month}/${year}`);
    }

    // ----------------------------------------------------
    // 5. Sample of employee_other_incomes NIK format
    // ----------------------------------------------------
    console.log(`\n--- 5. Sample NIK format in employee_other_incomes ---`);
    const sampleNiks = await extDb.query<any>(`
        SELECT TOP 5 nik, emp_code, emp_name, income_type 
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ?
    `, [year, month]);
    for (const r of sampleNiks) {
        console.log(`  NIK="${r.nik}" (len=${r.nik?.length}), EmpCode="${r.emp_code}", type=${r.income_type}`);
    }

    console.log(`\n=== DONE ===`);
    process.exit(0);
}

run().catch(e => { console.error('Error:', e); process.exit(1); });
