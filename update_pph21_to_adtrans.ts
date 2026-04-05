/**
 * Update PPh21 di PR_ADTRANS berdasarkan hasil perhitungan TER
 * 
 * Koneksi: Langsung ke Server 2 (db_ptrj) via ODBC Driver 17
 * 
 * Alur:
 * 1. Baca JSON file dari update_pajak/{DIVISION}_pajak.json
 * 2. Untuk setiap emp_code, cari record di PR_ADTRANS dengan:
 *    - EmpCode = emp_code dari JSON
 *    - DocDesc mengandung: "Potongan Pph21", "Potongan PPH 21", "PPH 21", "PPH21", "POTONGAN PPH"
 * 3. Update Amount = pph21_amount dari JSON
 * 
 * Usage: bun run update_pph21_to_adtrans.ts
 */

import sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Configuration - Server 2 Direct Connection
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

const UPDATE_PAJAK_DIR = './update_pajak';

// PPH21 DocDesc patterns to match
const PPH21_PATTERNS = [
    '%Potongan Pph21%',
    '%Potongan PPH 21%',
    '%PPH 21%',
    '%PPH21%',
    '%POTONGAN PPH%'
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
}

interface UpdateResult {
    emp_code: string;
    emp_name: string;
    pph21_ter: number;
    records_found: number;
    records_updated: number;
    status: 'success' | 'not_found' | 'error';
    error_message?: string;
}

interface DivisionResult {
    division_code: string;
    total_employees: number;
    total_updated: number;
    total_not_found: number;
    total_errors: number;
    results: UpdateResult[];
}

// ============================================================
// Helper Functions
// ============================================================

function buildDocDescFilter(): string {
    return PPH21_PATTERNS.map((pattern, idx) => 
        `DocDesc LIKE ?`
    ).join(' OR ');
}

async function findPPH21Records(pool: sql.Pool, empCode: string): Promise<any[]> {
    const docDescFilter = buildDocDescFilter();
    
    const query = `
        SELECT 
            ID,
            DocID,
            DocDate,
            DocDesc,
            EmpCode,
            EmpName,
            LocCode,
            AccMonth,
            AccYear,
            PhyMonth,
            PhyYear,
            Status,
            Amount
        FROM PR_ADTRANS
        WHERE EmpCode = ?
        AND (${docDescFilter})
        ORDER BY DocDate DESC
    `;

    const request = pool.request();
    request.input(1, sql.VarChar, empCode);
    
    // Add DocDesc pattern parameters
    PPH21_PATTERNS.forEach((pattern, idx) => {
        request.input(idx + 2, sql.VarChar, pattern);
    });

    const result = await request.query(query);
    return result.recordset;
}

async function updatePPH21Amount(
    pool: sql.Pool, 
    recordId: number, 
    newAmount: number,
    empCode: string
): Promise<boolean> {
    const query = `
        UPDATE PR_ADTRANS
        SET 
            Amount = ?,
            UpdatedDate = GETDATE(),
            UpdatedBy = 'TAX_MAPPING_SCRIPT'
        WHERE ID = ?
    `;

    const request = pool.request();
    request.input(1, sql.Decimal(18, 2), newAmount);
    request.input(2, sql.Int, recordId);

    const result = await request.query(query);
    return result.rowsAffected[0] > 0;
}

// ============================================================
// Main Logic
// ============================================================

async function updateDivision(
    pool: sql.Pool,
    divisionCode: string,
    taxData: TaxMappingRow[]
): Promise<DivisionResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Division ${divisionCode}] Processing ${taxData.length} employees...`);
    console.log('='.repeat(80));

    const result: DivisionResult = {
        division_code: divisionCode,
        total_employees: taxData.length,
        total_updated: 0,
        total_not_found: 0,
        total_errors: 0,
        results: []
    };

    for (const employee of taxData) {
        const updateResult: UpdateResult = {
            emp_code: employee.emp_code,
            emp_name: employee.emp_name,
            pph21_ter: employee.pph21_amount,
            records_found: 0,
            records_updated: 0,
            status: 'not_found'
        };

        try {
            console.log(`\n[${divisionCode}] Processing: ${employee.emp_code} - ${employee.emp_name}`);
            console.log(`  PPh21 TER: Rp ${employee.pph21_amount.toLocaleString('id-ID')}`);

            // Find existing PPH21 records
            const records = await findPPH21Records(pool, employee.emp_code);
            updateResult.records_found = records.length;

            if (records.length === 0) {
                console.log(`  ⚠️  No PPH21 records found in PR_ADTRANS`);
                result.total_not_found++;
                result.results.push(updateResult);
                continue;
            }

            console.log(`  ✓ Found ${records.length} PPH21 record(s)`);

            // Update all matching records
            let updatedCount = 0;
            for (const record of records) {
                try {
                    const success = await updatePPH21Amount(
                        pool,
                        record.ID,
                        employee.pph21_amount,
                        employee.emp_code
                    );

                    if (success) {
                        updatedCount++;
                        console.log(`    ✓ Updated ID ${record.ID}: Rp ${record.Amount?.toLocaleString('id-ID')} → Rp ${employee.pph21_amount.toLocaleString('id-ID')}`);
                    }
                } catch (error) {
                    console.error(`    ❌ Failed to update ID ${record.ID}:`, error);
                }
            }

            updateResult.records_updated = updatedCount;
            updateResult.status = updatedCount > 0 ? 'success' : 'error';

            if (updatedCount > 0) {
                result.total_updated++;
                console.log(`  ✅ Successfully updated ${updatedCount} record(s)`);
            } else {
                result.total_errors++;
                console.log(`  ❌ No records were updated`);
            }

        } catch (error) {
            updateResult.status = 'error';
            updateResult.error_message = error instanceof Error ? error.message : String(error);
            result.total_errors++;
            console.error(`  ❌ Error processing ${employee.emp_code}:`, error);
        }

        result.results.push(updateResult);
    }

    return result;
}

async function main() {
    console.log('='.repeat(80));
    console.log('[PPh21 Update] Starting PPh21 Update to PR_ADTRANS');
    console.log('='.repeat(80));
    console.log('\nConfiguration:');
    console.log(`  Server: ${DB_CONFIG.server}:${DB_CONFIG.port}`);
    console.log(`  Database: ${DB_CONFIG.database}`);
    console.log(`  User: ${DB_CONFIG.user}`);
    console.log(`  Directory: ${UPDATE_PAJAK_DIR}`);

    // Connect to database
    console.log('\n[Database] Connecting to SQL Server...');
    let pool: sql.Pool | null = null;

    try {
        pool = await sql.connect(DB_CONFIG);
        console.log('[Database] ✓ Connected successfully');
    } catch (error) {
        console.error('[Database] ❌ Connection failed:', error);
        process.exit(1);
    }

    try {
        // Get all division JSON files
        const files = fs.readdirSync(UPDATE_PAJAK_DIR);
        const divisionFiles = files.filter(f => f.endsWith('_pajak.json'));

        if (divisionFiles.length === 0) {
            console.log('\n⚠️  No division JSON files found in', UPDATE_PAJAK_DIR);
            console.log('Please run generate_tax_mapping.ts first.');
            process.exit(1);
        }

        console.log(`\n[Files] Found ${divisionFiles.length} division file(s):`);
        divisionFiles.forEach(f => console.log(`  - ${f}`));

        const allResults: DivisionResult[] = [];

        // Process each division
        for (const file of divisionFiles) {
            const divisionCode = file.replace('_pajak.json', '');
            const filePath = path.join(UPDATE_PAJAK_DIR, file);

            console.log(`\n${'='.repeat(80)}`);
            console.log(`[File] Loading: ${filePath}`);
            console.log('='.repeat(80));

            try {
                const rawData = fs.readFileSync(filePath, 'utf-8');
                const taxData: TaxMappingRow[] = JSON.parse(rawData);

                console.log(`[File] ✓ Loaded ${taxData.length} employee records`);

                // Update this division
                const divisionResult = await updateDivision(pool, divisionCode, taxData);
                allResults.push(divisionResult);

            } catch (error) {
                console.error(`[File] ❌ Error processing ${file}:`, error);
            }
        }

        // Generate final summary
        console.log('\n' + '='.repeat(80));
        console.log('[Summary] Update Complete');
        console.log('='.repeat(80));

        const grandTotal = {
            employees: 0,
            updated: 0,
            not_found: 0,
            errors: 0
        };

        for (const divResult of allResults) {
            grandTotal.employees += divResult.total_employees;
            grandTotal.updated += divResult.total_updated;
            grandTotal.not_found += divResult.total_not_found;
            grandTotal.errors += divResult.total_errors;

            console.log(`\n[Division ${divResult.division_code}]`);
            console.log(`  Total Employees: ${divResult.total_employees}`);
            console.log(`  ✅ Updated: ${divResult.total_updated}`);
            console.log(`  ⚠️  Not Found: ${divResult.total_not_found}`);
            console.log(`  ❌ Errors: ${divResult.total_errors}`);
        }

        console.log('\n' + '-'.repeat(80));
        console.log('[Grand Total]');
        console.log(`  Total Employees Processed: ${grandTotal.employees}`);
        console.log(`  ✅ Total Updated: ${grandTotal.updated}`);
        console.log(`  ⚠️  Total Not Found: ${grandTotal.not_found}`);
        console.log(`  ❌ Total Errors: ${grandTotal.errors}`);
        console.log('-'.repeat(80));

        // Save summary
        const summary = {
            timestamp: new Date().toISOString(),
            grand_total: grandTotal,
            divisions: allResults.map(r => ({
                division_code: r.division_code,
                total_employees: r.total_employees,
                total_updated: r.total_updated,
                total_not_found: r.total_not_found,
                total_errors: r.total_errors
            }))
        };

        const summaryPath = path.join(UPDATE_PAJAK_DIR, '_update_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
        console.log(`\n[Summary] Saved to: ${summaryPath}`);

    } catch (error) {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (pool) {
            await pool.close();
            console.log('\n[Database] Connection closed');
        }
    }
}

// Run the script
main()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
