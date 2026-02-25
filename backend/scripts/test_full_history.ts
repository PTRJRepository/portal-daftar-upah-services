import { Database } from '../src/db/client';
import { PayrollComponent } from '../src/types/payroll/PayrollComponent';

async function testHistory() {
    process.env.DB_PROFILE = "SERVER_PROFILE_2";

    // Call the employee API route handler logically, or just mock what it does.
    try {
        const response = await fetch("http://localhost:8002/payroll/employee/A0233/history?months=12");
        const json: any = await response.json();

        console.log(`Success: ${json.success}, Records: ${json.count}`);

        if (json.data && json.data.length > 0) {
            console.log("\nSample of history periods found:");
            for (const d of json.data) {
                console.log(`- Period: ${d.period_month}/${d.period_year} | EmpCode Used: ${d.emp_code} | NIK: ${d.nik} | Gross: ${d.jumlah_upah_kotor} | PR_WAGES amount: ${d.wages_data?.upah_bersih_pr_wages || 'N/A'}`);
            }
        } else {
            console.log(json);
        }
    } catch (e) {
        console.error(e);
    }
}

testHistory();
