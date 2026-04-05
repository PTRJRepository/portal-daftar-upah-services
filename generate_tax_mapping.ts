/**
 * Generate Tax Mapping JSON Files per Division
 * 
 * This script:
 * 1. Gets the current active period from database
 * 2. Fetches payroll data for each division
 * 3. Calculates PPh21 TER for each employee
 * 4. Generates JSON files in update_pajak/ directory
 * 
 * Output format per division:
 * - {DIVISION}_pajak.json: Tax calculation results
 * - {DIVISION}_pph_input.json: Input data for verification
 * 
 * Usage: bun run generate_tax_mapping.ts
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

// Real divisions only (exclude virtual divisions like INF, NRS, MILL for now)
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
    pph21_ter: number;  // PPh21 hasil perhitungan TER (bukan dari database)
    tax_rate: number;
}

interface PphInputRow {
    emp_code: string;
    emp_name: string;
    nik: string;
    hk: number;
    upah_dasar: number;
    gaji_pokok_aktual: number;
    tunjangan_beras: number;
    tunjangan_jabatan: number;
    tunjangan_masa_kerja: number;
    tunjangan_lembur: number;
    total_premi: number;
    astek_majikan: number;
    bpjs_kes_majikan: number;
    pot_koreksi: number;
    penghasilan_bruto: number;
    pph21_ter: number;  // PPh21 hasil perhitungan TER
    tax_rate: number;    // Tarif TER yang digunakan (dalam persen)
}

interface DivisionSummary {
    division_code: string;
    employee_count: number;
    total_pph21_ter: number;
    total_pph21_input: number;
    total_selisih: number;
    file_ter: string;
    file_input: string;
    data_source: 'success' | 'error' | 'none';
    error_message?: string;
}

// ============================================================
// Helper Functions
// ============================================================

function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`[TaxMapping] Created output directory: ${OUTPUT_DIR}`);
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
    // gross = 6654555 - (-4188000) = 10842555
    const potKoreksiForTax = -(row.pot_koreksi || 0);

    return pph21TerService.calculatePenghasilanBruto(
        gajiPokokAktual,
        tunjanganBeras,
        tunjanganJabatan,
        tunjanganMasaKerja,
        tunjanganLembur,
        totalPremi,
        astek084,
        bpjsKesehatanMajikan4Pct,
        potKoreksiForTax
    );
}

// ============================================================
// Main Logic
// ============================================================

async function generateTaxMapping() {
    console.log('='.repeat(80));
    console.log('[TaxMapping] Starting Tax Mapping Generation');
    console.log('='.repeat(80));
    
    ensureOutputDir();
    
    // Step 1: Get current period
    console.log('\n[Step 1] Getting current period...');
    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    const { month, year } = currentPeriod;
    console.log(`[TaxMapping] Active period: Month ${month}, Year ${year}`);
    
    // Step 2: Get PTKP mapping
    console.log('\n[Step 2] Loading PTKP master data...');
    const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
    const ptkpMap = new Map<string, string>();
    for (const p of ptkpMaster) {
        ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
    }
    console.log(`[TaxMapping] Loaded ${ptkpMap.size} PTKP records`);
    
    // Step 3: Process each division
    const summaries: DivisionSummary[] = [];
    
    for (const divisionCode of DIVISIONS) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`[Division] Processing ${divisionCode}...`);
        console.log('='.repeat(80));
        
        const summary: DivisionSummary = {
            division_code: divisionCode,
            employee_count: 0,
            total_pph21_ter: 0,
            total_pph21_input: 0,
            total_selisih: 0,
            file_ter: `${divisionCode}_pajak.json`,
            file_input: `${divisionCode}_pph_input.json`,
            data_source: 'none'
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
                console.log(`[Division ${divisionCode}] No data found`);
                summary.data_source = 'none';
                summaries.push(summary);
                continue;
            }
            
            console.log(`[Division ${divisionCode}] Found ${payrollData.data_rows.length} employees`);
            
            // Process each employee
            const taxMappings: TaxMappingRow[] = [];
            const pphInputs: PphInputRow[] = [];
            
            for (const row of payrollData.data_rows) {
                const empCode = row.emp_code?.trim() || '';
                const empName = row.nama || row.emp_name || '';
                const nik = row.nik_ktp || row.nik || '';
                
                // Get PTKP status
                const ptkpStatus = ptkpMap.get(empCode) || row.status_ptkp || 'TK/0';
                const terCategory = mapPTKPToTER(ptkpStatus);
                
                // Calculate gross income
                const grossIncome = calculatePenghasilanBruto(row);
                
                // Calculate PPh21 TER
                const pphResult = pph21TerService.calculatePph21Ter(grossIncome, ptkpStatus);
                const pph21Ter = pphResult.tax_amount;

                // Debug first employee of each division
                if (taxMappings.length === 0) {
                    console.log(`[Division ${divisionCode}] DEBUG first employee:`);
                    console.log(`  emp_code: ${empCode}`);
                    console.log(`  ptkp_status: ${ptkpStatus}`);
                    console.log(`  gross_income: ${grossIncome}`);
                    console.log(`  pph21_ter: ${pph21Ter}`);
                    console.log(`  tax_rate: ${pphResult.rate_percent}%`);
                }

                // Build tax mapping row
                taxMappings.push({
                    emp_code: empCode,
                    emp_name: empName,
                    nik: nik,
                    ptkp_status: ptkpStatus,
                    ter_category: terCategory,
                    gross_income: grossIncome,
                    pph21_ter: pph21Ter,
                    tax_rate: pphResult.rate_percent
                });

                // Build PPh input row (for verification)
                const upahDasar = row.upah_dasar || 0;
                const tunjanganMasaKerja = row.masa_kerja_jumlah || 0;
                const pph21Caruman = getCarumanForPph21(upahDasar, tunjanganMasaKerja);

                pphInputs.push({
                    emp_code: empCode,
                    emp_name: empName,
                    nik: nik,
                    hk: row.hk || 0,
                    upah_dasar: upahDasar,
                    gaji_pokok_aktual: row.gaji_pokok_aktual || row.gaji_pokok || 0,
                    tunjangan_beras: row.beras_jumlah || 0,
                    tunjangan_jabatan: row.jabatan_jumlah || 0,
                    tunjangan_masa_kerja: tunjanganMasaKerja,
                    tunjangan_lembur: row.lembur_jumlah || 0,
                    total_premi: row.total_premi || 0,
                    astek_majikan: pph21Caruman.astek_majikan_084,
                    bpjs_kes_majikan: pph21Caruman.bpjs_kes_majikan_4,
                    pot_koreksi: row.pot_koreksi || 0,
                    penghasilan_bruto: grossIncome,
                    pph21_ter: pph21Ter,
                    tax_rate: pphResult.rate_percent
                });
                
                summary.total_pph21_ter += pph21Ter;
            }
            
            // Calculate summary
            summary.employee_count = taxMappings.length;
            summary.total_pph21_input = pphInputs.reduce((sum, r) => sum + r.penghasilan_bruto, 0);
            summary.total_selisih = summary.total_pph21_ter; // This is the actual PPh21
            summary.data_source = 'success';
            
            // Write files
            const pajakFile = path.join(OUTPUT_DIR, `${divisionCode}_pajak.json`);
            const inputfile = path.join(OUTPUT_DIR, `${divisionCode}_pph_input.json`);
            
            fs.writeFileSync(pajakFile, JSON.stringify(taxMappings, null, 2), 'utf-8');
            fs.writeFileSync(inputfile, JSON.stringify(pphInputs, null, 2), 'utf-8');
            
            console.log(`[Division ${divisionCode}] ✅ Generated ${taxMappings.length} employee mappings`);
            console.log(`[Division ${divisionCode}] Total PPh21 TER: Rp ${summary.total_pph21_ter.toLocaleString('id-ID')}`);
            console.log(`[Division ${divisionCode}] Files written: ${path.basename(pajakFile)}, ${path.basename(inputfile)}`);
            
        } catch (error) {
            console.error(`[Division ${divisionCode}] ❌ Error:`, error);
            summary.data_source = 'error';
            summary.error_message = error instanceof Error ? error.message : String(error);
        }
        
        summaries.push(summary);
    }
    
    // Step 4: Generate summary file
    console.log('\n' + '='.repeat(80));
    console.log('[Step 4] Generating summary file...');
    console.log('='.repeat(80));
    
    const summaryData = {
        periode: {
            bulan: month,
            tahun: year
        },
        generated_at: new Date().toISOString(),
        divisions: summaries.reduce((acc, s) => {
            acc[s.division_code] = {
                employee_count: s.employee_count,
                total_pph21_ter: s.total_pph21_ter,
                total_pph21_input: s.total_pph21_input,
                total_selisih: s.total_selisih,
                file_ter: s.file_ter,
                file_input: s.file_input,
                data_source: s.data_source,
                error_message: s.error_message
            };
            return acc;
        }, {} as Record<string, any>)
    };
    
    const summaryFile = path.join(OUTPUT_DIR, '_summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2), 'utf-8');
    
    console.log(`\n[Summary] Summary written to: ${path.basename(summaryFile)}`);
    console.log('\n' + '='.repeat(80));
    console.log('[TaxMapping] Generation Complete!');
    console.log('='.repeat(80));
    
    // Print final summary
    console.log('\n📊 Division Summary:');
    console.log('-'.repeat(80));
    console.log('Division'.padEnd(12), 'Employees'.padEnd(12), 'Total PPh21'.padEnd(15), 'Status');
    console.log('-'.repeat(80));
    
    for (const s of summaries) {
        const status = s.data_source === 'success' ? '✅' : s.data_source === 'error' ? '❌' : '⚪';
        console.log(
            s.division_code.padEnd(12),
            String(s.employee_count).padEnd(12),
            `Rp ${s.total_pph21_ter.toLocaleString('id-ID')}`.padEnd(15),
            status
        );
    }
    
    console.log('-'.repeat(80));
    const totalEmployees = summaries.reduce((sum, s) => sum + s.employee_count, 0);
    const totalPph21 = summaries.reduce((sum, s) => sum + s.total_pph21_ter, 0);
    console.log('TOTAL'.padEnd(12), String(totalEmployees).padEnd(12), `Rp ${totalPph21.toLocaleString('id-ID')}`.padEnd(15));
    console.log('='.repeat(80));
}

// Run the script
generateTaxMapping()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
