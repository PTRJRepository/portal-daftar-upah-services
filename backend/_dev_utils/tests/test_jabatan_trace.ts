/**
 * Check jabatan data sources for current period
 */
import { Database } from '../../src/db/client';
import { currentPeriodService } from '../../src/services/currentPeriodService';
import { EmployeeEstateService } from '../../src/services/employeeEstateService';
import * as fs from 'fs';

const mainDb = Database.getInstance();

const lines: string[] = [];
function log(msg: string) {
    console.log(msg);
    lines.push(msg);
}

async function run() {
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    log(`Period: ${month}/${year}, range: ${startDate} to ${endDate}`);

    // ---- Check PR_ADTRANS for JABATAN ----
    log(`\n--- PR_ADTRANS: Looking for JABATAN ---`);
    const jabLive = await mainDb.query<any>(`
        SELECT TOP 5 RTRIM(t.EmpCode) as emp_code, t.DocDesc, t.DocDate, SUM(ln.Amount) as total
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE UPPER(t.DocDesc) LIKE '%JABATAN%' AND ln.Amount > 0
        GROUP BY RTRIM(t.EmpCode), t.DocDesc, t.DocDate
        ORDER BY t.DocDate DESC
    `);
    if (jabLive.length === 0) {
        log('No JABATAN in PR_ADTRANS at all (any date)!');
    } else {
        log(`Found ${jabLive.length} JABATAN records in PR_ADTRANS:`);
        for (const r of jabLive) {
            log(`  EmpCode=${r.emp_code}, DocDate=${r.DocDate}, DocDesc="${r.DocDesc}", total=${r.total}`);
        }
        
        const jabCurrentPeriod = await mainDb.query<any>(`
            SELECT COUNT(*) as cnt
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE UPPER(t.DocDesc) LIKE '%JABATAN%' AND ln.Amount > 0
              AND t.DocDate >= ? AND t.DocDate < ?
        `, [startDate, endDate]);
        log(`Records in current period: ${jabCurrentPeriod[0]?.cnt || 0}`);
    }

    // Check ARC table
    log(`\n--- PR_ADTRANS_ARC: Looking for JABATAN ---`);
    const jabArc = await mainDb.query<any>(`
        SELECT TOP 5 RTRIM(t.EmpCode) as emp_code, t.DocDesc, t.DocDate, SUM(ln.Amount) as total
        FROM PR_ADTRANS_ARC t
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        WHERE UPPER(t.DocDesc) LIKE '%JABATAN%' AND ln.Amount > 0
          AND t.DocDate >= ? AND t.DocDate < ?
        GROUP BY RTRIM(t.EmpCode), t.DocDesc, t.DocDate
        ORDER BY t.DocDate DESC
    `, [startDate, endDate]);
    if (jabArc.length === 0) {
        log('No JABATAN in PR_ADTRANS_ARC for current period!');
        // Check all dates in ARC
        const jabArcAll = await mainDb.query<any>(`
            SELECT TOP 5 RTRIM(t.EmpCode) as emp_code, t.DocDesc, t.DocDate, SUM(ln.Amount) as total
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE UPPER(t.DocDesc) LIKE '%JABATAN%' AND ln.Amount > 0
            GROUP BY RTRIM(t.EmpCode), t.DocDesc, t.DocDate
            ORDER BY t.DocDate DESC
        `);
        log(`PR_ADTRANS_ARC ALL DATES (${jabArcAll.length}):`);
        for (const r of jabArcAll) {
            log(`  ${r.emp_code}: DocDate=${r.DocDate}, DocDesc="${r.DocDesc}", total=${r.total}`);
        }
    } else {
        log(`Found ${jabArc.length} JABATAN records in ARC:`);
        for (const r of jabArc) {
            log(`  ${r.emp_code}: DocDate=${r.DocDate}, DocDesc="${r.DocDesc}", total=${r.total}`);
        }
    }

    // ---- Check employee_estate table ----
    log(`\n--- employee_estate: Jabatan role assignments ---`);
    const { empcodeMap, nikMap } = await EmployeeEstateService.getEmployeeJobsWithNik();
    log(`empcodeMap size: ${Object.keys(empcodeMap).length}`);
    log(`nikMap size: ${Object.keys(nikMap).length}`);

    // Show sample
    const sampleCodes = Object.keys(empcodeMap).slice(0, 5);
    for (const code of sampleCodes) {
        log(`  EmpCode=${code} → jabatan=${empcodeMap[code]}`);
    }

    if (Object.keys(nikMap).length > 0) {
        const sampleNiks = Object.keys(nikMap).slice(0, 5);
        for (const nik of sampleNiks) {
            log(`  NIK=${nik} → jabatan=${nikMap[nik]}`);
        }
    }

    // ---- Check what getPositionHistory returns ----
    log(`\n--- Explanation of jabatan_rate vs jabatan_estate ---`);
    log(`jabatan_estate = role name (string) from employee_estate table`);
    log(`jabatan_jumlah = Rp amount from PR_ADTRANS DocDesc LIKE '%JABATAN%'`);
    log(`These are DIFFERENT: role name from our DB vs tunjangan amount from payroll transactions`);

    // How many employees have jabatan in employee_estate?
    const totalEstate = Object.keys(empcodeMap).length;
    const totalNikMap = Object.keys(nikMap).length;
    log(`\nTotal empcode-jabatan mappings: ${totalEstate}`);
    log(`Total nik-jabatan mappings: ${totalNikMap}`);

    // Check a PG1A member specifically
    log(`\n--- PG1A member jabatan lookup ---`);
    const pg1aMembers = await mainDb.query<any>(`
        SELECT TOP 10 RTRIM(gl.GangCode) as gang, RTRIM(gl.GangMember) as emp_code,
               RTRIM(e.EmpName) as emp_name, RTRIM(ISNULL(e.NewICNo, '')) as nik
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE RTRIM(gl.GangCode) LIKE 'P1A%'
    `);
    log(`PG1A members found: ${pg1aMembers.length}`);
    for (const m of pg1aMembers) {
        const jabByEmpCode = empcodeMap[m.emp_code] || null;
        const jabByNik = nikMap[m.nik.toUpperCase()] || null;
        log(`  EmpCode=${m.emp_code}, NIK=${m.nik}, Name="${m.emp_name}"`);
        log(`    → empcodeMap[${m.emp_code}]: ${jabByEmpCode}`);
        log(`    → nikMap[${m.nik}]: ${jabByNik}`);
    }

    fs.writeFileSync('_dev_utils/tests/jabatan_trace.txt', lines.join('\n'));
    log('\nSaved to jabatan_trace.txt');
    process.exit(0);
}

run().catch(e => {
    const msg = `Error: ${e.message}\n${e.stack}`;
    console.error(msg);
    fs.writeFileSync('_dev_utils/tests/jabatan_trace.txt', msg);
    process.exit(1);
});
