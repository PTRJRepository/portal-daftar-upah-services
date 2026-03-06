import { Database } from "../src/db/client";
import { OtherIncomesService } from "../src/services/otherIncomesService";
import { divisionDefinition } from "../src/services/divisionDefinition";

async function debugNRS() {
    const year = 2026;
    const month = 2;
    const division = 'NRS';
    const gang = 'B2N';

    console.log(`=== DEBUGGING NRS THR CALCULATION ===`);
    console.log(`Params: Year=${year}, Month=${month}, Div=${division}, Gang=${gang}`);

    const isVirtual = divisionDefinition.isVirtualDivision(division);
    console.log(`Is '${division}' virtual?`, isVirtual);
    
    if (isVirtual) {
        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(division);
        console.log(`Source divisions for '${division}':`, sourceDivs);
    }

    const db = Database.getExtendedInstance();
    
    console.log("\nChecking existing records in employee_other_incomes for NRS:");
    const existing = await db.query(`
        SELECT * FROM employee_other_incomes 
        WHERE period_year = ? AND period_month = ? AND (division_code = ? OR gang_code = ?)
    `, [year, month, division, gang]);
    console.table(existing);

    console.log("\nChecking payroll history headers for potential matches:");
    const headers = await db.query(`
        SELECT id, history_id, division_code, gang_code, total_employees 
        FROM dbo.payroll_history_header
        WHERE period_year = ? AND period_month = ?
    `, [year, month]);
    console.table(headers);

    console.log("\nRunning a mock calculation...");
    const result = await OtherIncomesService.calculateAndSaveTHR(year, month, division, gang);
    console.log("Calculation Result:", result);

    console.log("\nChecking records again after calculation:");
    const after = await db.query(`
        SELECT id, nik, emp_name, division_code, gang_code, amount 
        FROM employee_other_incomes 
        WHERE period_year = ? AND period_month = ? AND (division_code = ? OR gang_code = ?)
    `, [year, month, division, gang]);
    console.table(after);
}

debugNRS();
