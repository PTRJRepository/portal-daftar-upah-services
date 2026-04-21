/**
 * Delete the duplicate records for C0636 and C0303
 * Keep the OLDER records (Apr 2), delete the NEWER ones (Apr 4)
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
    console.log('Deleting duplicate PPH21 records...\n');
    const pool = await sql.connect(DB_CONFIG);

    // These are the newer duplicate records (created Apr 4)
    const duplicateIds = [673221, 673260];

    for (const id of duplicateIds) {
        console.log(`Deleting record ID ${id}...`);
        try {
            await pool.request()
                .input('masterId', sql.BigInt, id)
                .query(`DELETE FROM PR_ADTRANSLN WHERE MasterID = @masterId`);

            await pool.request()
                .input('id', sql.BigInt, id)
                .query(`DELETE FROM PR_ADTRANS WHERE ID = @id`);

            console.log(`✅ Deleted ID ${id}\n`);
        } catch (error) {
            console.error(`❌ Failed to delete ID ${id}: ${error}\n`);
        }
    }

    await pool.close();
    console.log('Done!');
}

main().catch(console.error);
