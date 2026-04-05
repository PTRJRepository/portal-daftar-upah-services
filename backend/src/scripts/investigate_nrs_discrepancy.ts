/**
 * Investigate PPh21 Discrepancy for NRS Division (Gang B2N)
 * 
 * This script:
 * 1. Fetches payroll data for NRS division (gang B2N from PG1B)
 * 2. Calculates PPh21 TER for each employee
 * 3. Fetches actual PPh21 amounts from PR_ADTRANSLN database
 * 4. Compares and shows discrepancies
 * 
 * Usage: cd backend && bun run src/scripts/investigate_nrs_discrepancy.ts
 */

import sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';
import { currentPeriodService } from '../services/currentPeriodService';
import { DataExtractorService } from '../services/dataExtractorService';
import { pph21TerService } from '../services/pph21TerService';
import { ptkpTaxService } from '../services/ptkpTaxService';
import { getCarumanForPph21 } from '../services/carumanDefinitions';

// ============================================================
// Configuration - Database Connection
// ============================================================

const DB_CONFIG = {
    driver: "ODBC Driver 17 for SQL Server",
    server: "10.0.0.2",
    port: 1888,
    user: "sa",
    password: "supp0rt@",
    database: "db_ptrj",
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

const OUTPUT_DIR = path.resolve(process.cwd(), '../update_pajak');

// ============================================================
// Types
// ============================================================

interface DiscrepancyRow {
    emp_code: string;
    emp_name: string;
    nik: string;
    ptkp_status: string;
    ter_category: string;
    gross_income: number;
    pph21_ter_calculated: number;
    pph21_db_amount: number;
    difference: number;
    difference_percent: number;
    has_records: boolean;
    record_count: number;
}

// ============================================================
// Helper Functions
// ============================================================

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

    const potKoreksiForTax = -(row.pot_koreksi || 0);
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

async function getPPH21FromDatabase(pool: sql.Pool, empCode: string): Promise<any[]> {
    const PPH21_PATTERNS = [
        '%Potongan Pph21%',
        '%Potongan PPH 21%',
        '%Potongan PPH21%',
        '%PPH 21%',
        '%PPH21%',
        '%POTONGAN PPH%',
        '%PPh 21%',
        '%PPh21%'
    ];

    const query = `
        SELECT
            t.ID,
            t.DocDesc,
            t.EmpCode,
            t.EmpName,
            t.AccMonth,
            t.AccYear,
            ln.Amount,
            ln.MasterID
        FROM PR_ADTRANS t
        INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(t.EmpCode) = @empCode
        AND (
            t.DocDesc LIKE @p1
            OR t.DocDesc LIKE @p2
            OR t.DocDesc LIKE @p3
            OR t.DocDesc LIKE @p4
            OR t.DocDesc LIKE @p5
            OR t.DocDesc LIKE @p6
            OR t.DocDesc LIKE @p7
            OR t.DocDesc LIKE @p8
        )
        ORDER BY t.DocDate DESC
    `;

    const request = pool.request();
    request.input('empCode', sql.VarChar, empCode);
    request.input('p1', sql.VarChar, PPH21_PATTERNS[0]);
    request.input('p2', sql.VarChar, PPH21_PATTERNS[1]);
    request.input('p3', sql.VarChar, PPH21_PATTERNS[2]);
    request.input('p4', sql.VarChar, PPH21_PATTERNS[3]);
    request.input('p5', sql.VarChar, PPH21_PATTERNS[4]);
    request.input('p6', sql.VarChar, PPH21_PATTERNS[5]);
    request.input('p7', sql.VarChar, PPH21_PATTERNS[6]);
    request.input('p8', sql.VarChar, PPH21_PATTERNS[7]);

    const result = await request.query(query);
    return result.recordset;
}

// ============================================================
// Main Logic
// ============================================================

async function investigateNRSDiscrepancy() {
    console.log('='.repeat(80));
    console.log('[INVESTIGATION] PPh21 Discrepancy for NRS Division (Gang B2N)');
    console.log('='.repeat(80));

    // Step 1: Get current period
    console.log('\n[Step 1] Getting current period...');
    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    const { month, year } = currentPeriod;
    console.log(`[Investigation] Active period: Month ${month}, Year ${year}`);

    // Step 2: Get PTKP mapping
    console.log('\n[Step 2] Loading PTKP master data...');
    const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
    const ptkpMap = new Map<string, string>();
    for (const p of ptkpMaster) {
        ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
    }
    console.log(`[Investigation] Loaded ${ptkpMap.size} PTKP records`);

    // Step 3: Fetch payroll data for NRS division
    console.log('\n[Step 3] Fetching payroll data for NRS division...');
    console.log('[Note] NRS is a virtual division using gang B2N from PG1B');
    
    const extractor = DataExtractorService.getInstance();
    
    // Fetch using gang code B2N
    const payrollData = await extractor.extractPayrollData(
        month,
        year,
        'B2N', // Gang code for NRS
        'PG1B', // Source division
        null,
        undefined,
        false,
        undefined,
        undefined,
        true, // include calculations
        true  // include premiums
    );

    if (!payrollData || payrollData.data_rows.length === 0) {
        console.log('[Investigation] ⚠️  No data found for NRS division');
        return;
    }

    console.log(`[Investigation] ✓ Found ${payrollData.data_rows.length} employees in NRS`);

    // Step 4: Connect to database
    console.log('\n[Step 4] Connecting to database...');
    let pool: sql.Pool | null = null;
    try {
        pool = await sql.connect(DB_CONFIG);
        console.log('[Database] ✓ Connected');
    } catch (error) {
        console.error('[Database] ❌ Connection failed:', error);
        return;
    }

    try {
        // Step 5: Process each employee
        console.log('\n[Step 5] Calculating PPh21 TER and comparing with database...');
        console.log('='.repeat(80));

        const discrepancies: DiscrepancyRow[] = [];
        let totalTerCalculated = 0;
        let totalDbAmount = 0;
        let totalDifference = 0;
        let employeesWithRecords = 0;
        let employeesWithoutRecords = 0;
        let matchingRecords = 0;
        let differentRecords = 0;

        for (const row of payrollData.data_rows) {
            const empCode = row.emp_code?.trim() || '';
            const empName = row.nama || row.emp_name || '';
            const nik = row.nik_ktp || row.nik || '';

            // Get PTKP status
            const ptkpStatus = ptkpMap.get(empCode) || row.status_ptkp || 'TK/0';

            // Calculate gross income
            const grossIncome = calculatePenghasilanBruto(row);

            // Calculate PPh21 TER
            const pphResult = pph21TerService.calculatePph21Ter(grossIncome, ptkpStatus);
            const pph21TerCalculated = pphResult.tax_amount;

            // Get PPh21 from database
            const dbRecords = await getPPH21FromDatabase(pool, empCode);
            const dbAmount = dbRecords.length > 0 ? (dbRecords[0].Amount || 0) : 0;

            // Calculate difference
            const difference = pph21TerCalculated - dbAmount;
            const differencePercent = dbAmount > 0 ? Math.abs(difference) / dbAmount * 100 : (pph21TerCalculated > 0 ? 100 : 0);

            // Track totals
            totalTerCalculated += pph21TerCalculated;
            totalDbAmount += dbAmount;
            totalDifference += difference;

            if (dbRecords.length > 0) {
                employeesWithRecords++;
                if (Math.abs(difference) < 1) {
                    matchingRecords++;
                } else {
                    differentRecords++;
                }
            } else {
                employeesWithoutRecords++;
            }

            discrepancies.push({
                emp_code: empCode,
                emp_name: empName,
                nik: nik,
                ptkp_status: ptkpStatus,
                ter_category: pphResult.category || '',
                gross_income: grossIncome,
                pph21_ter_calculated: pph21TerCalculated,
                pph21_db_amount: dbAmount,
                difference: difference,
                difference_percent: differencePercent,
                has_records: dbRecords.length > 0,
                record_count: dbRecords.length
            });
        }

        // Step 6: Display results
        console.log('\n' + '='.repeat(80));
        console.log('[RESULTS] PPh21 Discrepancy Analysis for NRS Division');
        console.log('='.repeat(80));

        console.log('\n[Summary]');
        console.log(`  Total Employees: ${payrollData.data_rows.length}`);
        console.log(`  With PPh21 Records: ${employeesWithRecords}`);
        console.log(`  Without PPh21 Records: ${employeesWithoutRecords}`);
        console.log(`  Matching (diff < Rp 1): ${matchingRecords}`);
        console.log(`  Different: ${differentRecords}`);

        console.log('\n[Totals]');
        console.log(`  Total PPh21 TER Calculated: ${formatRupiah(totalTerCalculated)}`);
        console.log(`  Total PPh21 Database: ${formatRupiah(totalDbAmount)}`);
        console.log(`  Total Difference: ${formatRupiah(totalDifference)}`);
        if (totalDbAmount > 0) {
            console.log(`  Average Difference: ${(totalDifference / totalDbAmount * 100).toFixed(2)}%`);
        }

        // Show detailed discrepancies
        console.log('\n' + '='.repeat(80));
        console.log('[DETAIL] Employees with Discrepancies (sorted by difference)');
        console.log('='.repeat(80));

        // Sort by absolute difference (largest first)
        const sorted = [...discrepancies].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

        console.log(
            '\nNo. '.padEnd(5) +
            'Emp Code'.padEnd(10) +
            'Name'.padEnd(30) +
            'PTKP'.padEnd(8) +
            'Gross Income'.padEnd(18) +
            'TER Calc'.padEnd(14) +
            'DB Amount'.padEnd(14) +
            'Difference'.padEnd(14) +
            'Diff %'
        );
        console.log('-'.repeat(130));

        let idx = 1;
        for (const d of sorted) {
            if (Math.abs(d.difference) >= 1) { // Only show if difference >= Rp 1
                console.log(
                    String(idx).padEnd(5) +
                    d.emp_code.padEnd(10) +
                    d.emp_name.substring(0, 28).padEnd(30) +
                    d.ptkp_status.padEnd(8) +
                    formatRupiah(d.gross_income).padEnd(18) +
                    formatRupiah(d.pph21_ter_calculated).padEnd(14) +
                    formatRupiah(d.pph21_db_amount).padEnd(14) +
                    formatRupiah(d.difference).padEnd(14) +
                    d.difference_percent.toFixed(2) + '%'
                );
                idx++;
            }
        }

        // Show employees without records
        console.log('\n' + '='.repeat(80));
        console.log('[DETAIL] Employees WITHOUT PPh21 Records in Database');
        console.log('='.repeat(80));

        const withoutRecords = discrepancies.filter(d => !d.has_records);
        if (withoutRecords.length > 0) {
            console.log(
                '\nNo. '.padEnd(5) +
                'Emp Code'.padEnd(10) +
                'Name'.padEnd(30) +
                'PTKP'.padEnd(8) +
                'Gross Income'.padEnd(18) +
                'TER Calc'
            );
            console.log('-'.repeat(90));

            withoutRecords.forEach((d, i) => {
                console.log(
                    String(i + 1).padEnd(5) +
                    d.emp_code.padEnd(10) +
                    d.emp_name.substring(0, 28).padEnd(30) +
                    d.ptkp_status.padEnd(8) +
                    formatRupiah(d.gross_income).padEnd(18) +
                    formatRupiah(d.pph21_ter_calculated)
                );
            });
        } else {
            console.log('\n✓ All employees have PPh21 records in database');
        }

        // Show matching records
        console.log('\n' + '='.repeat(80));
        console.log('[DETAIL] Employees with MATCHING PPh21 Amounts');
        console.log('='.repeat(80));

        const matching = discrepancies.filter(d => Math.abs(d.difference) < 1);
        if (matching.length > 0) {
            console.log(`\n✓ ${matching.length} employees have matching amounts`);
            console.log('\nSample (first 5):');
            matching.slice(0, 5).forEach((d, i) => {
                console.log(`  ${i + 1}. ${d.emp_code} - ${d.emp_name}: ${formatRupiah(d.pph21_ter_calculated)}`);
            });
        }

        // Save to JSON file
        const outputFile = path.join(OUTPUT_DIR, 'NRS_discrepancy_analysis.json');
        const outputData = {
            period: { month, year },
            division: 'NRS',
            gang: 'B2N',
            summary: {
                total_employees: payrollData.data_rows.length,
                with_records: employeesWithRecords,
                without_records: employeesWithoutRecords,
                matching: matchingRecords,
                different: differentRecords,
                total_ter_calculated: totalTerCalculated,
                total_db_amount: totalDbAmount,
                total_difference: totalDifference
            },
            discrepancies: discrepancies,
            generated_at: new Date().toISOString()
        };

        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf-8');
        console.log(`\n[Output] Detailed analysis saved to: ${outputFile}`);

        console.log('\n' + '='.repeat(80));
        console.log('[INVESTIGATION COMPLETE]');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n❌ Investigation failed:', error);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n[Database] Connection closed');
        }
    }
}

// Run the script
investigateNRSDiscrepancy()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
