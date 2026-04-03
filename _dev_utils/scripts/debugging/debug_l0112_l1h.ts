/**
 * Diagnostic script to check why L0112 doesn't appear in Daftar Upah for gang L1H
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/debug_l0112_l1h.ts
 */
import { Database } from "../../../backend/src/db/client";
import { currentPeriodService } from "../../../backend/src/services/currentPeriodService";

async function main() {
    const db = Database.getInstance();

    // Get current payroll period
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;
    console.log(`Current payroll period: month=${month}, year=${year}\n`);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    console.log("=== DIAGNOSTIC: L0112 in gang L1H ===\n");

    // Step 1: Check if L1H exists in HR_GANG
    console.log("--- Step 1: Check HR_GANG for L1H ---");
    const gangRows = await db.query<any>(`
        SELECT GangCode, Description, LocCode
        FROM HR_GANG
        WHERE UPPER(RTRIM(GangCode)) = 'L1H'
           OR UPPER(RTRIM(Description)) LIKE '%L1H%'
        ORDER BY GangCode
    `);
    console.log(`Found ${gangRows.length} rows:`);
    gangRows.forEach(r => {
        console.log(`  GangCode='${r.GangCode}' Description='${r.Description}' LocCode='${r.LocCode}' ID=${r.ID}`);
    });

    // Step 2: Check what gangs start with 'L' (IJL division)
    console.log("\n--- Step 2: All gangs with LocCode='L' (IJL) ---");
    const ijlGangs = await db.query<any>(`
        SELECT GangCode, Description, LocCode
        FROM HR_GANG
        WHERE UPPER(RTRIM(LocCode)) = 'L'
        ORDER BY GangCode
    `);
    console.log(`Found ${ijlGangs.length} gangs:`);
    ijlGangs.forEach(r => {
        console.log(`  GangCode='${r.GangCode}' Description='${r.Description}' LocCode='${r.LocCode}'`);
    });

    // Step 3: Check HR_GANGLN for employee L0112
    console.log("\n--- Step 3: Check HR_GANGLN for L0112 ---");
    const ganglnRows = await db.query<any>(`
        SELECT gl.GangMember as emp_code, gl.GangCode, g.Description as gang_desc, g.LocCode
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE UPPER(RTRIM(gl.GangMember)) = 'L0112'
    `);
    console.log(`Found ${ganglnRows.length} rows in HR_GANGLN:`);
    ganglnRows.forEach(r => {
        console.log(`  emp_code='${r.emp_code}' GangCode='${r.GangCode}' gang_desc='${r.gang_desc}' LocCode='${r.LocCode}'`);
    });

    // Step 4: Check if L0112 exists in HR_EMPLOYEE
    console.log("\n--- Step 4: Check HR_EMPLOYEE for L0112 ---");
    const empRows = await db.query<any>(`
        SELECT EmpCode, NewICNo, EmpName, Gender, LocCode, HREmpType
        FROM HR_EMPLOYEE
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
           OR UPPER(RTRIM(NewICNo)) = 'L0112'
    `);
    console.log(`Found ${empRows.length} rows:`);
    empRows.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' NewICNo='${r.NewICNo}' EmpName='${r.EmpName}' LocCode='${r.LocCode}' HREmpType='${r.HREmpType}'`);
    });

    // Step 5: Check if L0112 is in HR_GANGLN for any gang matching L1H pattern
    console.log("\n--- Step 5: Check HR_GANGLN entries where gang contains 'L1' ---");
    const l1Gangs = await db.query<any>(`
        SELECT DISTINCT gl.GangCode, g.Description, g.LocCode, gl.GangMember
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE UPPER(RTRIM(gl.GangCode)) LIKE 'L1%'
           OR UPPER(RTRIM(g.Description)) LIKE '%L1%'
        ORDER BY gl.GangCode, gl.GangMember
    `);
    console.log(`Found ${l1Gangs.length} entries:`);
    l1Gangs.forEach(r => {
        console.log(`  GangCode='${r.GangCode}' Desc='${r.Description}' GangMember='${r.GangMember}'`);
    });

    // Step 6: Check PR_TASKREGLN for L0112 attendance in March 2026
    console.log(`\n--- Step 6: Check PR_TASKREGLN for L0112 attendance (${startDate} to ${endDate}) ---`);
    const attRows = await db.query<any>(`
        SELECT EmpCode, COUNT(*) as task_count, SUM(Hours) as total_hours
        FROM PR_TASKREGLN
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        GROUP BY EmpCode
    `);
    console.log(`Found ${attRows.length} attendance rows:`);
    attRows.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' task_count=${r.task_count} total_hours=${r.total_hours}`);
    });

    // Step 6b: Detailed attendance for L0112
    console.log("\n--- Step 6b: Detailed PR_TASKREGLN for L0112 ---");
    const attDetail = await db.query<any>(`
        SELECT TrxDate, TaskCode, Hours, Amount, OT
        FROM PR_TASKREGLN
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        ORDER BY TrxDate
    `);
    console.log(`Found ${attDetail.length} detailed task rows:`);
    attDetail.forEach(r => {
        console.log(`  ${r.TrxDate} | TaskCode='${r.TaskCode}' Hours=${r.Hours} Amount=${r.Amount} OT=${r.OT}`);
    });

    // Step 6c: Check ARC table for attendance
    console.log("\n--- Step 6c: Check PR_TASKREGLN_ARC for L0112 ---");
    const attArc = await db.query<any>(`
        SELECT EmpCode, COUNT(*) as task_count, SUM(Hours) as total_hours
        FROM PR_TASKREGLN_ARC
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        GROUP BY EmpCode
    `);
    console.log(`Found ${attArc.length} archived attendance rows:`);
    attArc.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' task_count=${r.task_count} total_hours=${r.total_hours}`);
    });

    // Step 6d: HK calculation for L0112 (like dataExtractor does it)
    console.log("\n--- Step 6d: HK calculation for L0112 ---");
    const hkCalc = await db.query<any>(`
        SELECT
            EmpCode,
            COUNT(DISTINCT TrxDate) as hk,
            SUM(Hours) as total_hours
        FROM PR_TASKREGLN
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        GROUP BY EmpCode
    `);
    console.log(`HK calculation result: ${hkCalc.length} rows`);
    hkCalc.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' hk=${r.hk} total_hours=${r.total_hours}`);
    });

    // Step 6e: Also check with AccMonth/AccYear filtering for ARC
    const { accMonth, accYear } = currentPeriodService.calendarToAccMonth(month, year);
    console.log(`\n--- Step 6e: Check PR_TASKREGLN_ARC with AccMonth=${accMonth} AccYear=${accYear} ---`);
    const attArc2 = await db.query<any>(`
        SELECT l.EmpCode, COUNT(*) as task_count, SUM(l.Hours) as total_hours
        FROM PR_TASKREGLN_ARC l
        WHERE UPPER(RTRIM(l.EmpCode)) = 'L0112'
          AND l.AccMonth = ? AND l.AccYear = ?
        GROUP BY l.EmpCode
    `, [accMonth, accYear]);
    console.log(`Found ${attArc2.length} rows:`);
    attArc2.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' task_count=${r.task_count} total_hours=${r.total_hours}`);
    });

    // Step 7: Check HR_PAYROLL for L0112
    console.log("\n--- Step 7: Check HR_PAYROLL for L0112 ---");
    const payRows = await db.query<any>(`
        SELECT EmpCode, PayRate, RiceRation, StartDate, EndDate
        FROM HR_PAYROLL
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
    `);
    console.log(`Found ${payRows.length} rows:`);
    payRows.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' PayRate=${r.PayRate} RiceRation=${r.RiceRation} StartDate=${r.StartDate} EndDate=${r.EndDate}`);
    });

    // Step 8: Check HR_EMPLOYMENT for L0112
    console.log("\n--- Step 8: Check HR_EMPLOYMENT for L0112 ---");
    const empmtRows = await db.query<any>(`
        SELECT EmpCode, AppJoinGrpDate, Status
        FROM HR_EMPLOYMENT
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
    `);
    console.log(`Found ${empmtRows.length} rows:`);
    empmtRows.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' AppJoinGrpDate=${r.AppJoinGrpDate} Status=${r.Status}`);
    });

    // Step 9: What does the extractPayrollData query actually see for L1H?
    console.log("\n--- Step 9: Simulate getEmployees query for gang L1H ---");
    const empFromQuery = await db.query<any>(`
        SELECT DISTINCT
            RTRIM(e.EmpCode) as emp_code,
            e.NewICNo as actual_nik,
            e.EmpName as emp_name,
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            COALESCE(p.PayRate, 0) as pay_rate,
            COALESCE(p.RiceRation, 0) as beras_rate
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
        WHERE (UPPER(RTRIM(gl.GangCode)) = 'L1H' OR UPPER(RTRIM(g.GangCode)) = 'L1H' OR UPPER(RTRIM(g.Description)) = 'L1H')
        ORDER BY emp_code
    `);
    console.log(`Found ${empFromQuery.length} employees from getEmployees query for L1H:`);
    empFromQuery.forEach(r => {
        console.log(`  emp_code='${r.emp_code}' nik='${r.actual_nik}' name='${r.emp_name}' gang='${r.gang_code}' desc='${r.gang_desc}' pay_rate=${r.pay_rate}`);
    });

    // Step 10: Also check PR_GANGLN_ARC for archived data
    console.log("\n--- Step 10: Check PR_GANGLN_ARC for L0112 ---");
    const arcRows = await db.query<any>(`
        SELECT gl.EmpCode, gl.GangCode, gl.MasterID, g.GangID, g.Description, gl.AccMonth, gl.AccYear
        FROM PR_GANGLN_ARC gl
        LEFT JOIN PR_GANG g ON g.ID = gl.MasterID
        WHERE UPPER(RTRIM(gl.EmpCode)) = 'L0112'
        ORDER BY gl.AccYear DESC, gl.AccMonth DESC
    `);
    console.log(`Found ${arcRows.length} archived entries:`);
    arcRows.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' GangCode='${r.GangCode}' GangID='${r.GangID}' Desc='${r.Description}' ${r.AccMonth}/${r.AccYear}`);
    });

    // Step 11: Check cuti for L0112 (same query as getCutiData)
    console.log("\n--- Step 11: Check cuti data for L0112 (like dataExtractor does) ---");
    const cutiRows = await db.query<any>(`
        SELECT
            EmpCode,
            SUM(CASE WHEN TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END) as cuti_tahunan,
            SUM(CASE WHEN TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END) as cuti_sakit_haid,
            SUM(CASE WHEN TaskCode LIKE 'GA9127%' OR (DATEPART(weekday, TrxDate) = 1 AND NOT EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = TrxDate AND h.Status = 1)) THEN 1 ELSE 0 END) as cuti_minggu,
            SUM(CASE WHEN TaskCode LIKE 'GA9128%' OR EXISTS (SELECT 1 FROM HR_GPH h WHERE h.HolidayDate = TrxDate AND h.Status = 1) THEN 1 ELSE 0 END) as cuti_nasional
        FROM PR_TASKREGLN
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        GROUP BY EmpCode
    `);
    console.log(`Found ${cutiRows.length} cuti rows:`);
    cutiRows.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' tahunan=${r.cuti_tahunan} sakit_haid=${r.cuti_sakit_haid} minggu=${r.cuti_minggu} nasional=${r.cuti_nasional}`);
    });

    // Step 12: Check PR_ADTRANS for L0112 (premi/potongan)
    console.log("\n--- Step 12: Check PR_ADTRANS for L0112 ---");
    const adtransRows = await db.query<any>(`
        SELECT DocNo, DocDate, DocDesc, Amount
        FROM PR_ADTRANS
        WHERE UPPER(RTRIM(EmpCode)) = 'L0112'
          AND MONTH(DocDate) = ${month} AND YEAR(DocDate) = ${year}
        ORDER BY DocDate
    `);
    console.log(`Found ${adtransRows.length} PR_ADTRANS rows:`);
    adtransRows.forEach(r => {
        console.log(`  ${r.DocDate} | DocNo='${r.DocNo}' DocDesc='${r.DocDesc}' Amount=${r.Amount}`);
    });

    // Step 12b: Check PR_ADTRANS using NewICNo (NIK)
    console.log("\n--- Step 12b: Check PR_ADTRANS using NIK from emp_data ---");
    if (empData) {
        const nikSearch = empData.actual_nik?.trim().toUpperCase();
        if (nikSearch) {
            const adtransNik = await db.query<any>(`
                SELECT DocNo, DocDate, DocDesc, Amount
                FROM PR_ADTRANS
                WHERE UPPER(RTRIM(EmpCode)) = '${nikSearch}'
                  AND MONTH(DocDate) = ${month} AND YEAR(DocDate) = ${year}
                ORDER BY DocDate
            `);
            console.log(`Found ${adtransNik.length} PR_ADTRANS rows for NIK '${nikSearch}':`);
            adtransNik.forEach(r => {
                console.log(`  ${r.DocDate} | DocNo='${r.DocNo}' DocDesc='${r.DocDesc}' Amount=${r.Amount}`);
            });
        }
    }

    // Step 12c: Search for L0112 as emp_code OR NewICNo anywhere
    console.log("\n--- Step 12c: Search L0112 anywhere (emp_code OR NIK) ---");
    const searchBoth = await db.query<any>(`
        SELECT e.EmpCode, e.NewICNo, e.EmpName, gl.GangCode, g.Description
        FROM HR_EMPLOYEE e
        LEFT JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE UPPER(RTRIM(e.EmpCode)) = 'L0112'
           OR UPPER(RTRIM(e.NewICNo)) = 'L0112'
           OR UPPER(RTRIM(e.NewICNo)) LIKE '%L0112%'
    `);
    console.log(`Found ${searchBoth.length} results:`);
    searchBoth.forEach(r => {
        console.log(`  EmpCode='${r.EmpCode}' NewICNo='${r.NewICNo}' Name='${r.EmpName}' GangCode='${r.GangCode}' Desc='${r.Description}'`);
    });

    // Step 13: Summary - simulate the full filter logic
    console.log("\n--- Step 13: Summary - simulate filter logic ---");
    const empData = empFromQuery.find((r: any) => r.emp_code?.toUpperCase() === 'L0112');
    if (empData) {
        const hkRow = hkCalc[0] || { hk: 0, total_hours: 0 };
        const cutiRow = cutiRows[0] || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };
        const hk = hkRow.hk;
        const effective_hk = hk - (Number(cutiRow.cuti_minggu) + Number(cutiRow.cuti_nasional));
        const totalCuti = Number(cutiRow.cuti_tahunan) + Number(cutiRow.cuti_sakit_haid) + Number(cutiRow.cuti_minggu) + Number(cutiRow.cuti_nasional);
        const hari_kerja = Math.max(0, hk - totalCuti);
        const other_cuti = Number(cutiRow.cuti_tahunan) + Number(cutiRow.cuti_sakit_haid);
        console.log(`  hk=${hk}`);
        console.log(`  cuti: tahunan=${cutiRow.cuti_tahunan} sakit_haid=${cutiRow.cuti_sakit_haid} minggu=${cutiRow.cuti_minggu} nasional=${cutiRow.cuti_nasional}`);
        console.log(`  totalCuti=${totalCuti} hari_kerja=${hari_kerja} other_cuti=${other_cuti} effective_hk=${effective_hk}`);
        console.log(`  --- FILTER CHECK ---`);
        console.log(`  If total_earnings <= 0 AND hari_kerja <= 0 AND other_cuti == 0 → EXCLUDED`);
        console.log(` hari_kerja <= 0: ${hari_kerja <= 0}`);
        console.log(`  other_cuti == 0: ${other_cuti == 0}`);
        console.log(`  → EMPLOYEE WOULD BE ${(hari_kerja <= 0 && other_cuti == 0) ? 'EXCLUDED' : 'INCLUDED'}`);
    } else {
        console.log("  L0112 NOT FOUND in employee query for gang L1H!");
        console.log("  Possible reasons:");
        console.log("  1. L0112 is not in HR_GANGLN for gang L1H");
        console.log("  2. L1H is not the actual GangCode in HR_GANG");
        console.log("  3. L0112 might be a NIK, not an emp_code");
    }

    console.log("\n=== END DIAGNOSTIC ===");
}

main().catch(console.error);
