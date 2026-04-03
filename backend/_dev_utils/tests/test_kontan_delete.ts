/**
 * TEST: KONTAN Delete via manualAdjustmentService
 *
 * Simulates the full flow:
 * 1. Insert KONTAN record (amount > 0)
 * 2. Verify record exists
 * 3. Delete by setting amount = 0
 * 4. Verify record is gone
 */
import { Database } from '../../src/db/client';
import { manualAdjustmentService } from '../../src/services/manualAdjustmentService';
import { currentPeriodService } from '../../src/services/currentPeriodService';

const extDb = Database.getExtendedInstance();

const lines: string[] = [];
function log(msg: string) {
    console.log(msg);
    lines.push(msg);
}

async function run() {
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;

    log(`\n========== KONTAN DELETE TEST ==========`);
    log(`Period: ${month}/${year}`);
    log(`Time: ${new Date().toISOString()}`);

    // =========================================================
    // STEP 1: Find an existing KONTAN record to test with
    // =========================================================
    log(`\n--- STEP 1: Find existing KONTAN record ---`);

    // First, let's find any KONTAN record from any period we can reuse
    const existingKontan = await extDb.queryOne<any>(`
        SELECT TOP 1 id, nik, emp_code, emp_name, income_type, income_name, amount,
               period_year, period_month, gang_code, division_code
        FROM employee_other_incomes
        WHERE income_type = 'KONTAN'
          AND (period_year < ? OR (period_year = ? AND period_month < ?))
        ORDER BY period_year DESC, period_month DESC
    `, [year, year, month]);

    if (!existingKontan) {
        log(`No existing KONTAN found from previous periods.`);
        log(`Checking for KONTAN in current period (${month}/${year})...`);

        const currentKontan = await extDb.queryOne<any>(`
            SELECT TOP 1 id, nik, emp_code, emp_name, income_type, income_name, amount,
                   period_year, period_month, gang_code, division_code
            FROM employee_other_incomes
            WHERE income_type = 'KONTAN'
              AND period_year = ? AND period_month = ?
        `, [year, month]);

        if (!currentKontan) {
            log(`ERROR: No KONTAN records found at all in employee_other_incomes!`);
            log(`Cannot test. Please insert some KONTAN data first.`);
            log(`\n========== TEST ABORTED ==========`);
            process.exit(1);
        }
        log(`Found KONTAN in current period: emp_code=${currentKontan.emp_code}, amount=${currentKontan.amount}, id=${currentKontan.id}`);
        log(`Will use this for delete test...`);

        // Use this existing record for testing
        const testNik = currentKontan.nik?.trim() || currentKontan.emp_code?.trim() || 'TEST999';
        const testEmpCode = currentKontan.emp_code?.trim() || 'TEST999';
        const testGang = currentKontan.gang_code || 'H1H';
        const testDivision = currentKontan.division_code || 'PG1A';

        // =========================================================
        // STEP 2: Verify record exists BEFORE delete
        // =========================================================
        log(`\n--- STEP 2: Verify record exists BEFORE delete ---`);
        const beforeDelete = await extDb.queryOne<any>(`
            SELECT id, nik, emp_code, income_name, amount
            FROM employee_other_incomes
            WHERE (nik = ? OR nik = ?) AND income_type = 'KONTAN'
              AND period_year = ? AND period_month = ?
        `, [testNik, testEmpCode, year, month]);

        if (!beforeDelete) {
            log(`ERROR: Record not found before delete! emp_code=${testEmpCode}, nik=${testNik}`);
            process.exit(1);
        }
        log(`✅ Record EXISTS: id=${beforeDelete.id}, nik="${beforeDelete.nik}", emp_code="${beforeDelete.emp_code}", amount=${beforeDelete.amount}`);

        // =========================================================
        // STEP 3: DELETE via manualAdjustmentService (amount = 0)
        // =========================================================
        log(`\n--- STEP 3: DELETE via manualAdjustmentService (amount = 0) ---`);

        log(`Calling saveAdjustment with amount=0...`);
        const payload = {
            period_month: month,
            period_year: year,
            nik: testNik,
            emp_code: testEmpCode,
            gang_code: testGang,
            division_code: testDivision,
            adjustment_type: 'PENDAPATAN_LAINNYA',
            adjustment_name: 'KONTAN',
            amount: 0, // THIS IS THE KEY TEST: amount = 0 should DELETE
            remarks: 'TEST: Deleting KONTAN via unit test'
        };

        log(`Payload: ${JSON.stringify({
            ...payload,
            amount: payload.amount
        })}`);

        try {
            const resultId = await manualAdjustmentService.saveAdjustment(payload, 'test-user');
            log(`saveAdjustment returned id: ${resultId}`);
        } catch (err: any) {
            log(`ERROR during saveAdjustment: ${err.message}`);
            log(`${err.stack}`);
        }

        // =========================================================
        // STEP 4: Verify record is DELETED
        // =========================================================
        log(`\n--- STEP 4: Verify record is DELETED ---`);
        const afterDelete = await extDb.queryOne<any>(`
            SELECT id, nik, emp_code, income_name, amount
            FROM employee_other_incomes
            WHERE (nik = ? OR nik = ?) AND income_type = 'KONTAN'
              AND period_year = ? AND period_month = ?
        `, [testNik, testEmpCode, year, month]);

        if (afterDelete) {
            log(`❌ FAIL: Record STILL EXISTS after delete!`);
            log(`   id=${afterDelete.id}, nik="${afterDelete.nik}", emp_code="${afterDelete.emp_code}", amount=${afterDelete.amount}`);
            log(`\n========== TEST FAILED ==========`);
            process.exit(1);
        } else {
            log(`✅ PASS: Record successfully DELETED!`);
            log(`   No KONTAN record found for nik="${testNik}" / emp_code="${testEmpCode}"`);
        }

        // =========================================================
        // STEP 5: Re-insert for data recovery
        // =========================================================
        log(`\n--- STEP 5: Re-insert original record for data recovery ---`);
        const insertResult = await extDb.query(`
            INSERT INTO employee_other_incomes (
                nik, emp_code, emp_name, division_code, gang_code,
                period_year, period_month, income_type, income_name,
                amount, is_paid_in_thp, is_taxable,
                created_at, updated_at
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
            )
        `, [
            testNik,
            testEmpCode,
            currentKontan.emp_name || null,
            testDivision,
            testGang,
            year,
            month,
            'KONTAN',
            'KONTAN',
            currentKontan.amount,
            0,
            0
        ]);

        const newId = insertResult[0]?.id;
        log(`✅ Re-inserted: id=${newId}, nik="${testNik}", emp_code="${testEmpCode}", amount=${currentKontan.amount}`);

        // Verify re-insert
        const afterReinsert = await extDb.queryOne<any>(`
            SELECT id, nik, emp_code, amount FROM employee_other_incomes
            WHERE id = ?
        `, [newId]);
        if (afterReinsert) {
            log(`✅ VERIFIED: Record restored with id=${afterReinsert.id}, amount=${afterReinsert.amount}`);
        }

    } else {
        // Use an old period record for testing
        log(`Found KONTAN from ${existingKontan.period_month}/${existingKontan.period_year}: emp_code=${existingKontan.emp_code}, amount=${existingKontan.amount}`);
        log(`Will test on CURRENT period ${month}/${year} instead...`);

        // Insert a test record in current period
        const testNik = existingKontan.nik?.trim() || existingKontan.emp_code?.trim() || 'TEST999';
        const testEmpCode = existingKontan.emp_code?.trim() || 'TEST999';
        const testGang = 'H1H';
        const testDivision = 'PG1A';
        const testAmount = 99999;

        log(`\n--- Inserting test record ---`);
        const insertResult = await extDb.query(`
            INSERT INTO employee_other_incomes (
                nik, emp_code, emp_name, division_code, gang_code,
                period_year, period_month, income_type, income_name,
                amount, is_paid_in_thp, is_taxable,
                created_at, updated_at
            ) OUTPUT INSERTED.id VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE()
            )
        `, [
            testNik,
            testEmpCode,
            existingKontan.emp_name || 'TEST EMPLOYEE',
            testDivision,
            testGang,
            year,
            month,
            'KONTAN',
            'KONTAN',
            testAmount,
            0,
            0
        ]);

        const testId = insertResult[0]?.id;
        log(`Inserted test record: id=${testId}, nik="${testNik}", emp_code="${testEmpCode}", amount=${testAmount}`);

        // Verify exists
        const verifyInsert = await extDb.queryOne<any>(`
            SELECT id, nik, emp_code, amount FROM employee_other_incomes WHERE id = ?
        `, [testId]);
        if (!verifyInsert) {
            log(`ERROR: Insert failed!`);
            process.exit(1);
        }
        log(`✅ Verified insert: id=${verifyInsert.id}, amount=${verifyInsert.amount}`);

        // TEST: Delete by setting amount = 0
        log(`\n--- Testing DELETE by amount = 0 ---`);
        log(`Calling saveAdjustment with amount=0...`);
        try {
            const resultId = await manualAdjustmentService.saveAdjustment({
                period_month: month,
                period_year: year,
                nik: testNik,
                emp_code: testEmpCode,
                gang_code: testGang,
                division_code: testDivision,
                adjustment_type: 'PENDAPATAN_LAINNYA',
                adjustment_name: 'KONTAN',
                amount: 0,
                remarks: 'TEST: Deleting KONTAN via unit test'
            }, 'test-user');
            log(`saveAdjustment returned id: ${resultId}`);
        } catch (err: any) {
            log(`ERROR during saveAdjustment: ${err.message}`);
            log(`${err.stack}`);
        }

        // Verify deleted
        log(`\n--- Verifying deletion ---`);
        const afterDelete = await extDb.queryOne<any>(`
            SELECT id, nik, emp_code, amount FROM employee_other_incomes
            WHERE id = ?
        `, [testId]);

        if (afterDelete) {
            log(`❌ FAIL: Record STILL EXISTS after delete!`);
            log(`   id=${afterDelete.id}, amount=${afterDelete.amount}`);
            log(`\n========== TEST FAILED ==========`);
            process.exit(1);
        } else {
            log(`✅ PASS: Record successfully DELETED!`);
            log(`   No record found for id=${testId}`);
        }
    }

    log(`\n========== ALL TESTS PASSED ==========`);

    process.exit(0);
}

run().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
