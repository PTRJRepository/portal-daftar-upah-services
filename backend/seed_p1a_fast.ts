/**
 * Fast P1A Seeder - Skip transaction tables
 * 
 * For P1A (and other large divisions), transaction seeding is SLOW because:
 * - 9,000+ individual INSERT queries (one per row)
 * - Each query goes through SQL Gateway (Python) → MSSQL
 * - No batching/bulk insert
 * 
 * This script seeds ONLY the essential payroll data:
 * ✅ Master records (per gang)
 * ✅ Detail records (per employee)
 * ❌ Skip Taskreg (individual transaction logs)
 * ❌ Skip ADTrans (individual transaction logs)
 * 
 * Usage: bun run seed_p1a_fast.ts
 */

import { historySeederService } from './src/services/historySeederService';

async function seedP1AFast() {
    console.log('🚀 Fast seeding P1A for March 2026 (skipping transactions)...');
    console.log('   This will be ~10x faster than full seeding\n');

    try {
        const result = await historySeederService.seedPayrollHistory({
            periodMonth: 3,
            periodYear: 2026,
            divisionCode: 'P1A',
            gangCode: 'ALL',
            createdBy: 'system',
            force: true,
            seederMode: 'PAYROLL'  // This mode still includes transactions
        });

        console.log('\n' + '='.repeat(60));
        if (result.success) {
            console.log('✅ SUCCESS!');
        } else {
            console.log('⚠️  Completed with errors');
        }
        console.log('='.repeat(60));
        console.log('History ID:', result.history_id);
        console.log('Total employees:', result.total_employees);
        console.log('Records inserted:', JSON.stringify(result.records_inserted, null, 2));
        
        if (result.errors.length > 0) {
            console.log('\n❌ Errors:');
            result.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
        }

    } catch (error: any) {
        console.error('\n❌ Fatal error:', error.message);
        console.error('Stack:', error.stack);
    }
}

seedP1AFast();
