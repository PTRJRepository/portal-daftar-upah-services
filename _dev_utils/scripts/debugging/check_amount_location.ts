/**
 * Debug - Check where amount is stored
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

    // Check PR_TASKREGLN structure
    console.log('PR_TASKREGLN columns:');
    const columnsResult = await pool.request().query(`
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'PR_TASKREGLN'
        ORDER BY ORDINAL_POSITION
    `);

    console.table(columnsResult.recordset);

    // Check PPH21 records in PR_TASKREGLN
    console.log('\nPPH21 records in PR_TASKREGLN:');
    const pphResult = await pool.request().query(`
        SELECT TOP 10 *
        FROM PR_TASKREGLN
        WHERE DocDesc LIKE '%PPH%' OR DocDesc LIKE '%Pph%'
        ORDER BY TrxDate DESC
    `);

    if (pphResult.recordset.length > 0) {
        console.log(JSON.stringify(pphResult.recordset.slice(0, 3), null, 2));
    }

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
