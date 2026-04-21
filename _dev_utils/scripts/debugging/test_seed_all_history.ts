/**
 * Test script to seed payroll history for ALL divisions
 * Usage: bun run backend/src/scripts/test_seed_all_history.ts
 */

import { Database } from "../db/client";
import { historySeederService, SeederOptions } from "../services/historySeederService";

async function seedAllDivisions() {
    const periodMonth = 3;  // March 2026
    const periodYear = 2026;

    console.log(`[Test] Starting payroll history seeder for ALL divisions`);
    console.log(`[Test] Period: ${periodMonth}/${periodYear}`);
    console.log(`[Test] =============================================`);

    const options: SeederOptions = {
        periodMonth,
        periodYear,
        divisionCode: 'ALL',  // Process all divisions
        gangCode: 'ALL',      // All gangs
        force: true,
        seederMode: 'PAYROLL',
        createdBy: 'test-script',
        ipAddress: 'localhost',
        userAgent: 'test-script'
    };

    const startTime = Date.now();

    try {
        const result = await historySeederService.seedPayrollHistory(options);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n[Test] =============================================`);
        console.log(`[Test] ✅ Seeding completed in ${totalTime}s`);
        console.log(`[Test] Success: ${result.success}`);
        console.log(`[Test] History ID: ${result.history_id}`);
        console.log(`[Test] Total Employees: ${result.total_employees}`);
        console.log(`[Test] Records Inserted:`);
        console.log(`[Test]   - Master: ${result.records_inserted.master}`);
        console.log(`[Test]   - Detail: ${result.records_inserted.detail}`);
        console.log(`[Test]   - Taskreg: ${result.records_inserted.taskreg}`);
        console.log(`[Test]   - Adtrans: ${result.records_inserted.adtrans}`);
        console.log(`[Test]   - Gang Member: ${result.records_inserted.gang_member}`);
        console.log(`[Test]   - HR Employee: ${result.records_inserted.hr_employee}`);
        console.log(`[Test]   - HR Gang: ${result.records_inserted.hr_gang}`);

        if (result.errors.length > 0) {
            console.log(`[Test] ❌ Errors:`);
            result.errors.forEach((err, i) => console.log(`[Test]   ${i + 1}. ${err}`));
        } else {
            console.log(`[Test] ✅ No errors!`);
        }

    } catch (error: any) {
        console.error(`[Test] ❌ Fatal error:`, error.message);
        console.error(`[Test] Stack:`, error.stack);
    }
}

seedAllDivisions().catch(console.error);