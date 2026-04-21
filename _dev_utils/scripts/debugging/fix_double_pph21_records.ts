/**
 * Fix double PPH21 records for C0636 and C0303
 */

import sql from 'mssql';

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
    }
};

async function main() {
    console.log('Checking C0636 and C0303 for double records...\n');
    const pool = await sql.connect(DB_CONFIG);

    const employees = ['C0636', 'C0303'];

    for (const empCode of employees) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Employee: ${empCode}`);
        console.log('='.repeat(80));

        // Find all PPH21 records
        const result = await pool.request()
            .input('empCode', sql.VarChar, empCode)
            .query(`
                SELECT 
                    t.ID,
                    t.DocID,
                    t.DocDesc,
                    t.CreatedBy,
                    t.CreatedDate,
                    t.UpdatedBy,
                    t.UpdatedDate,
                    ln.Amount
                FROM PR_ADTRANS t
                INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) = @empCode
                AND (
                    t.DocDesc LIKE '%PPH%'
                    OR t.DocDesc LIKE '%Pph%'
                )
                ORDER BY t.DocDate DESC
            `);

        console.log(`Found ${result.recordset.length} record(s):\n`);
        result.recordset.forEach((r, i) => {
            console.log(`  Record ${i + 1}:`);
            console.log(`    ID: ${r.ID}`);
            console.log(`    DocID: ${r.DocID}`);
            console.log(`    DocDesc: "${r.DocDesc}"`);
            console.log(`    Amount: Rp ${r.Amount?.toLocaleString('id-ID')}`);
            console.log(`    CreatedBy: ${r.CreatedBy}`);
            console.log(`    CreatedDate: ${r.CreatedDate}`);
            console.log(`    UpdatedBy: ${r.UpdatedBy}`);
            console.log(`    UpdatedDate: ${r.UpdatedDate}\n`);
        });

        if (result.recordset.length === 2) {
            // Find which one has the correct amount (not TAX_MAPPING_SCRIPT)
            const records = result.recordset;
            const originalRecord = records.find(r => r.CreatedBy !== 'TAX_MAPPING_SCRIPT');
            const duplicateRecord = records.find(r => r.CreatedBy === 'TAX_MAPPING_SCRIPT');

            if (duplicateRecord && originalRecord) {
                console.log(`⚠️  DUPLICATE DETECTED!`);
                console.log(`   Original: ID ${originalRecord.ID} by ${originalRecord.CreatedBy}`);
                console.log(`   Duplicate: ID ${duplicateRecord.ID} by ${duplicateRecord.CreatedBy}`);

                // Delete the duplicate (the one created by TAX_MAPPING_SCRIPT)
                console.log(`\n🗑️  Deleting duplicate record ID ${duplicateRecord.ID}...`);
                await pool.request()
                    .input('masterId', sql.BigInt, duplicateRecord.ID)
                    .query(`DELETE FROM PR_ADTRANSLN WHERE MasterID = @masterId`);

                await pool.request()
                    .input('id', sql.BigInt, duplicateRecord.ID)
                    .query(`DELETE FROM PR_ADTRANS WHERE ID = @id`);

                console.log(`✅ Deleted duplicate successfully!\n`);
            } else {
                console.log(`❌ Cannot determine which is the duplicate. Manual review needed.`);
            }
        }
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
