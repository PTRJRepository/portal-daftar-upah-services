import { Database } from "./db/client";

async function run() {
    Database.getInstance();
    const db = Database.getExtendedInstance();
    console.log("Testing param 'THR'");
    const rows = await db.query(`SELECT formula_string FROM employee_other_incomes_formulas WHERE income_type = @inc`, { inc: 'THR' });
    console.log("Result Param:", rows);

    const rowsLiteral = await db.query(`SELECT formula_string FROM employee_other_incomes_formulas WHERE income_type = 'THR'`);
    console.log("Result Literal:", rowsLiteral);
}
run();
