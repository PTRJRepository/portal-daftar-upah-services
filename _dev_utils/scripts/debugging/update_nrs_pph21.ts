/**
 * Extract and Update PPh21 for NRS Division (Virtual Division - Gang B2N)
 * 
 * NRS (Nursery) is a VIRTUAL division that takes gang B2N from PG1B.
 * This script:
 * 1. Extracts payroll data for NRS (gang B2N from PG1B)
 * 2. Calculates PPh21 TER for each employee
 * 3. Saves to update_pajak/NRS_pajak.json
 * 4. Updates PR_ADTRANSLN database with new amounts
 * 
 * Usage: cd backend && bun run src/scripts/update_nrs_pph21.ts
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
// Configuration
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

// PPH21 DocDesc patterns
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

async function findPPH21Records(pool: sql.Pool, empCode: string): Promise<any[]> {
    const query = `
        SELECT
            t.ID,
            t.DocID,
            t.DocDate,
            t.DocDesc,
            t.EmpCode,
            t.EmpName,
            t.LocCode,
            t.AccMonth,
            t.AccYear,
            t.PhyMonth,
            t.PhyYear,
            t.Status,
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

async function updatePPH21Amount(
    pool: sql.Pool,
    masterId: number,
    newAmount: number
): Promise<boolean> {
    const query = `
        UPDATE PR_ADTRANSLN
        SET Amount = @amount
        WHERE MasterID = @masterId
    `;

    const request = pool.request();
    request.input('amount', sql.Decimal(18, 2), newAmount);
    request.input('masterId', sql.BigInt, BigInt(masterId));

    const result = await request.query(query);
    return result.rowsAffected[0] > 0;
}

// ============================================================
// Main Logic
// ============================================================

async function extractAndUpdateNRS() {
    console.log('='.repeat(80));
    console.log('[NRS PPh21] Extract and Update for NRS Division (Gang B2N)');
    console.log('='.repeat(80));

    // Step 1: Get current period
    console.log('\n[Step 1] Getting current period...');
    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    const { month, year } = currentPeriod;
    console.log(`[NRS] Active period: Month ${month}, Year ${year}`);

    // Step 2: Get PTKP mapping
    console.log('\n[Step 2] Loading PTKP master data...');
    const ptkpMaster = await ptkpTaxService.getPtkpByYear(year);
    const ptkpMap = new Map<string, string>();
    for (const p of ptkpMaster) {
        ptkpMap.set(p.emp_code.trim(), p.ptkp_status);
    }
    console.log(`[NRS] Loaded ${ptkpMap.size} PTKP records`);

    // Step 3: Fetch payroll data for NRS division (gang B2N)
    console.log('\n[Step 3] Fetching payroll data for NRS division...');
    console.log('[Note] NRS is a VIRTUAL division using gang B2N from PG1B');
    
    const extractor = DataExtractorService.getInstance();
    
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
        console.log('[NRS] ⚠️  No data found for NRS division');
        return;
    }

    console.log(`[NRS] ✓ Found ${payrollData.data_rows.length} employees in NRS`);

    // Step 4: Calculate PPh21 TER for each employee
    console.log('\n[Step 4] Calculating PPh21 TER for each employee...');
    const taxMappings: TaxMappingRow[] = [];
    let totalGrossIncome = 0;
    let totalPph21 = 0;

    for (const row of payrollData.data_rows) {
        const empCode = row.emp_code?.trim() || '';
        const empName = row.nama || row.emp_name || '';
        const nik = row.nik_ktp || row.nik || '';

        const ptkpStatus = ptkpMap.get(empCode) || row.status_ptkp || 'TK/0';
        const grossIncome = calculatePenghasilanBruto(row);
        const pphResult = pph21TerService.calculatePph21Ter(grossIncome, ptkpStatus);
        const pph21Amount = pphResult.tax_amount;

        totalGrossIncome += grossIncome;
        totalPph21 += pph21Amount;

        taxMappings.push({
            emp_code: empCode,
            emp_name: empName,
            nik: nik,
            ptkp_status: ptkpStatus,
            ter_category: pphResult.category || '',
            gross_income: grossIncome,
            pph21_amount: pph21Amount,
            tax_rate: pphResult.rate,
            tax_rate_percent: pphResult.rate_percent
        });
    }

    console.log(`[NRS] ✓ Calculated ${taxMappings.length} employees`);
    console.log(`[NRS] Total Gross Income: ${formatRupiah(totalGrossIncome)}`);
    console.log(`[NRS] Total PPh21 TER: ${formatRupiah(totalPph21)}`);

    // Step 5: Save to JSON file
    const outputFile = path.join(OUTPUT_DIR, 'NRS_pajak.json');
    fs.writeFileSync(outputFile, JSON.stringify(taxMappings, null, 2), 'utf-8');
    console.log(`\n[Step 5] ✓ Saved to: ${outputFile}`);

    // Step 6: Update database
    console.log('\n[Step 6] Connecting to database for update...');
    let pool: sql.Pool | null = null;
    try {
        pool = await sql.connect(DB_CONFIG);
        console.log('[Database] ✓ Connected');
    } catch (error) {
        console.error('[Database] ❌ Connection failed:', error);
        return;
    }

    try {
        console.log('\n[Step 7] Updating PR_ADTRANSLN with new PPh21 amounts...');
        console.log('='.repeat(80));

        let updatedCount = 0;
        let notFoundCount = 0;
        let zeroTaxCount = 0;
        let errorCount = 0;

        for (const employee of taxMappings) {
            const pph21Amount = employee.pph21_amount || 0;

            console.log(`\n[NRS] ${employee.emp_code} - ${employee.emp_name}`);
            console.log(`  PPh21 Amount: ${formatRupiah(pph21Amount)}`);

            if (pph21Amount === 0) {
                console.log(`  ⚠️  Pajak nol, dilewati`);
                zeroTaxCount++;
                continue;
            }

            // Find existing PPh21 records
            const records = await findPPH21Records(pool, employee.emp_code);

            if (records.length === 0) {
                console.log(`  ⚠️  Tidak ada record PPh21 di database`);
                notFoundCount++;
                continue;
            }

            console.log(`  ✓ Ditemukan ${records.length} record PPh21`);

            // Update all matching records
            let empUpdatedCount = 0;
            for (const record of records) {
                try {
                    const oldAmount = record.Amount || 0;
                    const success = await updatePPH21Amount(
                        pool,
                        record.MasterID,
                        pph21Amount
                    );

                    if (success) {
                        empUpdatedCount++;
                        console.log(`    ✓ Updated MasterID ${record.MasterID}: ${formatRupiah(oldAmount)} → ${formatRupiah(pph21Amount)}`);
                    }
                } catch (error) {
                    console.error(`    ❌ Gagal update MasterID ${record.MasterID}:`, error);
                    errorCount++;
                }
            }

            if (empUpdatedCount > 0) {
                updatedCount++;
                console.log(`  ✅ Berhasil update ${empUpdatedCount} record`);
            }
        }

        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('[Summary] NRS PPh21 Update Complete');
        console.log('='.repeat(80));

        console.log(`\nTotal Employees: ${taxMappings.length}`);
        console.log(`✅ Updated: ${updatedCount}`);
        console.log(`⚠️  Not Found: ${notFoundCount}`);
        console.log(`⏭️  Zero Tax: ${zeroTaxCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`\nTotal PPh21 Updated: ${formatRupiah(totalPph21)}`);

        // Save summary
        const summary = {
            timestamp: new Date().toISOString(),
            division: 'NRS',
            gang: 'B2N',
            period: { month, year },
            total_employees: taxMappings.length,
            total_updated: updatedCount,
            total_not_found: notFoundCount,
            total_zero_tax: zeroTaxCount,
            total_errors: errorCount,
            total_gross_income: totalGrossIncome,
            total_pph21_ter: totalPph21
        };

        const summaryFile = path.join(OUTPUT_DIR, 'NRS_update_summary.json');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
        console.log(`\n[Summary] Saved to: ${summaryFile}`);

    } catch (error) {
        console.error('\n❌ Update failed:', error);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n[Database] Connection closed');
        }
    }
}

// Run the script
extractAndUpdateNRS()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
