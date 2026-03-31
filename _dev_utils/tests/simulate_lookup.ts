import { Database } from "../../backend/src/db/client";

const db = Database.getExtendedInstance();
const mainDb = Database.getInstance();

/**
 * Simulate the EXACT lookup flow that dataExtractorService uses
 * for gang B2N, to verify FIKA HOIRI's THR appears
 */
async function simulateLookup() {
    const gangCode = 'B2N';
    const month = 3;
    const year = 2026;

    console.log(`\n=== SIMULATING dataExtractorService LOOKUP for gang ${gangCode} ===\n`);
    
    // Step 1: Get gang members (same as getEmployees with HR_GANGLN)
    console.log(`--- Step 1: Get gang members from HR_GANGLN ---`);
    const gangMembers = await mainDb.query(`
        SELECT DISTINCT
            RTRIM(e.EmpCode) as emp_code,
            e.NewICNo as actual_nik,
            e.EmpName as emp_name
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE UPPER(RTRIM(gl.GangCode)) = ?
        ORDER BY emp_code
    `, [gangCode]);
    
    console.log(`Found ${gangMembers.length} gang members:`);
    for (const m of gangMembers) {
        console.log(`  emp_code='${m.emp_code}', NIK='${m.actual_nik}', name='${m.emp_name}'`);
    }
    
    // Step 2: Get ALL other incomes (same as getRawIncomes without gang filter)
    console.log(`\n--- Step 2: Get THR records from employee_other_incomes ---`);
    const dbOtherIncomes = await db.query(`
        SELECT nik, emp_code, emp_name, amount, income_type, is_paid_in_thp, is_taxable
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ? AND income_type = 'THR'
    `, [year, month]);
    
    console.log(`Found ${dbOtherIncomes.length} THR records total`);
    
    // Step 3: Build maps (same as dataExtractorService lines 540-618)
    console.log(`\n--- Step 3: Build lookup maps ---`);
    const nikCount = new Map<string, number>();
    for (const inc of dbOtherIncomes) {
        const nik = String(inc.nik || '').trim().toUpperCase();
        if (nik) nikCount.set(nik, (nikCount.get(nik) || 0) + 1);
    }
    
    const dbThpMap = new Map<string, number>();
    const dbOtherByNik = new Map<string, any[]>();
    
    for (const inc of dbOtherIncomes) {
        const nik = String(inc.nik || '').trim().toUpperCase();
        const empCode = String(inc.emp_code || '').trim().toUpperCase();
        const entry = { type: inc.income_type, name: 'THR', amount: Number(inc.amount) };
        
        // Store by emp_code (Level 1)
        if (empCode) {
            dbThpMap.set(empCode, (dbThpMap.get(empCode) || 0) + Number(inc.amount));
        }
        // Store by NIK (Level 2)
        if (nik) {
            dbThpMap.set(nik, (dbThpMap.get(nik) || 0) + Number(inc.amount));
            if (!dbOtherByNik.has(nik)) dbOtherByNik.set(nik, []);
            dbOtherByNik.get(nik)!.push(entry);
        }
    }
    
    console.log(`dbThpMap size: ${dbThpMap.size}`);
    console.log(`dbOtherByNik size: ${dbOtherByNik.size}`);
    
    // Step 4: Simulate lookup per member (same as dataExtractorService lines 902-960)
    console.log(`\n--- Step 4: Lookup THR per gang member ---`);
    
    for (const emp of gangMembers) {
        const empNik = String(emp.actual_nik || '').trim().toUpperCase();
        const empCodeKey = String(emp.emp_code || '').trim().toUpperCase();
        
        let thrAmount = 0;
        let lookupMethod = 'NOT FOUND';
        
        // Level 1: NIK
        if (empNik && dbThpMap.has(empNik)) {
            thrAmount = dbThpMap.get(empNik)!;
            lookupMethod = 'NIK';
        }
        // Level 3: emp_code
        else if (empCodeKey && dbThpMap.has(empCodeKey)) {
            thrAmount = dbThpMap.get(empCodeKey)!;
            lookupMethod = 'EMP_CODE';
        }
        
        // Also check otherIncomes list
        const otherIncomes = dbOtherByNik.get(empNik) || [];
        const thrFromOI = otherIncomes.filter(oi => oi.type === 'THR').reduce((s: number, oi: any) => s + Number(oi.amount), 0);
        
        const status = thrAmount > 0 ? '✓' : '✗';
        console.log(`  ${status} emp_code='${empCodeKey}', NIK='${empNik}', name='${emp.emp_name}'`);
        console.log(`    → ThpMap: ${thrAmount} (via ${lookupMethod}), OtherIncomes THR: ${thrFromOI}`);
    }
}

simulateLookup().catch(console.error).finally(() => process.exit());
