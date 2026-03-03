require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    }
};

async function checkSchema() {
    try {
        const pool = await sql.connect(config);

        console.log("--- HR_EMPLOYEE JABATAN COLS ---");
        const hrEmp = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_EMPLOYEE'
              AND (COLUMN_NAME LIKE '%jabat%' OR COLUMN_NAME LIKE '%job%' OR COLUMN_NAME LIKE '%pos%')
        `);
        console.table(hrEmp.recordset);

        console.log("--- ANY JABATAN TABLE ---");
        const tables = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%jabat%' OR TABLE_NAME LIKE '%job%'
        `);
        console.table(tables.recordset);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSchema();
