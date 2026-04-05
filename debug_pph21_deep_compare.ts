/**
 * Deep comparison script - compares EXACT values that would be shown in UI
 */

import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { taxReportService } from './backend/src/services/taxReportService';

async function deepCompare() {
    console.log('='.repeat(80));
    console.log('DEEP COMPARISON: Tax Report vs Daftar Upah (UI values)');
    console.log('Target: AB2 division, H1H gang, March 2026');
    console.log('='.repeat(80));
    console.log();

    // Parameters - try different scenarios
    const year = 2026;
    const month = 3;
    const divisionCode = 'AB2';
    const gangCode = 'ALL'; // Check ALL gangs in AB2, not just H1H

    // Fetch both datasets
    console.log('📊 Fetching data from both sources...');
    const [daftarUpahData, taxReportResult] = await Promise.all([
        DataExtractorService.getInstance().extractPayrollData(
            month, year, gangCode, divisionCode, null, undefined, false, undefined, undefined, true, true
        ),
        taxReportService.getMonthlyTaxReport(year, month, divisionCode, gangCode)
    ]);

    console.log(`   Daftar Upah: ${daftarUpahData.data_rows.length} employees`);
    console.log(`   Tax Report:  ${taxReportResult.employees.length} employees`);
    console.log();

    // Build maps
    const daftarUpahMap = new Map();
    for (const emp of daftarUpahData.data_rows) {
        const key = (emp.emp_code || emp.nik || '').trim().toUpperCase();
        daftarUpahMap.set(key, emp);
    }

    // Compare each employee
    let totalPphDaftarUpah = 0;
    let totalPphTaxReport = 0;
    let employeesWithDiff = [];

    console.log('🔍 Employee-by-employee comparison:');
    console.log('-'.repeat(80));

    for (const taxEmp of taxReportResult.employees) {
        const empKey = (taxEmp.emp_code || taxEmp.nik || '').trim().toUpperCase();
        const daftarUpahEmp = daftarUpahMap.get(empKey);

        if (!daftarUpahEmp) {
            console.log(`⚠️  ${empKey} (${taxEmp.emp_name}) - NOT in Daftar Upah`);
            continue;
        }

        const taxPph = taxEmp.pph21_ter || 0;
        const daftarPph = daftarUpahEmp.pph21_ter || 0;
        const diff = taxPph - daftarPph;

        totalPphTaxReport += taxPph;
        totalPphDaftarUpah += daftarPph;

        if (Math.abs(diff) > 0) {
            employeesWithDiff.push({
                emp_code: empKey,
                emp_name: taxEmp.emp_name,
                tax_report: taxPph,
                daftar_upah: daftarPph,
                diff: diff
            });
        }

        console.log(`${empKey.padEnd(12)} | Tax: ${String(taxPph).padStart(10)} | Daftar: ${String(daftarPph).padStart(10)} | ${diff !== 0 ? `DIFF: ${diff > 0 ? '+' : ''}${diff}` : '✓'}`);
    }

    console.log('-'.repeat(80));
    console.log();
    console.log('📊 TOTALS:');
    console.log(`   Tax Report (sum):     Rp ${totalPphTaxReport.toLocaleString('id-ID')}`);
    console.log(`   Tax Report (backend): Rp ${taxReportResult.total_pph21.toLocaleString('id-ID')}`);
    console.log(`   Daftar Upah (sum):    Rp ${totalPphDaftarUpah.toLocaleString('id-ID')}`);
    console.log();
    console.log(`   Difference (sum):     Rp ${(totalPphTaxReport - totalPphDaftarUpah).toLocaleString('id-ID')}`);
    console.log(`   Difference (backend): Rp ${(taxReportResult.total_pph21 - totalPphDaftarUpah).toLocaleString('id-ID')}`);
    console.log();

    if (employeesWithDiff.length > 0) {
        console.log(`❌ ${employeesWithDiff.length} employees have different PPh21:`);
        let totalDiffSum = 0;
        for (const emp of employeesWithDiff) {
            console.log(`   ${emp.emp_code} (${emp.emp_name}):`);
            console.log(`      Tax Report:  Rp ${emp.tax_report.toLocaleString('id-ID')}`);
            console.log(`      Daftar Upah: Rp ${emp.daftar_upah.toLocaleString('id-ID')}`);
            console.log(`      Difference:  Rp ${emp.diff.toLocaleString('id-ID')}`);
            totalDiffSum += Math.abs(emp.diff);
        }
        console.log(`   Total absolute difference: Rp ${totalDiffSum.toLocaleString('id-ID')}`);
        console.log();
    } else {
        console.log('✅ All employees have identical PPh21 values!');
        console.log();
    }

    // Check if the 4.6M difference is actually from a DIFFERENT source
    console.log('🔍 Checking what "4.637.898" might refer to...');
    console.log(`   Tax Report total:  ${taxReportResult.total_pph21} (${taxReportResult.total_pph21 === 4637898 ? 'MATCHES!' : 'no match'})`);
    console.log(`   Sum of employees:  ${totalPphTaxReport} (${totalPphTaxReport === 4637898 ? 'MATCHES!' : 'no match'})`);
    console.log();

    // Check data source
    console.log(`📋 Data Source: ${taxReportResult.data_source === 'current' ? 'LIVE (dataExtractor)' : 'HISTORY database'}`);
}

deepCompare().catch(console.error);
