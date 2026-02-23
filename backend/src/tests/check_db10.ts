import { Database } from '../db/client';

async function test() {
    try {
        const originDb = Database.getInstance();
        const empCols = await originDb.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_EMPLOYEE'
        `);
        const prCols = await originDb.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'HR_PAYROLL'
        `);

        console.log("HR_EMPLOYEE columns:", empCols.map(c => c.COLUMN_NAME).join(', '));
        console.log("HR_PAYROLL columns:", prCols.map(c => c.COLUMN_NAME).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
