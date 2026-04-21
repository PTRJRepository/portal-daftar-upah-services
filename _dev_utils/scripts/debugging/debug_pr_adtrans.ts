/**
 * Debug script untuk cek isi PR_ADTRANS
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
    console.log('Connecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    // Check total records
    const totalResult = await pool.request().query(`SELECT COUNT(*) as total FROM PR_ADTRANS`);
    console.log(`Total records in PR_ADTRANS: ${totalResult.recordset[0].total}\n`);

    // Check PPH21 records
    const pphResult = await pool.request().query(`
        SELECT COUNT(*) as total
        FROM PR_ADTRANS
        WHERE DocDesc LIKE '%PPH%' OR DocDesc LIKE '%Pph%' OR DocDesc LIKE '%pph%'
    `);
    console.log(`Records with PPH in DocDesc: ${pphResult.recordset[0].total}\n`);

    // Sample some PPH21 records
    const sampleResult = await pool.request().query(`
        SELECT TOP 10
            ID,
            DocID,
            DocDate,
            DocDesc,
            EmpCode,
            EmpName,
            Amount,
            AccMonth,
            AccYear,
            PhyMonth,
            PhyYear
        FROM PR_ADTRANS
        WHERE DocDesc LIKE '%PPH%' OR DocDesc LIKE '%Pph%'
        ORDER BY DocDate DESC
    `);

    console.log('Sample PPH21 records:');
    console.table(sampleResult.recordset);

    // Check specific employee
    const empCode = 'A0001';
    const empResult = await pool.request()
        .input('empCode', sql.VarChar, empCode)
        .query(`
            SELECT 
                ID,
                DocID,
                DocDate,
                DocDesc,
                EmpCode,
                EmpName,
                Amount,
                AccMonth,
                AccYear,
                PhyMonth,
                PhyYear
            FROM PR_ADTRANS
            WHERE EmpCode = @empCode
            ORDER BY DocDate DESC
        `);

    console.log(`\nRecords for employee ${empCode}:`);
    console.table(empResult.recordset);

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
