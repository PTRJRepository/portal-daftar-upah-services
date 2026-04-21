/**
 * Check all PR_ADTRANS entries for employee B0073
 */

import { Database } from './src/db/client';

async function checkB0073Adtrans() {
    console.log('='.repeat(80));
    console.log('CHECKING PR_ADTRANS FOR B0073 - Period 3/2026');
    console.log('='.repeat(80));
    console.log('');

    const db = Database.getInstance();

    try {
        // Query all ADTRANS for B0073 - March 2026
        const query = `
            SELECT 
                EmpCode,
                DocDesc as TaskDesc,
                Amount,
                TrxDate
            FROM PR_ADTRANS
            WHERE EmpCode = 'B0073' 
                AND TrxDate >= '2026-03-01' AND TrxDate <= '2026-03-31'
            ORDER BY DocDesc
        `;
        
        const result = await db.query(query);
        
        if (!result.success || !result.data?.recordset?.length) {
            console.log('❌ No ADTRANS records found for B0073');
            return;
        }
        
        const records = result.data.recordset;
        console.log(`Found ${records.length} records:\n`);
        
        let totalAmount = 0;
        let totalsByCategory: {[key: string]: number} = {};
        
        records.forEach((record: any) => {
            const amount = record.Amount || 0;
            totalAmount += amount;
            
            // Categorize
            const taskDesc = record.TaskDesc || '';
            let category = 'OTHER';
            
            if (taskDesc.includes('BERAS')) category = 'BERAS';
            else if (taskDesc.includes('JABATAN')) category = 'JABATAN';
            else if (taskDesc.includes('MASA KERJA')) category = 'MASA_KERJA';
            else if (taskDesc.includes('PREMI')) category = 'PREMI';
            else if (taskDesc.includes('KOREKSI')) category = 'KOREKSI';
            else if (taskDesc.includes('LEMBUR')) category = 'LEMBUR';
            else if (taskDesc.includes('TUNJANGAN')) category = 'TUNJANGAN';
            else if (taskDesc.includes('PAJAK') || taskDesc.includes('PPH')) category = 'PAJAK';
            else if (taskDesc.includes('THR')) category = 'THR';
            else if (taskDesc.includes('BONUS')) category = 'BONUS';
            
            if (!totalsByCategory[category]) totalsByCategory[category] = 0;
            totalsByCategory[category] += amount;
            
            console.log(`  ${taskDesc.padEnd(50)} | ${amount.toLocaleString('id-ID').padStart(12)} | Month: ${record.PeriodMonth || record.AccMonth}`);
        });
        
        console.log('');
        console.log('='.repeat(80));
        console.log('TOTALS BY CATEGORY:');
        console.log('='.repeat(80));
        
        for (const [category, amount] of Object.entries(totalsByCategory)) {
            console.log(`  ${category.padEnd(20)}: ${amount.toLocaleString('id-ID')}`);
        }
        
        console.log('-'.repeat(80));
        console.log(`  TOTAL ALL         : ${totalAmount.toLocaleString('id-ID')}`);
        console.log('='.repeat(80));
        console.log('');
        
        // Check for any unusual amounts
        if (totalsByCategory['TUNJANGAN'] || totalsByCategory['OTHER']) {
            console.log('⚠️  Found TUNJANGAN or OTHER categories - checking details:');
            records.filter((r: any) => {
                const desc = r.TaskDesc || '';
                return desc.includes('TUNJANGAN') || 
                       (!desc.includes('BERAS') && !desc.includes('JABATAN') && !desc.includes('MASA KERJA') && 
                        !desc.includes('PREMI') && !desc.includes('KOREKSI') && !desc.includes('PAJAK'));
            }).forEach((r: any) => {
                console.log(`  ${r.TaskDesc}: ${r.Amount}`);
            });
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
        }
    }
}

checkB0073Adtrans().then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
});
