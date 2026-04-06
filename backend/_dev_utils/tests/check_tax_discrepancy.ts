import { taxReportService } from "../../src/services/taxReportService";

async function checkDiscrepancy() {
    const year = 2026;
    const month = 3;
    const division = "AB1"; // Example, adjust if needed
    
    console.log(`Checking Tax Report for ${month}/${year}, division: ${division}`);
    
    try {
        const result = await taxReportService.getMonthlyTaxReport(year, month, division);
        if (!result || !result.employees) {
            console.log("No employees found.");
            return;
        }

        console.log(`Total employees: ${result.employees.length}`);
        console.log(`JSON total_pph21: ${result.total_pph21}`);
        
        let calculatedGrandTotal = 0;
        let pph21_0_but_high_bruto = [];
        
        for (const emp of result.employees) {
            calculatedGrandTotal += emp.pph21_ter;
            if (emp.pph21_ter === 0 && emp.penghasilan_bruto > 5000000) {
                pph21_0_but_high_bruto.push({
                    id: emp.emp_code || emp.nik,
                    name: emp.emp_name,
                    bruto: emp.penghasilan_bruto,
                    ptkp: emp.status_ptkp
                });
            }
        }
        
        console.log(`Sum of pph21_ter in employees array: ${calculatedGrandTotal}`);
        
        if (pph21_0_but_high_bruto.length > 0) {
            console.log("\nPotential issues (PPh21=0 but Bruto > 5M):");
            console.table(pph21_0_but_high_bruto);
        } else {
            console.log("\nNo employees found with PPh21=0 and Bruto > 5M.");
        }
        
    } catch (e) {
        console.error(e);
    }
}

checkDiscrepancy();
