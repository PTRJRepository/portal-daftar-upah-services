const { Database } = require('./src/db/client');
const { EmployeeEstateService } = require('./src/services/employeeEstateService');

async function testStatus() {
    try {
        const db = Database.getExtendedInstance();
        await EmployeeEstateService.initTable();

        console.log("1. Setting to mandor panen");
        await EmployeeEstateService.updateJobTitle("EMP123", "mandor panen");

        console.log("2. Waiting 1 second");
        await new Promise(r => setTimeout(r, 1000));

        console.log("3. Changing to kerani buah");
        await EmployeeEstateService.updateJobTitle("EMP123", "kerani buah");

        const history = await db.query("SELECT * FROM history_employee_jabatan_changelog WHERE empcode='EMP123'");
        console.table(history);

        // Clean up
        await db.query("DELETE FROM history_employee_jabatan_changelog WHERE empcode='EMP123'");
        await db.query("DELETE FROM employee_estate WHERE empcode='EMP123'");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testStatus();
