/**
 * Update PPh21 Amount di PR_ADTRANSLN dari Hasil Ekstraksi Pajak TER
 *
 * Script ini:
 * 1. Membaca file JSON dari update_pajak/{DIVISION}_pajak.json
 * 2. Untuk setiap employee, cari record PPh21 di PR_ADTRANS + PR_ADTRANSLN
 * 3. Update Amount di PR_ADTRANSLN dengan pph21_amount dari JSON
 * 4. HANYA mengubah Amount, tidak mengubah field lain
 *
 * Database: db_ptrj (Server 2: 10.0.0.2:1888)
 * Tables: PR_ADTRANS (header) + PR_ADTRANSLN (detail)
 *
 * Usage: 
 *   cd update_pajak
 *   node update_pph21_database.js
 * 
 * ATAU dari root:
 *   bun run update_pajak/update_pph21_database.js
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

const UPDATE_PAJAK_DIR = path.resolve(__dirname);

// PPH21 DocDesc patterns untuk mencocokkan record PPh21
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
// Helper Functions
// ============================================================

async function findPPH21Records(pool, empCode) {
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

async function updatePPH21Amount(pool, masterId, newAmount, empCode) {
    // HANYA update Amount - TIDAK UBAH field lain!
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

async function processDivision(pool, divisionCode, taxData) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Division ${divisionCode}] Memproses ${taxData.length} karyawan...`);
    console.log('='.repeat(80));

    const result = {
        division_code: divisionCode,
        total_employees: taxData.length,
        total_updated: 0,
        total_not_found: 0,
        total_errors: 0,
        total_zero_tax: 0,
        results: []
    };

    for (const employee of taxData) {
        const empResult = {
            emp_code: employee.emp_code,
            emp_name: employee.emp_name,
            pph21_amount: employee.pph21_amount,
            records_found: 0,
            records_updated: 0,
            status: 'not_found'
        };

        try {
            const pph21Amount = employee.pph21_amount || 0;

            console.log(`\n[${divisionCode}] ${employee.emp_code} - ${employee.emp_name}`);
            console.log(`  PPh21 Amount: Rp ${pph21Amount.toLocaleString('id-ID')}`);

            if (pph21Amount === 0) {
                console.log(`  ⚠️  Pajak nol, dilewati`);
                result.total_zero_tax++;
                empResult.status = 'zero_tax';
                result.results.push(empResult);
                continue;
            }

            // Cari record PPh21 yang ada
            const records = await findPPH21Records(pool, employee.emp_code);
            empResult.records_found = records.length;

            if (records.length === 0) {
                console.log(`  ⚠️  Tidak ada record PPh21 di PR_ADTRANS`);
                result.total_not_found++;
                result.results.push(empResult);
                continue;
            }

            console.log(`  ✓ Ditemukan ${records.length} record PPh21`);

            // Update semua record yang cocok
            let updatedCount = 0;
            for (const record of records) {
                try {
                    const oldAmount = record.Amount || 0;
                    const success = await updatePPH21Amount(
                        pool,
                        record.MasterID,
                        pph21Amount,
                        employee.emp_code
                    );

                    if (success) {
                        updatedCount++;
                        console.log(`    ✓ Updated MasterID ${record.MasterID}: Rp ${oldAmount.toLocaleString('id-ID')} → Rp ${pph21Amount.toLocaleString('id-ID')}`);
                    }
                } catch (error) {
                    console.error(`    ❌ Gagal update MasterID ${record.MasterID}:`, error.message);
                }
            }

            empResult.records_updated = updatedCount;
            empResult.status = updatedCount > 0 ? 'success' : 'error';

            if (updatedCount > 0) {
                result.total_updated++;
                console.log(`  ✅ Berhasil update ${updatedCount} record`);
            } else {
                result.total_errors++;
                console.log(`  ❌ Tidak ada record yang diupdate`);
            }

        } catch (error) {
            empResult.status = 'error';
            empResult.error_message = error.message;
            result.total_errors++;
            console.error(`  ❌ Error memproses ${employee.emp_code}:`, error.message);
        }

        result.results.push(empResult);
    }

    return result;
}

// ============================================================
// Main Logic
// ============================================================

async function main() {
    console.log('='.repeat(80));
    console.log('[UPDATE PPh21] Update PPh21 Amount ke PR_ADTRANSLN');
    console.log('='.repeat(80));
    console.log('\nKonfigurasi:');
    console.log(`  Server: ${DB_CONFIG.server}:${DB_CONFIG.port}`);
    console.log(`  Database: ${DB_CONFIG.database}`);
    console.log(`  User: ${DB_CONFIG.user}`);
    console.log(`  Directory: ${UPDATE_PAJAK_DIR}`);

    // Connect ke database
    console.log('\n[Database] Menghubungkan ke SQL Server...');
    let pool = null;

    try {
        pool = await sql.connect(DB_CONFIG);
        console.log('[Database] ✓ Terhubung');
    } catch (error) {
        console.error('[Database] ❌ Koneksi gagal:', error.message);
        process.exit(1);
    }

    try {
        // Baca semua file JSON divisi
        const files = fs.readdirSync(UPDATE_PAJAK_DIR);
        const divisionFiles = files.filter(f => f.endsWith('_pajak.json'));

        if (divisionFiles.length === 0) {
            console.log('\n⚠️  Tidak ada file JSON divisi di', UPDATE_PAJAK_DIR);
            console.log('Jalankan extract_pph21_ter.ts terlebih dahulu.');
            process.exit(1);
        }

        console.log(`\n[File] Ditemukan ${divisionFiles.length} file divisi:`);
        divisionFiles.forEach(f => console.log(`  - ${f}`));

        const allResults = [];

        // Proses setiap divisi
        for (const file of divisionFiles) {
            const divisionCode = file.replace('_pajak.json', '');
            const filePath = path.join(UPDATE_PAJAK_DIR, file);

            console.log(`\n${'='.repeat(80)}`);
            console.log(`[File] Memuat: ${filePath}`);
            console.log('='.repeat(80));

            try {
                const rawData = fs.readFileSync(filePath, 'utf-8');
                const taxData = JSON.parse(rawData);

                if (!Array.isArray(taxData)) {
                    console.error(`[File] Format JSON salah untuk ${file}`);
                    continue;
                }

                console.log(`[File] ✓ Dimuat ${taxData.length} record karyawan`);

                // Update divisi ini
                const divisionResult = await processDivision(pool, divisionCode, taxData);
                allResults.push(divisionResult);

            } catch (error) {
                console.error(`[File] ❌ Error memproses ${file}:`, error.message);
            }
        }

        // Generate summary
        console.log('\n' + '='.repeat(80));
        console.log('[Summary] Update Selesai');
        console.log('='.repeat(80));

        const grandTotal = {
            employees: 0,
            updated: 0,
            not_found: 0,
            errors: 0,
            zero_tax: 0
        };

        console.log('\n' + '-'.repeat(80));
        console.log(
            'Division'.padEnd(12) +
            'Total'.padEnd(10) +
            'Updated'.padEnd(12) +
            'Not Found'.padEnd(12) +
            'Zero Tax'.padEnd(12) +
            'Errors'
        );
        console.log('-'.repeat(80));

        for (const divResult of allResults) {
            grandTotal.employees += divResult.total_employees;
            grandTotal.updated += divResult.total_updated;
            grandTotal.not_found += divResult.total_not_found;
            grandTotal.errors += divResult.total_errors;
            grandTotal.zero_tax += divResult.total_zero_tax;

            console.log(
                divResult.division_code.padEnd(12) +
                String(divResult.total_employees).padEnd(10) +
                String(divResult.total_updated).padEnd(12) +
                String(divResult.total_not_found).padEnd(12) +
                String(divResult.total_zero_tax).padEnd(12) +
                String(divResult.total_errors)
            );
        }

        console.log('-'.repeat(80));
        console.log('\n[Grand Total]');
        console.log(`  Total Karyawan: ${grandTotal.employees}`);
        console.log(`  ✅ Berhasil Update: ${grandTotal.updated}`);
        console.log(`  ⚠️  Tidak Ditemukan: ${grandTotal.not_found}`);
        console.log(`  ⏭️  Pajak Nol: ${grandTotal.zero_tax}`);
        console.log(`  ❌ Error: ${grandTotal.errors}`);
        console.log('-'.repeat(80));

        // Simpan summary
        const summary = {
            timestamp: new Date().toISOString(),
            database: `${DB_CONFIG.server}:${DB_CONFIG.port}/${DB_CONFIG.database}`,
            grand_total: grandTotal,
            divisions: allResults.map(r => ({
                division_code: r.division_code,
                total_employees: r.total_employees,
                total_updated: r.total_updated,
                total_not_found: r.total_not_found,
                total_zero_tax: r.total_zero_tax,
                total_errors: r.total_errors
            }))
        };

        const summaryPath = path.join(UPDATE_PAJAK_DIR, '_update_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
        console.log(`\n[Summary] Disimpan ke: ${summaryPath}`);

        console.log('\n✅ Selesai!');

    } catch (error) {
        console.error('\n❌ Script gagal:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Tutup koneksi database
        if (pool) {
            await pool.close();
            console.log('\n[Database] Koneksi ditutup');
        }
    }
}

// Jalankan script
main()
    .then(() => {
        console.log('\n✅ Script selesai dengan sukses');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script gagal:', error);
        process.exit(1);
    });
