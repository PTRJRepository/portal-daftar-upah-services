import { Database } from "../../../src/db/client";

async function main() {
    // Use main payroll database to check live employee data
    const liveDb = Database.getInstance();
    const extDb = Database.getExtendedInstance();
    
    const gangCode = "F1M";
    const month = 3;
    const year = 2026;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month === 12 ? year + 1 : year}-${(month % 12) + 1}-01`;

    console.log(`=== COMPARING: Live Payroll vs Aggregation for ${gangCode} ===\n`);

    // ===== 1. Get stored aggregation value =====
    console.log("📊 Fetching STORED aggregation value...");
    const aggRows = await extDb.query<any>(`
        SELECT total_upah_kotor, total_potongan, total_upah_bersih, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);

    const stored = aggRows[0];
    console.log(`Stored upah_bersih: ${(stored.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    console.log(`Stored upah_kotor: ${(stored.total_upah_kotor || 0).toLocaleString('id-ID')}`);
    console.log(`Stored potongan: ${(stored.total_potongan || 0).toLocaleString('id-ID')}`);

    // ===== 2. Get LIVE employee data =====
    console.log(`\n📊 Fetching LIVE payroll data...`);
    
    // Get employee list for this gang
    const empRows = await liveDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE g.GangCode = ?
    `, [gangCode]);

    console.log(`Found ${empRows.length} employees in gang ${gangCode}`);

    if (empRows.length === 0) {
        console.log("No employees found!");
        return;
    }

    // Get HK data
    const empCodes = empRows.map((e: any) => `'${e.emp_code}'`).join(',');
    
    const hkRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code, 
               SUM(CASE WHEN TrxDate >= '${startDate}' AND TrxDate < '${endDate}' THEN 1 ELSE 0 END) as hk
        FROM PR_TASKREGLN trl
        JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
        WHERE RTRIM(EmpCode) IN (${empCodes})
          AND tr.DocDate >= '${startDate}' AND tr.DocDate < '${endDate}'
        GROUP BY RTRIM(EmpCode)
    `);

    const hkMap = new Map<string, number>();
    for (const r of hkRows) {
        hkMap.set(r.emp_code, r.hk || 0);
    }

    // Get attendance (minggu + nasional + cuti)
    const attendanceRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code,
               SUM(CASE WHEN AttendanceType = 'MINGGU' THEN 1 ELSE 0 END) as cuti_minggu,
               SUM(CASE WHEN AttendanceType = 'NASIONAL' THEN 1 ELSE 0 END) as cuti_nasional,
               SUM(CASE WHEN AttendanceType = 'TAHUNAN' THEN 1 ELSE 0 END) as cuti_tahunan,
               SUM(CASE WHEN AttendanceType = 'SAKIT_HAID' THEN 1 ELSE 0 END) as cuti_sakit
        FROM PR_ATTENDANCE
        WHERE RTRIM(EmpCode) IN (${empCodes})
          AND AttendanceDate >= '${startDate}' AND AttendanceDate < '${endDate}'
        GROUP BY RTRIM(EmpCode)
    `);

    const attendanceMap = new Map<string, any>();
    for (const r of attendanceRows) {
        attendanceMap.set(r.emp_code, {
            minggu: r.cuti_minggu || 0,
            nasional: r.cuti_nasional || 0,
            tahunan: r.cuti_tahunan || 0,
            sakit: r.cuti_sakit || 0
        });
    }

    // Get upah_dasar
    const rateRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code, PayRate
        FROM HR_EMPLOYMENT
        WHERE RTRIM(EmpCode) IN (${empCodes})
    `);

    const rateMap = new Map<string, number>();
    for (const r of rateRows) {
        rateMap.set(r.emp_code, r.PayRate || 0);
    }

    // Get premi
    const premiRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total_premi
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(EmpCode) IN (${empCodes})
          AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND (UPPER(t.DocDesc) LIKE '%PREMI%' OR UPPER(ln.TaskCode) LIKE '%PREMI%')
          AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
        GROUP BY RTRIM(EmpCode)
    `);

    const premiMap = new Map<string, number>();
    for (const r of premiRows) {
        premiMap.set(r.emp_code, r.total_premi || 0);
    }

    // Get potongan (PPH21, BPJS, SPSI, Koreksi)
    const potonganRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code, 
               SUM(CASE WHEN UPPER(t.DocDesc) LIKE '%PPH%' THEN ln.Amount ELSE 0 END) as pph21,
               SUM(CASE WHEN UPPER(t.DocDesc) LIKE '%BPJS%' THEN ln.Amount ELSE 0 END) as bpjs,
               SUM(CASE WHEN UPPER(t.DocDesc) LIKE '%SPSI%' THEN ln.Amount ELSE 0 END) as spsi,
               SUM(CASE WHEN UPPER(t.DocDesc) LIKE '%KOREKSI%' THEN ln.Amount ELSE 0 END) as koreksi,
               SUM(ln.Amount) as total_potongan
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(EmpCode) IN (${empCodes})
          AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND (UPPER(t.DocDesc) LIKE '%PPH%' OR UPPER(t.DocDesc) LIKE '%BPJS%' 
               OR UPPER(t.DocDesc) LIKE '%SPSI%' OR UPPER(t.DocDesc) LIKE '%KOREKSI%')
        GROUP BY RTRIM(EmpCode)
    `);

    const potonganMap = new Map<string, any>();
    for (const r of potonganRows) {
        potonganMap.set(r.emp_code, {
            pph21: Math.abs(r.pph21 || 0),
            bpjs: Math.abs(r.bpjs || 0),
            spsi: Math.abs(r.spsi || 0),
            koreksi: Math.abs(r.koreksi || 0),
            total: Math.abs(r.total_potongan || 0)
        });
    }

    // ===== Calculate live totals =====
    console.log(`\n=== EMPLOYEE BREAKDOWN (first 10): ===\n`);
    
    let liveTotalKotor = 0;
    let liveTotalPotongan = 0;
    let liveTotalBersih = 0;

    for (const emp of empRows.slice(0, 10)) {
        const upahDasar = rateMap.get(emp.emp_code) || 0;
        const hk = hkMap.get(emp.emp_code) || 0;
        const attendance = attendanceMap.get(emp.emp_code) || { minggu: 0, nasional: 0 };
        const effectiveHk = hk - (attendance.minggu + attendance.nasional);
        const gajiPokok = upahDasar * effectiveHk;
        const premi = premiMap.get(emp.emp_code) || 0;
        const potongan = potonganMap.get(emp.emp_code);
        const totalPotongan = potongan?.total || 0;
        const upahKotor = gajiPokok + premi; // Simplified
        const upahBersih = upahKotor - totalPotongan;

        console.log(`${emp.emp_code} (${emp.emp_name}):`);
        console.log(`  HK: ${hk}, Effective: ${effectiveHk}, Rate: ${upahDasar.toLocaleString('id-ID')}`);
        console.log(`  Gaji Pokok: ${gajiPokok.toLocaleString('id-ID')}`);
        console.log(`  Premi: ${premi.toLocaleString('id-ID')}`);
        console.log(`  Upah Kotor: ${upahKotor.toLocaleString('id-ID')}`);
        console.log(`  Potongan: ${totalPotongan.toLocaleString('id-ID')}`);
        console.log(`  Upah Bersih: ${upahBersih.toLocaleString('id-ID')}`);
        console.log();

        liveTotalKotor += upahKotor;
        liveTotalPotongan += totalPotongan;
        liveTotalBersih += upahBersih;
    }

    console.log(`\n=== LIVE TOTALS (first 10 employees): ===`);
    console.log(`upah_kotor: ${liveTotalKotor.toLocaleString('id-ID')}`);
    console.log(`potongan: ${liveTotalPotongan.toLocaleString('id-ID')}`);
    console.log(`upah_bersih: ${liveTotalBersih.toLocaleString('id-ID')}`);

    console.log(`\n=== STORED VS LIVE COMPARISON ===`);
    console.log(`Stored upah_bersih: ${(stored.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    console.log(`Calculated (first 10): ${liveTotalBersih.toLocaleString('id-ID')}`);
    console.log(`Note: Need to calculate ALL ${empRows.length} employees for full comparison`);
}

main().catch(console.error);
