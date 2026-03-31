import { Database } from "../../backend/src/db/client";

const db = Database.getExtendedInstance();
const mainDb = Database.getInstance();

async function diagnose() {
    const testNik = '1902041110990001';
    
    console.log(`\n=== DIAGNOSE THR MATCHING ===`);
    console.log(`Target NIK: ${testNik}\n`);
    
    // Step 1: Cek data THR di employee_other_incomes
    console.log(`--- STEP 1: Cek employee_other_incomes ---`);
    const thrRecords = await db.query(
        `SELECT id, nik, emp_code, emp_name, amount, income_type, division_code, gang_code, period_month, period_year
         FROM employee_other_incomes WHERE nik = ? AND income_type = 'THR'`, [testNik]);
    
    if (thrRecords.length > 0) {
        console.log(`FOUND ${thrRecords.length} THR record(s):`);
        for (const r of thrRecords) {
            console.log(`  emp_code='${r.emp_code}', nama='${r.emp_name}', amount=${r.amount}, div='${r.division_code}', gang='${r.gang_code}', period=${r.period_month}/${r.period_year}`);
        }
    } else {
        console.log(`NO THR records found for NIK ${testNik}`);
    }
    
    // Step 2: Cek HR_EMPLOYEE
    console.log(`\n--- STEP 2: Cek HR_EMPLOYEE ---`);
    const hrEmpRows = await mainDb.query(
        `SELECT RTRIM(EmpCode) as EmpCode, RTRIM(EmpName) as EmpName, RTRIM(NewICNo) as NewICNo, Status, CreateDate
         FROM HR_EMPLOYEE WHERE RTRIM(NewICNo) = ? ORDER BY CreateDate DESC`, [testNik]);
    
    if (hrEmpRows.length > 0) {
        console.log(`FOUND ${hrEmpRows.length} HR_EMPLOYEE record(s):`);
        for (const r of hrEmpRows) {
            console.log(`  EmpCode='${r.EmpCode}', Name='${r.EmpName}', NIK='${r.NewICNo}', Status=${r.Status}`);
        }
    } else {
        console.log(`NO HR_EMPLOYEE records found for NIK ${testNik}`);
    }
    
    // Step 3: Cek HR_GANGLN
    console.log(`\n--- STEP 3: Cek HR_GANGLN ---`);
    for (const emp of hrEmpRows) {
        const gangRows = await mainDb.query(
            `SELECT RTRIM(GangCode) as GangCode, RTRIM(GangMember) as GangMember
             FROM HR_GANGLN WHERE RTRIM(GangMember) = ?`, [emp.EmpCode]);
        
        if (gangRows.length > 0) {
            for (const g of gangRows) {
                console.log(`  EmpCode='${emp.EmpCode}' => Gang='${g.GangCode}', Member='${g.GangMember}'`);
            }
        } else {
            console.log(`  EmpCode='${emp.EmpCode}' => NOT IN ANY GANG`);
        }
    }
    
    // Step 5: BROADER CHECK
    console.log(`\n\n=== BROADER CHECK: All gang members Islam tanpa THR ===`);
    
    const allThrNiks = await db.query(
        `SELECT DISTINCT nik FROM employee_other_incomes WHERE income_type = 'THR' AND period_year = 2026 AND period_month = 3`);
    const thrNikSet = new Set(allThrNiks.map((r: any) => String(r.nik || '').trim().toUpperCase()));
    console.log(`Total THR NIKs in database: ${thrNikSet.size}`);

    const allThrEmpCodes = await db.query(
        `SELECT DISTINCT emp_code FROM employee_other_incomes WHERE income_type = 'THR' AND period_year = 2026 AND period_month = 3 AND emp_code IS NOT NULL AND emp_code != ''`);
    const thrEmpCodeSet = new Set(allThrEmpCodes.map((r: any) => String(r.emp_code || '').trim().toUpperCase()));
    console.log(`Total THR emp_codes in database: ${thrEmpCodeSet.size}`);
    
    // Join HR_GANGLN with HR_EMPLOYEE to get NIK (NewICNo)
    const allGangMembers = await mainDb.query(`
        SELECT RTRIM(gl.GangCode) as GangCode, RTRIM(gl.GangMember) as GangMember, 
               RTRIM(e.NewICNo) as ActualNIK, RTRIM(e.EmpName) as EmpName,
               e.Religion
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
    `);
    
    console.log(`Total gang members (with HR_EMPLOYEE): ${allGangMembers.length}`);
    
    let missing = 0;
    let found = 0;
    let foundByEmpCode = 0;
    let foundByNik = 0;
    const missingList: any[] = [];
    
    for (const m of allGangMembers) {
        const nik = String(m.ActualNIK || '').trim().toUpperCase();
        const empCode = String(m.GangMember || '').trim().toUpperCase();
        const religion = String(m.Religion || '').trim().toUpperCase();
        const isMuslim = religion === 'ISLAM' || religion === '01' || religion === '1' || religion.includes('ISLAM');
        
        if (!isMuslim) continue;
        
        // Try emp_code first (simple path for non-transferred)
        if (thrEmpCodeSet.has(empCode)) {
            found++;
            foundByEmpCode++;
            continue;
        }
        
        // Try NIK (fallback for transferred employees)
        if (nik && thrNikSet.has(nik)) {
            found++;
            foundByNik++;
            continue;
        }
        
        if (!nik) {
            missingList.push({ gang: m.GangCode, empCode, nik: '(EMPTY)', name: m.EmpName, reason: 'NIK EMPTY in HR_EMPLOYEE' });
        } else {
            missingList.push({ gang: m.GangCode, empCode, nik, name: m.EmpName, reason: 'NIK NOT IN THR DB' });
        }
        missing++;
    }
    
    console.log(`\nMuslim with THR: ${found} (by EmpCode: ${foundByEmpCode}, by NIK: ${foundByNik})`);
    console.log(`Muslim without THR: ${missing}`);
    
    if (missingList.length > 0) {
        console.log(`\nMissing list (ALL ${missingList.length}):`);
        const byGang: Record<string, any[]> = {};
        for (const m of missingList) {
            if (!byGang[m.gang]) byGang[m.gang] = [];
            byGang[m.gang].push(m);
        }
        for (const [gang, members] of Object.entries(byGang)) {
            console.log(`\n  Gang ${gang} (${members.length} missing):`);
            for (const m of members) {
                console.log(`    EmpCode='${m.empCode}', NIK='${m.nik}', Name='${m.name}', Reason='${m.reason}'`);
            }
        }
    }
}

diagnose().catch(console.error).finally(() => process.exit());
