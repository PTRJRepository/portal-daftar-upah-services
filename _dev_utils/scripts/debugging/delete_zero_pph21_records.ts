/**
 * DELETE PPH21 records that were incorrectly inserted with Amount = 0
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

const EMPLOYEES_WITH_ZERO_PP21 = [
    'G0572', 'G0612', 'G0613', 'G0614', 'G0615',
    'H0546', 'H0547', 'H0551',
    'F0510',
    'J0808', 'J0848', 'J0850', 'J0852', 'J0853', 'J0854', 'J0855', 'J0856',
    'E0581', 'E0602', 'E0590', 'E0595', 'E0610',
    'L0112', 'L0108',
    'B0753', 'B0736', 'B0742', 'B0720', 'B0735', 'B0737', 'B0738', 'B0739',
    'B0741', 'B0743', 'B0746', 'B0748', 'B0749', 'B0750', 'B0751', 'B0752',
    'C0645', 'C0683', 'C0746', 'C0747', 'C0748', 'C0749', 'C0750', 'C0751',
    'C0754', 'C0759', 'C0725', 'C0745', 'C0487', 'C0672', 'C0755', 'C0756', 'C0758',
    'D0380'
];

async function main() {
    console.log('='.repeat(80));
    console.log('DELETE Incorrectly Inserted PPH21 Records (Amount = 0)');
    console.log('='.repeat(80));

    console.log('\nConnecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const empCode of EMPLOYEES_WITH_ZERO_PP21) {
        try {
            // Check if employee has PPH21 record with Amount = 0
            const checkQuery = `
                SELECT t.ID
                FROM PR_ADTRANS t
                INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) = @empCode
                AND (
                    t.DocDesc LIKE '%Potongan Pph21%'
                    OR t.DocDesc LIKE '%Potongan PPH 21%'
                    OR t.DocDesc LIKE '%Potongan PPH21%'
                    OR t.DocDesc LIKE '%PPH 21%'
                    OR t.DocDesc LIKE '%PPH21%'
                    OR t.DocDesc LIKE '%POTONGAN PPH%'
                )
                AND ln.Amount = 0
            `;

            const checkResult = await pool.request()
                .input('empCode', sql.VarChar, empCode)
                .query(checkQuery);

            if (checkResult.recordset.length > 0) {
                const id = checkResult.recordset[0].ID;

                // Delete detail first
                await pool.request()
                    .input('masterId', sql.BigInt, id)
                    .query(`DELETE FROM PR_ADTRANSLN WHERE MasterID = @masterId`);

                // Delete header
                await pool.request()
                    .input('id', sql.BigInt, id)
                    .query(`DELETE FROM PR_ADTRANS WHERE ID = @id`);

                console.log(`✅ Deleted ${empCode} (ID: ${id})`);
                deletedCount++;
            } else {
                console.log(`⚪ ${empCode} - No zero-amount PPH21 record found (already correct)`);
            }
        } catch (error) {
            console.error(`❌ Error deleting ${empCode}: ${error}`);
            errorCount++;
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Delete Summary:');
    console.log(`  Total checked: ${EMPLOYEES_WITH_ZERO_PP21.length}`);
    console.log(`  ✅ Deleted: ${deletedCount}`);
    console.log(`  ⚪ Skipped: ${EMPLOYEES_WITH_ZERO_PP21.length - deletedCount - errorCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
