/**
 * Verify bonus/THR is removed from tax report
 */
import { taxReportService } from "./src/services/taxReportService";

async function main() {
    const result = await taxReportService.getMonthlyTaxReport(2026, 3, 'PG2B', undefined, undefined, undefined);

    console.log(`Employees: ${result?.employees?.length || 0}`);

    if (result?.employees?.length > 0) {
        const emp = result.employees[0];
        console.log('\nChecking if bonus/THR fields are removed:');
        console.log('- thr_amount:', emp.thr_amount === undefined ? 'REMOVED ✓' : `Still exists: ${emp.thr_amount}`);
        console.log('- exgratia_amount:', emp.exgratia_amount === undefined ? 'REMOVED ✓' : `Still exists: ${emp.exgratia_amount}`);
        console.log('- other_incomes:', emp.other_incomes === undefined ? 'REMOVED ✓' : `Still exists: ${emp.other_incomes}`);
        console.log('- pendapatan_lainnya:', emp.pendapatan_lainnya === undefined ? 'REMOVED ✓' : `Still exists: ${emp.pendapatan_lainnya}`);

        console.log('\nEmployee data sample:');
        console.log('- emp_code:', emp.emp_code);
        console.log('- emp_name:', emp.emp_name);
        console.log('- penghasilan_bruto:', emp.penghasilan_bruto);
        console.log('- pph21_ter:', emp.pph21_ter);
        console.log('- status_ptkp:', emp.status_ptkp);
    }

    process.exit(0);
}

main().catch(console.error);