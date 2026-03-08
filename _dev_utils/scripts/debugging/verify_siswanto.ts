import { Database } from "../src/db/client";
import { OtherIncomesService } from "../src/services/otherIncomesService";

async function verifySiswanto() {
    // SISWANTO ( HANIA ) NIK
    const nik = '1902051902910001';
    const year = 2026;
    const month = 2;
    const division = 'INFRA';
    const gang = 'INF';

    console.log("=== VERIFYING SISWANTO RESOLUTION via OtherIncomesService ===");
    
    const incomes = await OtherIncomesService.getIncomes(year, month, division, gang);
    const sis = incomes.find(i => i.nik === nik);
    
    if (sis) {
        console.log("Resolved Siswanto Data:");
        console.log("- Name:", sis.emp_name);
        console.log("- Resolved EmpCode:", (sis as any).emp_code);
        console.log("- Resolved BankAcc:", (sis as any).bank_acc_no);
        console.log("- Status:", (sis as any).emp_status);
    } else {
        console.log("Siswanto income record not found for the given criteria.");
    }
}

verifySiswanto();
