/**
 * Debug script untuk cek struktur PR_ADTRANS
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

    // Get table structure
    console.log('PR_ADTRANS columns:');
    const columnsResult = await pool.request().query(`
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'PR_ADTRANS'
        ORDER BY ORDINAL_POSITION
    `);

    console.table(columnsResult.recordset);

    // Sample some records
    console.log('\nSample PR_ADTRANS records (top 5):');
    const sampleResult = await pool.request().query(`
        SELECT TOP 5 *
        FROM PR_ADTRANS
        ORDER BY DocDate DESC
    `);

    if (sampleResult.recordset.length > 0) {
        console.log(JSON.stringify(sampleResult.recordset, null, 2));
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
