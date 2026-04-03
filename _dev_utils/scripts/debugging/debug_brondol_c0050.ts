/**
 * Debug Script: Check brondol data for C0050
 * Run: cd backend && bun run src/scripts/debug_brondol_c0050.ts
 */
import { Database } from "../../db/client";

const TEST_PERIOD = { month: 3, year: 2026 };
const EMP_CODE = 'C0050';
const GANG_CODE = 'C1H';

function getStartEndDates(month: number, year: number): { startDate: string; endDate: string } {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    return { startDate, endDate };
}

async function main() {
    const db = Database.getInstance();
    const dbExt = Database.getExtendedInstance();
    const { startDate, endDate } = getStartEndDates(TEST_PERIOD.month, TEST_PERIOD.year);

    console.log('=== BRONDOL DEBUG FOR C0050 ===');
    console.log(`Period: ${TEST_PERIOD.month}/${TEST_PERIOD.year}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log(`Gang: ${GANG_CODE}`);
    console.log('');

    // 1. Check employee in HR_GANGLN
    console.log('--- 1. HR_GANGLN check ---');
    const gangMember = await db.query(`
        SELECT GangCode, GangMember, MemberName
        FROM HR_GANGLN
        WHERE RTRIM(GangMember) = ?
    `, [EMP_CODE]);
    console.log(`HR_GANGLN for ${EMP_CODE}:`, gangMember);
    console.log('');

    // 2. Check PR_LOOSEFRUIT
    console.log('--- 2. PR_LOOSEFRUIT (loose fruit) ---');
    const looseFruit = await db.query(`
        SELECT LF.DocDate, LF.DocNo, LFLN.EmpCode, LFLN.Amount, LFLN.Bunches, LFLN.LooseFruit
        FROM PR_LOOSEFRUIT LF
        JOIN PR_LOOSEFRUITLN LFLN ON LF.ID = LFLN.MasterID
        WHERE RTRIM(LFLN.EmpCode) = ?
          AND LF.DocDate >= ? AND LF.DocDate < ?
        UNION ALL
        SELECT LF.DocDate, LF.DocNo, LFLN.EmpCode, LFLN.Amount, LFLN.Bunches, LFLN.LooseFruit
        FROM PR_LOOSEFRUIT_ARC LF
        JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
        WHERE RTRIM(LFLN.EmpCode) = ?
          AND LF.DocDate >= ? AND LF.DocDate < ?
        ORDER BY DocDate
    `, [EMP_CODE, startDate, endDate, EMP_CODE, startDate, endDate]);
    console.log(`PR_LOOSEFRUIT records: ${looseFruit.length}`);
    let looseFruitTotal = 0;
    for (const r of looseFruit as any[]) {
        console.log(`  ${r.DocDate} | ${r.DocNo} | EmpCode=${r.EmpCode?.trim()} | Amount=${r.Amount} | LooseFruit=${r.LooseFruit}`);
        looseFruitTotal += (r.Amount || 0);
    }
    console.log(`  TOTAL loose fruit: ${looseFruitTotal}`);
    console.log('');

    // 3. Check PR_ADTRANS for brondol
    console.log('--- 3. PR_ADTRANS (DocDesc containing BRONDOL) ---');
    const adtransBrondol = await db.query(`
        SELECT t.DocDate, t.DocNo, t.DocDesc, ln.Amount, ln.TaskCode, mt.TaskDesc
        FROM PR_ADTRANS t
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
        WHERE RTRIM(t.EmpCode) = ?
          AND t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%BRONDOL%'
        UNION ALL
        SELECT t.DocDate, t.DocNo, t.DocDesc, ln.Amount, ln.TaskCode, mt.TaskDesc
        FROM PR_ADTRANS_ARC t
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
        WHERE RTRIM(t.EmpCode) = ?
          AND t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%BRONDOL%'
        ORDER BY DocDate
    `, [EMP_CODE, startDate, endDate, EMP_CODE, startDate, endDate]);
    console.log(`PR_ADTRANS BRONDOL records: ${adtransBrondol.length}`);
    let adtransBrondolTotal = 0;
    for (const r of adtransBrondol as any[]) {
        console.log(`  ${r.DocDate} | ${r.DocNo} | DocDesc='${r.DocDesc}' | Amount=${r.Amount} | TaskCode=${r.TaskCode} | TaskDesc='${r.TaskDesc}'`);
        adtransBrondolTotal += (r.Amount || 0);
    }
    console.log(`  TOTAL adtrans brondol: ${adtransBrondolTotal}`);
    console.log('');

    // 4. Check PR_ADTRANS for all PREMI items
    console.log('--- 4. PR_ADTRANS (all PREMI items) ---');
    const adtransPremi = await db.query(`
        SELECT t.DocDate, t.DocNo, t.DocDesc, ln.Amount, ln.TaskCode, mt.TaskDesc
        FROM PR_ADTRANS t
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
        WHERE RTRIM(t.EmpCode) = ?
          AND t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%PREMI%'
          AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
        UNION ALL
        SELECT t.DocDate, t.DocNo, t.DocDesc, ln.Amount, ln.TaskCode, mt.TaskDesc
        FROM PR_ADTRANS_ARC t
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(t.EmpCode)
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
        WHERE RTRIM(t.EmpCode) = ?
          AND t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%PREMI%'
          AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
        ORDER BY DocDate
    `, [EMP_CODE, startDate, endDate, EMP_CODE, startDate, endDate]);
    console.log(`PR_ADTRANS PREMI records: ${adtransPremi.length}`);
    let adtransPremiTotal = 0;
    for (const r of adtransPremi as any[]) {
        console.log(`  ${r.DocDate} | '${r.DocDesc}' | Amount=${r.Amount} | TaskCode=${r.TaskCode} | TaskDesc='${r.TaskDesc}'`);
        adtransPremiTotal += (r.Amount || 0);
    }
    console.log(`  TOTAL PREMI: ${adtransPremiTotal}`);
    console.log('');

    // 5. Check extend_db_ptrj - other incomes (KONTAN)
    console.log('--- 5. extend_db_ptrj - employee_other_incomes (KONTAN) ---');
    const kontan = await dbExt.query(`
        SELECT id, nik, emp_code, income_type, income_name, amount, gang_code, period_month, period_year
        FROM dbo.employee_other_incomes
        WHERE emp_code = ? AND period_month = ? AND period_year = ?
        ORDER BY id
    `, [EMP_CODE, TEST_PERIOD.month, TEST_PERIOD.year]);
    console.log(`KONTAN records: ${kontan.length}`);
    let kontanTotal = 0;
    for (const r of kontan as any[]) {
        console.log(`  id=${r.id} | type='${r.income_type}' | name='${r.income_name}' | amount=${r.amount} | gang=${r.gang_code}`);
        kontanTotal += (r.amount || 0);
    }
    console.log(`  TOTAL KONTAN: ${kontanTotal}`);
    console.log('');

    // 6. Summary
    console.log('=== SUMMARY ===');
    console.log(`PR_LOOSEFRUIT total:  ${looseFruitTotal}`);
    console.log(`PR_ADTRANS BRONDOL:  ${adtransBrondolTotal}`);
    console.log(`Combined brondol:    ${looseFruitTotal + adtransBrondolTotal}`);
    console.log(`KONTAN (other income): ${kontanTotal}`);
    console.log('');
    console.log('Expected display in UI: ${looseFruitTotal + adtransBrondolTotal}');
    console.log('');
    console.log('=== DONE ===');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
