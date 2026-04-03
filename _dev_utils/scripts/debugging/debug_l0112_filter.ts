/**
 * Debug: Trace exactly which employee is filtered out and why
 */
import { Database } from "../../../backend/src/db/client";
import { currentPeriodService } from "../../../backend/src/services/currentPeriodService";

async function main() {
    const db = Database.getInstance();
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = `${year}-${String(month).padStart(2,'0')}-${String(new Date(year, month, 0).getDate()).padStart(2,'0')}`;
    console.log(`Period: ${month}/${year}, ${startDate} to ${endDate}`);

    // Step 1: Get all 19 L1H employees
    const employees = await db.query(`
        SELECT DISTINCT
            RTRIM(e.EmpCode) as emp_code,
            e.EmpName as emp_name,
            RTRIM(gl.GangCode) as gang_code
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE (UPPER(RTRIM(gl.GangCode)) = 'L1H' OR UPPER(RTRIM(g.GangCode)) = 'L1H' OR UPPER(RTRIM(g.Description)) = 'L1H')
        ORDER BY emp_code
    `);
    console.log(`Total L1H employees: ${employees.length}`);
    employees.forEach(e => console.log(`  ${e.emp_code} | ${e.emp_name}`));

    // Step 2: Check attendance (HK) for each
    const attMap = new Map<string, any>();
    const empCodes = employees.map((e: any) => e.emp_code);
    const attRows = await db.query(`
        SELECT EmpCode, COUNT(DISTINCT TrxDate) as hk, SUM(Hours) as total_hours
        FROM PR_TASKREGLN
        WHERE UPPER(RTRIM(EmpCode)) IN (${empCodes.map((c: string) => `'${c}'`).join(',')})
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        GROUP BY EmpCode
    `);
    attRows.forEach((r: any) => attMap.set(r.EmpCode?.trim(), r));

    // Step 3: Check cuti for each (simplified - just use TaskCode pattern)
    const cutiMap = new Map<string, any>();
    const cutiRows = await db.query(`
        SELECT
            EmpCode,
            SUM(CASE WHEN TaskCode LIKE 'GA9129%' THEN 1 ELSE 0 END) as cuti_tahunan,
            SUM(CASE WHEN TaskCode LIKE 'GA9126%' THEN 1 ELSE 0 END) as cuti_sakit_haid,
            SUM(CASE WHEN TaskCode LIKE 'GA9127%' THEN 1 ELSE 0 END) as cuti_minggu,
            SUM(CASE WHEN TaskCode LIKE 'GA9128%' THEN 1 ELSE 0 END) as cuti_nasional
        FROM PR_TASKREGLN
        WHERE UPPER(RTRIM(EmpCode)) IN (${empCodes.map((c: string) => `'${c}'`).join(',')})
          AND TrxDate >= '${startDate}' AND TrxDate <= '${endDate}'
        GROUP BY EmpCode
    `);
    cutiRows.forEach((r: any) => cutiMap.set(r.EmpCode?.trim(), r));

    // Step 4: Apply filter logic for each employee
    console.log("\n--- FILTER ANALYSIS ---");
    const filteredOut: string[] = [];
    const included: string[] = [];
    employees.forEach((emp: any) => {
        const ec = emp.emp_code?.trim();
        const att = attMap.get(ec) || { hk: 0, total_hours: 0 };
        const cuti = cutiMap.get(ec) || { cuti_tahunan: 0, cuti_sakit_haid: 0, cuti_minggu: 0, cuti_nasional: 0 };

        const hk = Number(att.hk) || 0;
        const effective_hk = hk - (Number(cuti.cuti_minggu) + Number(cuti.cuti_nasional));
        const totalCuti = Number(cuti.cuti_tahunan) + Number(cuti.cuti_sakit_haid) + Number(cuti.cuti_minggu) + Number(cuti.cuti_nasional);
        const hari_kerja = Math.max(0, hk - totalCuti);
        const other_cuti = Number(cuti.cuti_tahunan) + Number(cuti.cuti_sakit_haid);

        // NOTE: total_earnings would be needed for exact filtering
        // But we can check hari_kerja and other_cuti
        const excludedByHariKerja = hari_kerja <= 0 && other_cuti == 0;
        const excludedByEffectiveHK = effective_hk <= 0;

        console.log(`  ${ec} | HK=${hk} effHK=${effective_hk} hari_kerja=${hari_kerja} other_cuti=${other_cuti} | minggu=${cuti.cuti_minggu} nasional=${cuti.cuti_nasional} tahunan=${cuti.cuti_tahunan} sakit=${cuti.cuti_sakit_haid} | EXCLUDED=${excludedByHariKerja || excludedByEffectiveHK}`);

        if (excludedByHariKerja || excludedByEffectiveHK) {
            filteredOut.push(ec);
        } else {
            included.push(ec);
        }
    });

    console.log(`\n=== RESULT ===`);
    console.log(`Included: ${included.length} employees`);
    included.forEach(e => console.log(`  + ${e}`));
    console.log(`\nFiltered OUT: ${filteredOut.length} employees`);
    filteredOut.forEach(e => console.log(`  - ${e}`));

    // Step 5: Check specifically for L0112
    console.log("\n--- L0112 SPECIFIC ---");
    const l0112 = employees.find((e: any) => e.emp_code?.trim() === 'L0112');
    if (l0112) {
        console.log(`L0112 found in L1H employees!`);
        const att = attMap.get('L0112');
        const cuti = cutiMap.get('L0112');
        console.log(`  Attendance: HK=${att?.hk}, hours=${att?.total_hours}`);
        console.log(`  Cuti: ${JSON.stringify(cuti)}`);
    } else {
        console.log(`L0112 NOT found in L1H employee list!`);
    }
}
main().catch(console.error);
