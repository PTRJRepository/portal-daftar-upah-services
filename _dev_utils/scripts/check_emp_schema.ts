import { sql, connectDB } from '../../backend/src/config/database';

async function checkSchema() {
    try {
        const pool = await connectDB();
        if (!pool) throw new Error("Could not connect to DB");

        console.log("--- HR_EMPLOYEE ---");
        const hrEmp = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_EMPLOYEE'
              AND COLUMN_NAME LIKE '%jabat%' OR COLUMN_NAME LIKE '%job%' OR COLUMN_NAME LIKE '%pos%'
        `);
        console.table(hrEmp.recordset);

        console.log("--- history_hr_employee ---");
        const histHrEmp = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'history_hr_employee'
              AND COLUMN_NAME LIKE '%jabat%' OR COLUMN_NAME LIKE '%job%' OR COLUMN_NAME LIKE '%pos%'
        `);
        console.table(histHrEmp.recordset);

        console.log("--- ANY JABATAN TABLE ---");
        const tables = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%jabat%' OR TABLE_NAME LIKE '%job%'
        `);
        console.table(tables.recordset);

        console.log("--- HR_EMPLOYEE FULL DUMP ---");
        const allCols = await pool.request().query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_EMPLOYEE'
        `);
        console.log(allCols.recordset.map(r => r.COLUMN_NAME).join(', '));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSchema();
