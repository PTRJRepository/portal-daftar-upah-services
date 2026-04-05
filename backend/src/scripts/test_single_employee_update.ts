/**
 * Test update PPh21 untuk 1 employee
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

const PPH21_PATTERNS = [
    '%Potongan Pph21%',
    '%Potongan PPH 21%',
    '%PPH 21%',
    '%PPH21%',
    '%POTONGAN PPH%'
];

async function main() {
    console.log('Connecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    // Test employee
    const empCode = 'A0153';
    const newAmount = 90694;

    console.log(`Searching PPH21 records for employee: ${empCode}`);

    const query = `
        SELECT 
            t.ID,
            t.DocID,
            t.DocDate,
            t.DocDesc,
            t.EmpCode,
            t.EmpName,
            ln.Amount
        FROM PR_ADTRANS t
        INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(t.EmpCode) = @empCode
        AND (
            t.DocDesc LIKE @pattern1
            OR t.DocDesc LIKE @pattern2
            OR t.DocDesc LIKE @pattern3
            OR t.DocDesc LIKE @pattern4
            OR t.DocDesc LIKE @pattern5
        )
        ORDER BY t.DocDate DESC
    `;

    console.log('Query:', query);
    console.log('\nParameters:');
    console.log('  empCode:', empCode);
    PPH21_PATTERNS.forEach((p, i) => console.log(`  pattern${i + 1}:`, p));

    const request = pool.request();
    request.input('empCode', sql.VarChar, empCode);
    request.input('pattern1', sql.VarChar, PPH21_PATTERNS[0]);
    request.input('pattern2', sql.VarChar, PPH21_PATTERNS[1]);
    request.input('pattern3', sql.VarChar, PPH21_PATTERNS[2]);
    request.input('pattern4', sql.VarChar, PPH21_PATTERNS[3]);
    request.input('pattern5', sql.VarChar, PPH21_PATTERNS[4]);

    try {
        const result = await request.query(query);
        console.log(`\nFound ${result.recordset.length} record(s):\n`);

        if (result.recordset.length > 0) {
            console.table(result.recordset);

            // Try update first record
            const firstRecord = result.recordset[0];
            console.log(`\nAttempting to update ID ${firstRecord.ID}...`);
            console.log(`Current Amount: ${firstRecord.Amount}`);
            console.log(`New Amount: ${newAmount}`);

            const updateQuery = `
                UPDATE PR_ADTRANSLN
                SET 
                    Amount = @newAmount,
                    UpdatedDate = GETDATE(),
                    UpdatedBy = 'TEST_SCRIPT'
                WHERE MasterID = @masterId
            `;

            const updateRequest = pool.request();
            updateRequest.input('newAmount', sql.Decimal(18, 2), newAmount);
            updateRequest.input('masterId', sql.BigInt, firstRecord.ID);

            const updateResult = await updateRequest.query(updateQuery);
            console.log(`\nUpdate result:`);
            console.log(`  Rows affected: ${updateResult.rowsAffected}`);
            console.log(`  Success: ${updateResult.rowsAffected[0] > 0}`);

            // Verify update
            const verifyResult = await pool.request()
                .input('masterId', sql.BigInt, firstRecord.ID)
                .query(`
                    SELECT Amount, UpdatedBy, UpdatedDate
                    FROM PR_ADTRANSLN
                    WHERE MasterID = @masterId
                `);
            
            console.log('\nVerification:');
            console.table(verifyResult.recordset);
        } else {
            console.log('No PPH21 records found for this employee.');
            console.log('\nTrying broader search (any DocDesc with PPH):');
            
            const broaderQuery = `
                SELECT 
                    t.ID,
                    t.DocID,
                    t.DocDate,
                    t.DocDesc,
                    t.EmpCode,
                    ln.Amount
                FROM PR_ADTRANS t
                INNER JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
                WHERE RTRIM(t.EmpCode) = @empCode
                AND (t.DocDesc LIKE '%PPH%' OR t.DocDesc LIKE '%Pph%' OR t.DocDesc LIKE '%pph%')
            `;

            const broaderResult = await pool.request()
                .input('empCode', sql.VarChar, empCode)
                .query(broaderQuery);

            if (broaderResult.recordset.length > 0) {
                console.log(`\nFound ${broaderResult.recordset.length} record(s) with broader search:\n`);
                console.table(broaderResult.recordset);
            } else {
                console.log('Still no results. Employee may not have PPH21 records.');
            }
        }
    } catch (error) {
        console.error('\nError:', error);
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
