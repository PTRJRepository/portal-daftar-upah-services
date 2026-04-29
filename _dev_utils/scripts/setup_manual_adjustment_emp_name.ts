import { Database } from '../../backend/src/db/client';

async function run() {
    const extendDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();

    await extendDb.query(`
        IF COL_LENGTH('dbo.payroll_manual_adjustments', 'emp_name') IS NULL
        BEGIN
            ALTER TABLE dbo.payroll_manual_adjustments ADD emp_name VARCHAR(150) NULL;
        END
    `);

    const rows = await extendDb.query<any>(`
        SELECT id, RTRIM(emp_code) as emp_code
        FROM dbo.payroll_manual_adjustments
        WHERE ISNULL(RTRIM(emp_name), '') = ''
    `);

    let updated = 0;
    for (const row of rows) {
        const identity = await mainDb.queryOne<any>(`
            SELECT TOP 1 RTRIM(EmpName) as emp_name
            FROM HR_EMPLOYEE
            WHERE RTRIM(EmpCode) = ? OR RTRIM(ISNULL(NewICNo, '')) = ?
            ORDER BY EmpCode DESC
        `, [row.emp_code, row.emp_code]);

        const empName = String(identity?.emp_name || '').trim().toUpperCase();
        if (!empName) continue;

        await extendDb.query(`
            UPDATE dbo.payroll_manual_adjustments
            SET emp_name = ?
            WHERE id = ?
        `, [empName, row.id]);
        updated += 1;
    }

    console.log(JSON.stringify({ checked: rows.length, updated }, null, 2));
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
