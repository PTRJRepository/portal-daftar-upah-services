/**
 * Quick test to verify employee_other_incomes data exists for month 3, year 2026
 */

import { Database } from '../../src/services/database';

async function main() {
    const db = Database.getExtendedInstance();
    
    console.log('=== TEST: employee_other_incomes for March 2026 ===\n');
    
    // 1. Check how many records exist
    const countResult = await db.query<any>(`
        SELECT COUNT(*) as cnt, income_type, 
               SUM(CAST(amount AS FLOAT)) as total_amount
        FROM employee_other_incomes 
        WHERE period_year = 2026 AND period_month = 3
        GROUP BY income_type
    `);
    
    console.log('Record counts by income_type for 2026/3:');
    if (countResult.length === 0) {
        console.log('  ❌ NO RECORDS FOUND! This is the root cause.');
    } else {
        for (const r of countResult) {
            console.log(`  ${r.income_type}: ${r.cnt} records, total: Rp ${Number(r.total_amount).toLocaleString()}`);
        }
    }
    
    // 2. Check sample records
    const sampleRows = await db.query<any>(`
        SELECT TOP 10 id, nik, emp_code, emp_name, income_type, amount, division_code, gang_code
        FROM employee_other_incomes 
        WHERE period_year = 2026 AND period_month = 3
        ORDER BY id
    `);
    
    console.log('\nSample records (first 10):');
    for (const r of sampleRows) {
        console.log(`  id=${r.id}, nik="${r.nik}", emp_code="${r.emp_code}", name="${r.emp_name}", type=${r.income_type}, amount=${r.amount}, gang=${r.gang_code}`);
    }
    
    // 3. Also check month 2 for comparison
    const month2Count = await db.query<any>(`
        SELECT COUNT(*) as cnt, income_type
        FROM employee_other_incomes 
        WHERE period_year = 2026 AND period_month = 2
        GROUP BY income_type
    `);
    
    console.log('\nRecord counts for 2026/2:');
    if (month2Count.length === 0) {
        console.log('  No records in month 2');
    } else {
        for (const r of month2Count) {
            console.log(`  ${r.income_type}: ${r.cnt} records`);
        }
    }
    
    // 4. Check if nik/emp_code values match HR_EMPLOYEE 
    if (sampleRows.length > 0) {
        const mainDb = Database.getInstance();
        const sampleNiks = sampleRows.slice(0, 5).map((r: any) => r.nik?.trim()).filter(Boolean);
        
        console.log('\n=== KEY MATCH VERIFICATION ===');
        
        for (const nik of sampleNiks) {
            const hrResult = await mainDb.query<any>(`
                SELECT RTRIM(EmpCode) as EmpCode, RTRIM(NewICNo) as NewICNo, RTRIM(EmpName) as EmpName
                FROM HR_EMPLOYEE 
                WHERE RTRIM(NewICNo) = ? OR RTRIM(EmpCode) = ?
            `, [nik, nik]);
            
            if (hrResult.length > 0) {
                console.log(`  NIK "${nik}" => HR: EmpCode=${hrResult[0].EmpCode}, NewICNo=${hrResult[0].NewICNo}`);
            } else {
                console.log(`  NIK "${nik}" => ❌ NOT FOUND in HR_EMPLOYEE`);
            }
        }
    }
    
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
