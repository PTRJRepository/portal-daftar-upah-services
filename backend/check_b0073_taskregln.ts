/**
 * Check PR_TASKREGLN for employee B0073 to find missing 450,000 in gaji_pokok
 */

import { Database } from './src/db/client';

async function checkB0073TaskRegln() {
    console.log('='.repeat(80));
    console.log('CHECKING PR_TASKREGLN FOR B0073 - March 2026');
    console.log('='.repeat(80));
    console.log('');

    const db = Database.getInstance();

    try {
        // Query BOTH live and archive PR_TASKREGLN records for B0073
        // First try without date filter to see if data exists
        const query = `
            SELECT TOP 50
                RTRIM(trl.EmpCode) as emp_code,
                trl.TrxDate,
                trl.Hours,
                trl.Amount,
                trl.OT,
                trl.TaskCode
            FROM PR_TASKREGLN trl
            WHERE RTRIM(trl.EmpCode) = 'B0073'
            
            UNION ALL
            
            SELECT TOP 50
                RTRIM(trl.EmpCode) as emp_code,
                trl.TrxDate,
                trl.Hours,
                trl.Amount,
                trl.OT,
                trl.TaskCode
            FROM PR_TASKREGLN_ARC trl
            WHERE RTRIM(trl.EmpCode) = 'B0073'
        `;
        
        const result = await db.query(query);
        
        if (!result.success || !result.data?.recordset?.length) {
            console.log('❌ No PR_TASKREGLN records found for B0073 in March 2026');
            return;
        }
        
        const records = result.data.recordset;
        console.log(`Found ${records.length} records:\n`);
        
        let totalAmountAll = 0;
        let totalAmountOT0 = 0;
        let totalAmountOT1 = 0;
        let totalAmountOther = 0;
        let countOT0 = 0;
        let countOT1 = 0;
        let countOther = 0;
        
        records.forEach((record: any) => {
            const amount = record.Amount || 0;
            const ot = record.OT;
            const date = record.TrxDate ? new Date(record.TrxDate).toLocaleDateString('id-ID') : 'N/A';
            const dayName = record.day_name || '';
            const taskCode = record.TaskCode || '';
            const taskDesc = record.TaskDesc || '';
            
            totalAmountAll += amount;
            
            let otCategory = '';
            if (ot === 0) {
                totalAmountOT0 += amount;
                countOT0++;
                otCategory = 'OT=0 (Regular)';
            } else if (ot === 1) {
                totalAmountOT1 += amount;
                countOT1++;
                otCategory = 'OT=1 (Overtime)';
            } else {
                totalAmountOther += amount;
                countOther++;
                otCategory = `OT=${ot} (Other)`;
            }
            
            console.log(`  ${date.padEnd(12)} | OT=${ot} ${otCategory.padEnd(25)} | Amount: ${amount.toLocaleString('id-ID').padStart(12)} | Hrs: ${record.Hours}`);
        });
        
        console.log('');
        console.log('='.repeat(80));
        console.log('SUMMARY BY OT CATEGORY:');
        console.log('='.repeat(80));
        console.log(`  OT=0 (Regular)    : ${countOT0.toString().padStart(3)} records | Total: ${totalAmountOT0.toLocaleString('id-ID').padStart(12)}`);
        console.log(`  OT=1 (Overtime)   : ${countOT1.toString().padStart(3)} records | Total: ${totalAmountOT1.toLocaleString('id-ID').padStart(12)}`);
        if (countOther > 0) {
            console.log(`  OT=Other          : ${countOther.toString().padStart(3)} records | Total: ${totalAmountOther.toLocaleString('id-ID').padStart(12)}`);
        }
        console.log('-'.repeat(80));
        console.log(`  ALL RECORDS       : ${records.length.toString().padStart(3)} records | Total: ${totalAmountAll.toLocaleString('id-ID').padStart(12)}`);
        console.log('='.repeat(80));
        console.log('');
        
        console.log('ANALYSIS:');
        console.log(`  Current gaji_pokok_aktual (OT=0 only): ${totalAmountOT0.toLocaleString('id-ID')}`);
        console.log(`  Expected gaji_pokok_aktual: 4,619,500`);
        console.log(`  Missing amount: ${(4619500 - totalAmountOT0).toLocaleString('id-ID')}`);
        console.log('');
        
        if (totalAmountOT1 > 0 || totalAmountOther > 0) {
            console.log('⚠️  FOUND ADDITIONAL AMOUNTS!');
            console.log(`  OT=1 amount: ${totalAmountOT1.toLocaleString('id-ID')}`);
            if (totalAmountOther > 0) {
                console.log(`  OT=Other amount: ${totalAmountOther.toLocaleString('id-ID')}`);
            }
            console.log('');
            console.log('These amounts are NOT included in gaji_pokok_aktual because the query filters OT=0 only.');
            console.log('If any of these should be included, the getAttendance() query needs to be fixed.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
        }
    }
}

checkB0073TaskRegln().then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
});
