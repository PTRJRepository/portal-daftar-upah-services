/**
 * Skrip Diagnostik: Investigasi Karyawan J0843 tidak muncul di Gang J1P
 * 
 * Jalankan: cd backend && bun run _dev_utils/tests/diagnose_j0843.ts
 */

const DB_API_URL = "http://10.0.0.110:8001";
const DB_API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6";
const SERVER_PROFILE = "SERVER_PROFILE_2";
const DATABASE = "db_ptrj";

async function query(sql: string, params?: any[]): Promise<any[]> {
    let finalSql = sql;
    const namedParams: Record<string, any> = {};

    if (params && params.length > 0) {
        let i = 0;
        finalSql = sql.replace(/\?/g, () => {
            const key = `p${i}`;
            namedParams[key] = params[i];
            i++;
            return `@${key}`;
        });
    }

    const response = await fetch(`${DB_API_URL}/v1/query`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": DB_API_KEY
        },
        body: JSON.stringify({
            sql: finalSql,
            params: namedParams,
            server: SERVER_PROFILE,
            database: DATABASE
        })
    });

    const result = await response.json() as any;
    if (!result.success) throw new Error(result.error || "Query failed");
    return result.data?.recordset || [];
}

async function main() {
    const NIK = "J0843";
    const GANG = "J1P";

    console.log("============================================================");
    console.log(`DIAGNOSTIK: Karyawan ${NIK} di Gang ${GANG}`);
    console.log("============================================================\n");

    // 1. Check apakah J0843 ada di HR_EMPLOYEE
    console.log("--- 1. CEK HR_EMPLOYEE ---");
    const emp = await query(`SELECT EmpCode, EmpName, Gender, LocCode FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?`, [NIK]);
    if (emp.length === 0) {
        console.log(`❌ Karyawan ${NIK} TIDAK ADA di HR_EMPLOYEE!`);
    } else {
        console.log(`✅ Karyawan ditemukan:`, emp[0]);
    }

    // 2. Check HR_GANGLN - apakah J0843 punya gang assignment
    console.log("\n--- 2. CEK HR_GANGLN (Gang membership saat ini) ---");
    const gangln = await query(`SELECT GangMember, GangCode FROM HR_GANGLN WHERE RTRIM(GangMember) = ?`, [NIK]);
    if (gangln.length === 0) {
        console.log(`❌ ${NIK} TIDAK PUNYA gang assignment di HR_GANGLN!`);
        console.log("   → Ini kemungkinan penyebab utama karyawan tidak muncul.");
    } else {
        console.log(`✅ Gang assignments:`, gangln);
    }

    // 3. Check HR_GANG - apakah J1P ada dan apa description-nya
    console.log("\n--- 3. CEK HR_GANG (info gang J1P) ---");
    const gang = await query(`SELECT GangCode, Description, LocCode FROM HR_GANG WHERE RTRIM(GangCode) = ?`, [GANG]);
    if (gang.length === 0) {
        console.log(`❌ Gang ${GANG} TIDAK ADA di HR_GANG!`);
    } else {
        console.log(`✅ Gang info:`, gang[0]);
    }

    // 4. Check semua anggota J1P di HR_GANGLN
    console.log("\n--- 4. SEMUA ANGGOTA gang J1P di HR_GANGLN ---");
    const members = await query(`
        SELECT gl.GangMember, e.EmpName, g.Description as gang_desc
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE RTRIM(gl.GangCode) = ?
        ORDER BY e.EmpName
    `, [GANG]);
    console.log(`Total anggota gang ${GANG}: ${members.length}`);
    members.forEach((m: any) => console.log(`  - ${m.GangMember} | ${m.EmpName} | desc: ${m.gang_desc}`));

    // 5. Check apakah J0843 pernah ada di gang lain
    console.log("\n--- 5. SEMUA GANG MEMBERSHIP J0843 ---");
    const allGangs = await query(`
        SELECT gl.GangCode, g.Description, g.LocCode
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE RTRIM(gl.GangMember) = ?
    `, [NIK]);
    if (allGangs.length === 0) {
        console.log(`❌ ${NIK} tidak ada di gang manapun di HR_GANGLN`);
    } else {
        console.log(`Gang memberships:`, allGangs);
    }

    // 6. Check HR_PAYROLL untuk J0843
    console.log("\n--- 6. CEK HR_PAYROLL ---");
    const payroll = await query(`SELECT EmpCode, PayRate, RiceRation FROM HR_PAYROLL WHERE RTRIM(EmpCode) = ?`, [NIK]);
    if (payroll.length === 0) {
        console.log(`❌ ${NIK} TIDAK ADA di HR_PAYROLL (tidak punya pay rate)!`);
    } else {
        console.log(`✅ HR_PAYROLL:`, payroll[0]);
    }

    // 7. Check attendance - apakah J0843 punya absensi di bulan terakhir
    const now = new Date();
    const month = now.getMonth() + 1; // Current month
    const year = now.getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    console.log(`\n--- 7. CEK ABSENSI bulan ${month}/${year} (${startDate} s/d ${endDate}) ---`);
    const att = await query(`
        SELECT COUNT(*) as count, SUM(Amount) as total
        FROM PR_TASKREGLN_ARC
        WHERE RTRIM(EmpCode) = ?
          AND TrxDate >= ? AND TrxDate < ?
    `, [NIK, startDate, endDate]);
    console.log(`Absensi:`, att[0]);

    // 7b. Cek kolom yang ada di PR_TASKREGLN_ARC untuk sampling
    console.log("\n--- 7b. SAMPLE ROW PR_TASKREGLN_ARC untuk J0843 ---");
    const sampleAbs = await query(`
        SELECT TOP 3 EmpCode, TrxDate, OT, TaskCode
        FROM PR_TASKREGLN_ARC
        WHERE RTRIM(EmpCode) = ?
        ORDER BY TrxDate DESC
    `, [NIK]);
    if (sampleAbs.length === 0) {
        console.log(`❌ TIDAK ADA data absensi sama sekali untuk ${NIK} di PR_TASKREGLN_ARC!`);
    } else {
        console.log("Sample absensi:", sampleAbs);
    }

    // 8. Simulasi allGangs untuk divisi ARC (virtual division pattern ^J)  
    console.log(`\n--- 8. DAFTAR GANG di HR_GANG dengan LocCode=ARC (pattern ^J) ---`);
    const arcGangs = await query(`
        SELECT GangCode, Description, LocCode 
        FROM HR_GANG 
        WHERE LocCode = 'ARC'
        ORDER BY GangCode
    `);
    console.log(`Total gang ARC di HR_GANG: ${arcGangs.length}`);
    arcGangs.forEach((g: any) => console.log(`  [${g.GangCode?.trim()}] ${g.Description?.trim()} | loc: ${g.LocCode?.trim()}`));
    const j1pInArc = arcGangs.some((g: any) => g.GangCode?.trim() === GANG);
    console.log(`\nJ1P ada di daftar gang ARC: ${j1pInArc ? '✅ YA' : '❌ TIDAK'}`);

    // 9. Simulasi gangCondition untuk division ARC
    console.log(`\n--- 9. SIMULASI QUERY division ARC (seperti extractPayrollData) ---`);
    const gangDescList = arcGangs.map((g: any) => `UPPER(RTRIM(g.Description)) = UPPER('${g.Description?.trim()}')`).join(' OR ');

    if (gangDescList) {
        const divisionResult = await query(`
            SELECT DISTINCT
                RTRIM(e.EmpCode) as emp_code,
                e.EmpName as emp_name,
                RTRIM(g.Description) as gang_desc,
                RTRIM(gl.GangCode) as gang_code
            FROM HR_EMPLOYEE e
            INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
            INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
            LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
            WHERE (${gangDescList})
            ORDER BY emp_code
        `);
        console.log(`Total karyawan di division ARC: ${divisionResult.length}`);
        const j0843InDiv = divisionResult.some((r: any) => r.emp_code?.trim() === NIK);
        console.log(`J0843 muncul di division ARC result: ${j0843InDiv ? '✅ YA' : '❌ TIDAK'}`);
        if (!j0843InDiv) {
            console.log(`\n   → Ini karena J1P mungkin tidak masuk daftar gang ARC yang di-fetch`);
            console.log(`   → Cek apakah J1P ada di HR_GANG.LocCode='ARC': ${j1pInArc ? 'YA' : 'TIDAK'}`);
        }
        // Print semua karyawan yang muncul
        console.log("\nKaryawan yang muncul di division ARC:");
        divisionResult.slice(0, 10).forEach((r: any) => console.log(`  [${r.emp_code}] ${r.emp_name?.trim()} | gang: ${r.gang_code} | desc: ${r.gang_desc?.trim()}`));
        if (divisionResult.length > 10) console.log(`  ... dan ${divisionResult.length - 10} karyawan lainnya`);
    } else {
        console.log("❌ Tidak ada gang ARC untuk simulasi");
    }

    // 10. Yang paling kritis: simulasi gangCondition seperti di extractPayrollData
    console.log(`\n--- 10. SIMULASI QUERY extractPayrollData untuk gang ${GANG} ---`);
    const gangDesc = gang.length > 0 ? gang[0].Description : GANG;
    console.log(`Gang ${GANG} description: "${gangDesc}"`);
    const simResult = await query(`
        SELECT DISTINCT
            RTRIM(e.EmpCode) as emp_code,
            e.EmpName as emp_name,
            RTRIM(g.Description) as gang_code
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        LEFT JOIN HR_PAYROLL p ON RTRIM(p.EmpCode) = RTRIM(e.EmpCode)
        WHERE UPPER(RTRIM(g.Description)) = UPPER(?)
        ORDER BY emp_code
    `, [gangDesc]);
    console.log(`Hasil query simulasi (employee di gang ${GANG}): ${simResult.length} karyawan`);
    const isJ0843Found = simResult.some((r: any) => r.emp_code?.trim() === NIK);
    if (isJ0843Found) {
        console.log(`✅ ${NIK} MUNCUL di hasil query`);
    } else {
        console.log(`❌ ${NIK} TIDAK MUNCUL di hasil query`);
        console.log("   → Periksa apakah J0843 ada di HR_GANGLN dengan GangCode=J1P");
        console.log("   → Dan apakah J1P memiliki Description yang cocok");
    }
    simResult.forEach((r: any) => console.log(`  [${r.emp_code}] ${r.emp_name} | gang: ${r.gang_code}`));

    console.log("\n============================================================");
    console.log("DIAGNOSIS SELESAI");
    console.log("============================================================");
}

main().catch(console.error);
