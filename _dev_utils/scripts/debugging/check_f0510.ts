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
    const empCode = 'F0510';

    console.log(`Checking employee: ${empCode}`);
    const pool = await sql.connect(DB_CONFIG);

    // Check if employee exists in HR
    const empResult = await pool.request()
        .input('empCode', sql.VarChar, empCode)
        .query(`SELECT EmpCode, EmpName FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = @empCode`);

    if (empResult.recordset.length === 0) {
        console.log(`❌ Employee NOT FOUND in HR_EMPLOYEE`);
        await pool.close();
        return;
    }

    console.log(`✓ Found in HR_EMPLOYEE: ${empResult.recordset[0].EmpName}`);

    // Check ADTRANS records
    const transResult = await pool.request()
        .input('empCode', sql.VarChar, empCode)
        .query(`
            SELECT t.ID, t.DocID, t.DocDesc, ln.Amount
            FROM PR_ADTRANS t
            LEFT JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE RTRIM(t.EmpCode) = @empCode
        `);

    console.log(`Total ADTRANS records: ${transResult.recordset.length}`);

    if (transResult.recordset.length > 0) {
        transResult.recordset.forEach(r => {
            console.log(`  - DocDesc: "${r.DocDesc}", Amount: ${r.Amount}`);
        });
    } else {
        console.log(`❌ NO records in PR_ADTRANS at all!`);
    }

    await pool.close();
}

main().catch(console.error);
