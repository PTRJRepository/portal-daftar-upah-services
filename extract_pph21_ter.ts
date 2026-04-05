/**
 * Extract PPh21 TER Tax Values and Save to update_pajak
 * 
 * This script:
 * 1. Gets the current active period from database
 * 2. Fetches payroll data for each division
 * 3. Calculates PPh21 TER using the same logic as the UI
 * 4. Saves results to update_pajak/{DIVISION}_pajak.json
 * 
 * The output matches exactly what's displayed in the UI TaxReportPage
 * 
 * Usage: bun run extract_pph21_ter.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { currentPeriodService } from './backend/src/services/currentPeriodService';
import { DataExtractorService } from './backend/src/services/dataExtractorService';
import { pph21TerService } from './backend/src/services/pph21TerService';
import { ptkpTaxService, mapPTKPToTER } from './backend/src/services/ptkpTaxService';
import { getCarumanForPph21 } from './backend/src/services/carumanDefinitions';
import { divisionConfigService } from './backend/src/services/config/DivisionConfigService';

// ============================================================
// Configuration
// ============================================================

const OUTPUT_DIR = path.resolve(process.cwd(), 'update_pajak');

// All divisions (real divisions only)
const DIVISIONS = [
    'PG1A',
    'PG1B',
    'PG2A',
    'PG2B',
    'PGE',
    'AB1',
    'AB2',
    'ARA',
    'ARC',
    'DME',
    'IJL'
];

// ============================================================
// Types
// ============================================================

interface TaxMappingRow {
    emp_code: string;
    emp_name: string;
    nik: string;
    ptkp_status: string;
    ter_category: string;
    gross_income: number;
    pph21_amount: number;
    tax_rate: number;
    tax_rate_percent: number;
}

interface DivisionSummary {
    division_code: string;
    employee_count: number;
    total_pph21_ter: number;
    total_gross_income: number;
    file_output: string;
    status: 'success' | 'error' | 'none';
    error_message?: string;
}

// ============================================================
// Helper Functions
// ============================================================

function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`[PPh21 Extract] Created output directory: ${OUTPUT_DIR}`);
    }
}

function calculatePenghasilanBruto(row: any): number {
    const gajiPokokAktual = row.gaji_pokok_aktual || row.gaji_pokok || 0;
    const tunjanganBeras = row.beras_jumlah || 0;
    const tunjanganJabatan = row.jabatan_jumlah || 0;
    const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
    const tunjanganLembur = row.lembur_jumlah || 0;
    const totalPremi = row.total_premi || 0;

    const upahDasar = row.upah_dasar || 0;
    const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);
    const astek084 = pph21Caruman.astek_majikan_084;
    const bpjsKesehatanMajikan4Pct = pph21Caruman.bpjs_kes_majikan_4;

    // pot_koreksi from DB is positive (e.g., 4188000), but for tax calculation
    // it should be treated as negative (so subtracting it adds to gross income)
    const potKoreksiForTax = -(row.pot_koreksi || 0);

    // Include pendapatan_lainnya if available (THR, bonus, etc.)
    const pendapatanLainnya = row.pendapatan_lainnya || 0;

    return pph21TerService.calculatePenghasilanBruto(
        gajiPokokAktual,
        tunjanganBeras,
        tunjanganJabatan,
        tunjanganMasaKerja,
        tunjanganLembur,
        totalPremi,
        astek084,
        bpjsKesehatanMajikan4Pct,
        potKoreksiForTax,
        pendapatanLainnya
    );
}

function formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
}

// ============================================================
// Main Logic
// ============================================================

async function extractPph21Ter() {
    console.log('='.repeat(80));
    console.log('[PPh21 TER Extract] Starting PPh21 TER Tax Extraction');
    console.log('='.repeat(80));

    ensureOutputDir();

    // Step 1: Get current period
    console.log('\n[Step 1] Getting current period...');
    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    const { month, year } = currentPeriod;
    console.log(`[PPh21 Extract] Active period: Month ${month}, Year ${year}`);

    // Step 2: Get PTKP mapping
    console.log('\n[Step 2] Loading PTKP master data...');
    const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
    const ptkpMap = new Map<string, string>();
    for (const p of ptkpMaster) {
        ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
    }
    console.log(`[PPh21 Extract] Loaded ${ptkpMap.size} PTKP records`);

    // Step 3: Process each division
    const summaries: DivisionSummary[] = [];
    let grandTotalEmployees = 0;
    let grandTotalPph21 = 0;
    let grandTotalGrossIncome = 0;

    for (const divisionCode of DIVISIONS) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[Division ${divisionCode}] Processing...`);
        console.log('='.repeat(80));

        const summary: DivisionSummary = {
            division_code: divisionCode,
            employee_count: 0,
            total_pph21_ter: 0,
            total_gross_income: 0,
            file_output: `${divisionCode}_pajak.json`,
            status: 'none'
        };

        try {
            // Fetch payroll data for this division
            console.log(`[Division ${divisionCode}] Fetching payroll data...`);
            const extractor = DataExtractorService.getInstance();

            const payrollData = await extractor.extractPayrollData(
                month,
                year,
                'ALL', // Get all gangs
                divisionCode,
                null,
                undefined,
                false,
                undefined,
                undefined,
                true, // include calculations
                true  // include premiums
            );

            if (!payrollData || payrollData.data_rows.length === 0) {
                console.log(`[Division ${divisionCode}] ⚠️  No data found`);
                summary.status = 'none';
                summaries.push(summary);
                continue;
            }

            console.log(`[Division ${divisionCode}] ✓ Found ${payrollData.data_rows.length} employees`);

            // Process each employee
            const taxMappings: TaxMappingRow[] = [];

            for (const row of payrollData.data_rows) {
                const empCode = row.emp_code?.trim() || '';
                const empName = row.nama || row.emp_name || '';
                const nik = row.nik_ktp || row.nik || '';

                // Get PTKP status from master or fallback to row data
                const ptkpStatus = ptkpMap.get(empCode) || row.status_ptkp || 'TK/0';
                const terCategory = mapPTKPToTER(ptkpStatus);

                // Calculate gross income (same formula as UI)
                const grossIncome = calculatePenghasilanBruto(row);

                // Calculate PPh21 TER - THIS IS THE EXACT SAME CALCULATION AS UI
                const pphResult = pph21TerService.calculatePph21Ter(grossIncome, ptkpStatus);
                const pph21Amount = pphResult.tax_amount;

                // Debug first employee of each division
                if (taxMappings.length === 0) {
                    console.log(`\n[Division ${divisionCode}] DEBUG first employee:`);
                    console.log(`  Employee: ${empCode} - ${empName}`);
                    console.log(`  PTKP Status: ${ptkpStatus}`);
                    console.log(`  TER Category: ${terCategory}`);
                    console.log(`  Gross Income: ${formatRupiah(grossIncome)}`);
                    console.log(`  Tax Rate: ${pphResult.rate_percent}%`);
                    console.log(`  PPh21 TER: ${formatRupiah(pph21Amount)}`);
                    console.log(`  Calculation: ${formatRupiah(grossIncome)} × ${pphResult.rate_percent}% = ${formatRupiah(pph21Amount)}`);
                }

                // Build tax mapping row - THIS MATCHES UI DISPLAY
                taxMappings.push({
                    emp_code: empCode,
                    emp_name: empName,
                    nik: nik,
                    ptkp_status: ptkpStatus,
                    ter_category: terCategory,
                    gross_income: grossIncome,
                    pph21_amount: pph21Amount,
                    tax_rate: pphResult.rate,          // Decimal (e.g., 0.05)
                    tax_rate_percent: pphResult.rate_percent  // Percentage (e.g., 5.0)
                });

                summary.total_pph21_ter += pph21Amount;
                summary.total_gross_income += grossIncome;
            }

            // Update summary
            summary.employee_count = taxMappings.length;
            summary.status = 'success';

            // Write JSON file
            const outputFile = path.join(OUTPUT_DIR, `${divisionCode}_pajak.json`);
            fs.writeFileSync(outputFile, JSON.stringify(taxMappings, null, 2), 'utf-8');

            console.log(`\n[Division ${divisionCode}] ✅ Success`);
            console.log(`  Employees: ${summary.employee_count}`);
            console.log(`  Total Gross Income: ${formatRupiah(summary.total_gross_income)}`);
            console.log(`  Total PPh21 TER: ${formatRupiah(summary.total_pph21_ter)}`);
            console.log(`  Average Tax Rate: ${(summary.total_pph21_ter / summary.total_gross_income * 100).toFixed(2)}%`);
            console.log(`  File: ${path.basename(outputFile)}`);

            // Update grand totals
            grandTotalEmployees += summary.employee_count;
            grandTotalPph21 += summary.total_pph21_ter;
            grandTotalGrossIncome += summary.total_gross_income;

        } catch (error) {
            console.error(`[Division ${divisionCode}] ❌ Error:`, error);
            summary.status = 'error';
            summary.error_message = error instanceof Error ? error.message : String(error);
        }

        summaries.push(summary);
    }

    // Step 4: Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('[Summary] PPh21 TER Extraction Complete');
    console.log('='.repeat(80));

    console.log('\nDivision Summary:');
    console.log('-'.repeat(80));
    console.log(
        'Division'.padEnd(12) +
        'Employees'.padEnd(12) +
        'Gross Income'.padEnd(20) +
        'PPh21 TER'.padEnd(20) +
        'Status'
    );
    console.log('-'.repeat(80));

    for (const s of summaries) {
        const grossStr = s.total_gross_income > 0 ? formatRupiah(s.total_gross_income) : '-';
        const pphStr = s.total_pph21_ter > 0 ? formatRupiah(s.total_pph21_ter) : '-';
        const statusStr = s.status === 'success' ? '✓' : s.status === 'error' ? '✗' : '-';

        console.log(
            s.division_code.padEnd(12) +
            String(s.employee_count).padEnd(12) +
            grossStr.padEnd(20) +
            pphStr.padEnd(20) +
            statusStr
        );
    }

    console.log('-'.repeat(80));
    console.log('\nGrand Total:');
    console.log(`  Total Employees: ${grandTotalEmployees}`);
    console.log(`  Total Gross Income: ${formatRupiah(grandTotalGrossIncome)}`);
    console.log(`  Total PPh21 TER: ${formatRupiah(grandTotalPph21)}`);
    if (grandTotalGrossIncome > 0) {
        console.log(`  Average Tax Rate: ${(grandTotalPph21 / grandTotalGrossIncome * 100).toFixed(2)}%`);
    }
    console.log('='.repeat(80));

    // Save summary metadata
    const summaryMetadata = {
        generated_at: new Date().toISOString(),
        period: { month, year },
        grand_total: {
            employees: grandTotalEmployees,
            total_gross_income: grandTotalGrossIncome,
            total_pph21_ter: grandTotalPph21
        },
        divisions: summaries.map(s => ({
            division_code: s.division_code,
            employee_count: s.employee_count,
            total_gross_income: s.total_gross_income,
            total_pph21_ter: s.total_pph21_ter,
            status: s.status,
            error_message: s.error_message
        }))
    };

    const summaryFile = path.join(OUTPUT_DIR, '_extraction_summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summaryMetadata, null, 2), 'utf-8');
    console.log(`\n[Summary] Metadata saved to: ${path.basename(summaryFile)}`);

    console.log('\n✅ All division files saved to:', OUTPUT_DIR);
    console.log('   Files generated:');
    summaries.filter(s => s.status === 'success').forEach(s => {
        console.log(`   - ${s.division_code}_pajak.json (${s.employee_count} employees)`);
    });
}

// Run the script
extractPph21Ter()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
