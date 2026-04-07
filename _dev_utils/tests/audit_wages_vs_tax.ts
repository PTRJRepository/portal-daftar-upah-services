/**
 * Diagnostic script to compare Wages Report vs Tax Export
 * Period: March 2026, Division: PG2A
 */

const BACKEND_URL = 'http://localhost:8002';
const SYSTEM_TOKEN = 'system-internal-secret-token';

async function audit() {
    const month = "3";
    const year = "2026";
    const div = "PG2A";

    console.log(`Auditing Wages vs Tax for ${div} (${month}/${year})...`);

    try {
        const headers = {
            'Authorization': `Bearer ${SYSTEM_TOKEN}`
        };

        // 1. Fetch Wages Report (Raw Tree)
        // Uses 'division_code'
        const wagesUrl = `${BACKEND_URL}/payroll/report/division-raw-tree?division_code=${div}&month=${month}&year=${year}`;
        console.log(`Fetching Wages: ${wagesUrl}`);
        const wagesResponse = await fetch(wagesUrl, { headers });
        
        if (!wagesResponse.ok) {
            const errText = await wagesResponse.text();
            throw new Error(`Wages API error: ${wagesResponse.status} - ${errText}`);
        }
        const wagesResult = await wagesResponse.json();

        // 2. Fetch Tax Export JSON
        // Uses 'div'
        const taxUrl = `${BACKEND_URL}/payroll/export/pajak?div=${div}&month=${month}&year=${year}`;
        console.log(`Fetching Tax: ${taxUrl}`);
        const taxResponse = await fetch(taxUrl, { headers });
        
        if (!taxResponse.ok) {
            const errText = await taxResponse.text();
            throw new Error(`Tax API error: ${taxResponse.status} - ${errText}`);
        }
        const taxResult = await taxResponse.json();

        const wagesEmployees = [];
        for (const gang of (wagesResult.gangs || [])) {
            wagesEmployees.push(...gang.employees);
        }

        const taxEmployees = taxResult.employees || {}; // Map emp_code -> data

        console.log(`Found ${wagesEmployees.length} employees in Wages Report`);
        console.log(`Found ${Object.keys(taxEmployees).length} employees in Tax Export`);

        if (wagesEmployees.length === 0) {
            console.warn("No employees found in Wages Report. Check if data exists for this period.");
            return;
        }

        const discrepancies = [];

        for (const empW of wagesEmployees) {
            const empT = taxEmployees[empW.emp_code];
            if (!empT) {
                // Not necessarily an error if filter is different, but likely a discrepancy
                continue;
            }

            const wagesBruto = Number(empW.penghasilan_bruto || 0);
            const taxBruto = Number(empT.penghasilan_bruto || 0);
            
            const wagesPph = Number(empW.pph21_ter || 0);
            const taxPph = Number(empT.pph21_ter || 0);

            const diffBruto = Math.abs(wagesBruto - taxBruto);
            const diffPph = Math.abs(wagesPph - taxPph);

            if (diffBruto > 1 || diffPph > 1) {
                discrepancies.push({
                    emp_code: empW.emp_code,
                    name: empW.nama || '?',
                    wages_bruto: wagesBruto,
                    tax_bruto: taxBruto,
                    wages_pph: wagesPph,
                    tax_pph: taxPph,
                    diff_bruto: diffBruto.toFixed(2),
                    diff_pph: diffPph.toFixed(2)
                });
            }
        }

        if (discrepancies.length > 0) {
            console.log(`\nFound ${discrepancies.length} discrepancies:`);
            console.table(discrepancies.slice(0, 20)); // Show top 20
        } else {
            console.log("\nSUCCESS: No discrepancies found between Wages and Tax reports for the tested employees!");
        }

    } catch (error) {
        console.error("\nAudit failed:", error.message);
    }
}

audit();
