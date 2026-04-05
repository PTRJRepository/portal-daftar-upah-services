import { Database } from "../../../src/db/client";

async function main() {
    const liveDb = Database.getInstance();
    const extDb = Database.getExtendedInstance();
    
    const gangCode = "C1M";
    const division = "P2A";
    const month = 3;
    const year = 2026;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month === 12 ? year + 1 : year}-${(month % 12) + 1}-01`;
    
    console.log(`=== DEBUGGING C1M upah_bersih ===\n`);
    console.log(`Expected: 121.365.822\n`);
    
    // ===== 1. Get current stored value =====
    const storedRow = await extDb.query<any>(`
        SELECT total_upah_bersih, total_upah_kotor, total_potongan, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (storedRow.length > 0) {
        console.log(`STORED IN AGGREGATION:`);
        console.log(`  total_employees: ${storedRow[0].total_employees}`);
        console.log(`  upah_kotor: ${(storedRow[0].total_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`  potongan: ${(storedRow[0].total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`  upah_bersih: ${(storedRow[0].total_upah_bersih || 0).toLocaleString('id-ID')}`);
    } else {
        console.log("❌ No stored aggregation found");
    }
    
    // ===== 2. Get actual C1M gang members from HR_GANGLN =====
    console.log(`\n📊 Fetching C1M gang members from HR_GANGLN...`);
    const members = await liveDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE g.GangCode = ?
        ORDER BY gl.GangMember
    `, [gangCode]);
    
    console.log(`Actual C1M members: ${members.length}\n`);
    
    if (members.length === 0) {
        console.log("❌ No gang members found!");
        return;
    }
    
    // ===== 3. Calculate from live PR_ADTRANS data =====
    const empCodes = members.map(m => `'${m.emp_code}'`).join(',');
    
    // Get all income items
    console.log(`\n📊 Fetching income data for each employee...\n`);
    
    let totalKotor = 0;
    let totalPotongan = 0;
    let totalBersih = 0;
    let activeCount = 0;
    
    // Get attendance/leave data
    const attRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code,
               COUNT(CASE WHEN UPPER(RTRIM(TaskCode)) NOT IN ('CUTI', 'SAKIT', 'ALFA', 'IZIN') 
                          AND TrxDate >= '${startDate}' AND TrxDate < '${endDate}' THEN 1 END) as hk
        FROM PR_TASKREGLN trl
        JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
        WHERE RTRIM(EmpCode) IN (${empCodes})
        GROUP BY RTRIM(EmpCode)
    `);
    
    const hkMap = new Map<string, number>();
    for (const r of attRows) {
        hkMap.set(r.emp_code, r.hk || 0);
    }
    
    // Get leave data
    const leaveRows = await liveDb.query<any>(`
        SELECT RTRIM(EmpCode) as emp_code,
               COUNT(CASE WHEN AttendanceType = 'MINGGU' OR UPPER(TaskCode) LIKE '%MINGGU%' THEN 1 END) as minggu,
               COUNT(CASE WHEN AttendanceType = 'NASIONAL' OR UPPER(TaskCode) LIKE '%NASIONAL%' THEN 1 END) as nasional,
               COUNT(CASE WHEN AttendanceType = 'TAHUNAN' OR UPPER(TaskCode) LIKE '%TAHUNAN%' THEN 1 END) as tahunan,
               COUNT(CASE WHEN AttendanceType = 'SAKIT' OR AttendanceType = 'HAID' THEN 1 END) as sakit
        FROM PR_ATTENDANCE
        WHERE RTRIM(EmpCode) IN (${empCodes})
          AND AttendanceDate >= '${startDate}' AND AttendanceDate < '${endDate}'
        GROUP BY RTRIM(EmpCode)
    `);
    
    const leaveMap = new Map<string, any>();
    for (const r of leaveRows) {
        leaveMap.set(r.emp_code, {
            minggu: r.minggu || 0,
            nasional: r.nasional || 0,
            tahunan: r.tahunan || 0,
            sakit: r.sakit || 0
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
    
    // Calculate income: gaji_pokok + tunjangan + premi + lembur
    const incomeRows = await liveDb.query<any>(`
        SELECT RTRIM(t.EmpCode) as emp_code,
               SUM(CASE WHEN UPPER(t.DocDesc) LIKE '%PREMI%' OR UPPER(t.DocDesc) LIKE '%BRONDOL%' 
                        OR UPPER(ln.TaskCode) LIKE '%PREMI%' THEN ln.Amount ELSE 0 END) as premi,
               SUM(CASE WHEN UPPER(t.DocDesc) LIKE '%PPH%' OR UPPER(t.DocDesc) LIKE '%BPJS%' 
                        OR UPPER(t.DocDesc) LIKE '%SPSI%' OR UPPER(t.DocDesc) LIKE '%KOREKSI%' 
                        OR UPPER(t.DocDesc) LIKE '%POT%' THEN ln.Amount ELSE 0 END) as potongan
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(t.EmpCode) IN (${empCodes})
          AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
          AND ln.Amount > 0
        GROUP BY RTRIM(t.EmpCode)
    `);
    
    const incomeMap = new Map<string, any>();
    for (const r of incomeRows) {
        incomeMap.set(r.emp_code, {
            premi: r.premi || 0,
            potongan: Math.abs(r.potongan || 0)
        });
    }
    
    console.log(`Employee calculations:\n`);
    console.log(`EmpCode | Name | HK | UpahDasar | GajiPokok | Premi | Potongan | UpahBersih`);
    console.log(`-`.repeat(110));
    
    for (const member of members) {
        const hk = hkMap.get(member.emp_code) || 0;
        const leave = leaveMap.get(member.emp_code) || { minggu: 0, nasional: 0, tahunan: 0, sakit: 0 };
        const rate = rateMap.get(member.emp_code) || 0;
        const income = incomeMap.get(member.emp_code) || { premi: 0, potongan: 0 };
        
        const totalCuti = leave.minggu + leave.nasional + leave.tahunan + leave.sakit;
        const hariKerja = Math.max(0, hk - totalCuti);
        
        // Filter: only include if hari_kerja > 0
        if (hariKerja <= 0) continue;
        
        const gajiPokok = rate * hariKerja;
        const upahKotor = gajiPokok + income.premi;
        const upahBersih = upahKotor - income.potongan;
        
        activeCount++;
        totalKotor += upahKotor;
        totalPotongan += income.potongan;
        totalBersih += upahBersih;
        
        console.log(`${member.emp_code} | ${member.emp_name.padEnd(25)} | ${hk.toString().padStart(3)} | ${rate.toLocaleString('id-ID').padStart(10)} | ${gajiPokok.toLocaleString('id-ID').padStart(12)} | ${income.premi.toLocaleString('id-ID').padStart(12)} | ${income.potongan.toLocaleString('id-ID').padStart(12)} | ${upahBersih.toLocaleString('id-ID')}`);
    }
    
    console.log(`\n${"=".repeat(110)}`);
    console.log(`Active employees (hari_kerja > 0): ${activeCount}`);
    console.log(`Calculated upah_kotor: ${totalKotor.toLocaleString('id-ID')}`);
    console.log(`Calculated potongan: ${totalPotongan.toLocaleString('id-ID')}`);
    console.log(`Calculated upah_bersih: ${totalBersih.toLocaleString('id-ID')}`);
    
    console.log(`\n=== COMPARISON ===`);
    console.log(`Expected upah_bersih: 121.365.822`);
    console.log(`Calculated upah_bersih: ${totalBersih.toLocaleString('id-ID')}`);
    console.log(`Difference: ${(totalBersih - 121365822).toLocaleString('id-ID')}`);
}

main().catch(console.error);
