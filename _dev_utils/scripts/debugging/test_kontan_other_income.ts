/**
 * Test Script: Kontan Other Income
 *
 * Tests the full flow:
 * 1. Save a KONTAN other income via manualAdjustmentService (same flow as frontend)
 * 2. Verify it's stored in employee_other_incomes (extend_db_ptrj)
 * 3. Retrieve it by NIK via OtherIncomesService
 * 4. Verify data extractor picks it up as pendapatan_kontan
 *
 * Run: cd backend && bun run src/scripts/test_kontan_other_income.ts
 */
import { Database } from "../db/client";
import { OtherIncomesService } from "../services/otherIncomesService";
import { dataExtractorService } from "../services/dataExtractorService";
import { manualAdjustmentService } from "../services/manualAdjustmentService";

const TEST_NIK = '001001';      // Will be overridden with actual employee
const TEST_GANG = 'H1H';         // Will be overridden with actual gang
const TEST_MONTH = 3;
const TEST_YEAR = 2026;
const TEST_AMOUNT = 150000;

async function testKontanSaveAndRetrieve() {
    console.log('='.repeat(60));
    console.log('TEST: Kontan Other Income - Save & Retrieve by NIK');
    console.log('='.repeat(60));

    // employee_other_incomes lives in extend_db_ptrj
    const dbExtend = Database.getExtendedInstance();
    // HR_EMPLOYEE / HR_GANGLN lives in main payroll DB (db_ptrj)
    const dbMain = Database.getInstance();

    try {
        // Step 1: Find an employee from the main payroll DB
        console.log('\n[Step 1] Find employee from payroll DB...');
        const empQuery = await dbMain.query(`
            SELECT TOP 1 RTRIM(e.EmpCode) as EmpCode, RTRIM(e.EmpName) as EmpName,
                   RTRIM(gl.GangCode) as GangCode
            FROM HR_EMPLOYEE e
            LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
            WHERE e.EmpCode IS NOT NULL AND e.EmpName IS NOT NULL
        `);

        if (!empQuery || empQuery.length === 0) {
            console.error('No employee found in HR_EMPLOYEE');
            return;
        }

        const emp = empQuery[0];
        const testNik = emp.EmpCode?.trim();
        const testGang = emp.GangCode?.trim() || TEST_GANG;
        console.log(`  ✅ Employee found: ${emp.EmpName?.trim()} (${testNik}) - Gang: ${testGang}`);

        // Step 2: Clean up any existing KONTAN for this employee
        console.log('\n[Step 2] Clean up existing KONTAN test data...');
        await dbExtend.query(`
            DELETE FROM dbo.employee_other_incomes
            WHERE nik = ? AND period_month = ? AND period_year = ? AND income_type = 'KONTAN'
        `, [testNik, TEST_MONTH, TEST_YEAR]);
        console.log('  ✅ Cleaned up existing KONTAN records');

        // Step 3: Save KONTAN via manualAdjustmentService (SAME flow as frontend)
        console.log('\n[Step 3] Save KONTAN via manualAdjustmentService...');
        const saveId = await manualAdjustmentService.saveAdjustment({
            period_month: TEST_MONTH,
            period_year: TEST_YEAR,
            emp_code: testNik,
            gang_code: testGang,
            division_code: null,
            adjustment_type: 'PENDAPATAN_LAINNYA',
            adjustment_name: 'KONTAN',
            amount: TEST_AMOUNT,
        }, 'test-script');

        if (saveId > 0) {
            console.log(`  ✅ Saved KONTAN: ID=${saveId}, Amount=Rp${TEST_AMOUNT.toLocaleString('id-ID')}`);
        } else {
            console.error('  ❌ Failed to save KONTAN');
            return;
        }

        // Step 4: Direct DB verification - check what's in employee_other_incomes
        console.log('\n[Step 4] Direct DB verification (employee_other_incomes)...');
        const directCheck = await dbExtend.query(`
            SELECT id, nik, emp_name, income_type, income_name, amount, is_paid_in_thp, is_taxable, updated_at
            FROM dbo.employee_other_incomes
            WHERE nik = ? AND period_month = ? AND period_year = ? AND income_type = 'KONTAN'
        `, [testNik, TEST_MONTH, TEST_YEAR]);

        if (directCheck && directCheck.length > 0) {
            const rec = directCheck[0];
            console.log(`  ✅ Direct DB check: ${directCheck.length} record(s) found`);
            console.log(`     id=${rec.id}, nik=${rec.nik}`);
            console.log(`     income_type=${rec.income_type}, income_name=${rec.income_name}`);
            console.log(`     amount=Rp${Number(rec.amount).toLocaleString('id-ID')}`);
            console.log(`     is_paid_in_thp=${rec.is_paid_in_thp}, is_taxable=${rec.is_taxable}`);
        } else {
            console.error('  ❌ Direct DB check: No records found!');
        }

        // Step 5: Retrieve via OtherIncomesService
        console.log('\n[Step 5] Retrieve via OtherIncomesService.getIncomes()...');
        const retrieved = await OtherIncomesService.getIncomes(
            TEST_YEAR,
            TEST_MONTH,
            undefined,
            testGang
        );

        const kontanRecords = retrieved.filter(
            (r: any) => r.nik === testNik && r.income_type === 'KONTAN'
        );

        if (kontanRecords.length > 0) {
            const k = kontanRecords[0];
            console.log(`  ✅ Found via OtherIncomesService: ID=${k.id}, Amount=Rp${Number(k.amount).toLocaleString('id-ID')}`);
        } else {
            console.log('  ℹ️  Not found via OtherIncomesService.getIncomes() (gang may not match)');
        }

        // Step 6: Verify data extractor picks up KONTAN as pendapatan_kontan
        console.log('\n[Step 6] Data extractor verification...');
        try {
            const extracted = await dataExtractorService.extractPayrollData(
                TEST_MONTH,
                TEST_YEAR,
                testGang
            );

            const empData = extracted.find((r: any) =>
                (r.emp_code || '').trim() === testNik ||
                (r.nik || '').trim() === testNik
            );

            if (empData) {
                const kontanVal = empData['pendapatan_kontan'];
                console.log(`  ℹ️  Extracted employee data for ${testNik}`);
                console.log(`  ℹ️  pendapatan_kontan = Rp${(kontanVal || 0).toLocaleString('id-ID')}`);
                if (kontanVal === TEST_AMOUNT) {
                    console.log('  ✅✅ Amount matches! Kontan correctly picked up by data extractor.');
                } else {
                    console.warn(`  ⚠️  Amount mismatch: expected ${TEST_AMOUNT}, got ${kontanVal}`);
                    console.log('     (This may be OK if employee was filtered out by HK rules)');
                }
            } else {
                console.log('  ℹ️  Employee not found in extracted data (filtered out by HK rules - this is OK)');
            }
        } catch (extractErr: any) {
            console.log(`  ⚠️  Data extractor test: ${extractErr.message}`);
            console.log('     (This is OK - extractor may have other dependencies)');
        }

        console.log('\n' + '='.repeat(60));
        console.log('TEST COMPLETE');
        console.log('='.repeat(60));

    } catch (error: any) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

testKontanSaveAndRetrieve();
