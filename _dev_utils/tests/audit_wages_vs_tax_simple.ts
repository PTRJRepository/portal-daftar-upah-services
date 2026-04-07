/**
 * Simplified Diagnostic script to compare Wages Report vs Tax Export
 * Period: March 2026, Division: PG2A
 */

const BACKEND_URL = 'http://localhost:8002';
const SYSTEM_TOKEN = 'system-internal-secret-token';

async function audit() {
    const month = "3";
    const year = "2026";
    const div = "PG2A";

    try {
        const headers = { 'Authorization': `Bearer ${SYSTEM_TOKEN}` };

        const wagesUrl = `${BACKEND_URL}/payroll/report/division-raw-tree?division_code=${div}&month=${month}&year=${year}&use_history=1`;
        const wagesResponse = await fetch(wagesUrl, { headers });
        const wagesResult = await wagesResponse.json();

        const taxUrl = `${BACKEND_URL}/payroll/export/pajak?div=${div}&month=${month}&year=${year}&use_history=1`;
        const taxResponse = await fetch(taxUrl, { headers });
        const taxResult = await taxResponse.json();

        const wagesEmployees = [];
        for (const gang of (wagesResult.gangs || [])) {
            wagesEmployees.push(...gang.employees);
        }

        const taxEmployees = taxResult.employees || {};

        console.log(`WAGES_COUNT: ${wagesEmployees.length}`);
        console.log(`TAX_COUNT: ${Object.keys(taxEmployees).length}`);

        for (const empW of wagesEmployees) {
            const empT = taxEmployees[empW.emp_code];
            if (!empT) continue;

            const wagesBruto = Number(empW.penghasilan_bruto || 0);
            const taxBruto = Number(empT.penghasilan_bruto || 0);
            const wagesPph = Number(empW.pph21_ter || 0);
            const taxPph = Number(empT.pph21_ter || 0);

            if (Math.abs(wagesBruto - taxBruto) > 1 || Math.abs(wagesPph - taxPph) > 1) {
                console.log(`DISC: ${empW.emp_code} | ${empW.nama} | Bruto: W=${wagesBruto.toFixed(0)} T=${taxBruto.toFixed(0)} | PPh: W=${wagesPph.toFixed(0)} T=${taxPph.toFixed(0)}`);
            }
        }
    } catch (error) {
        console.error("Audit failed:", error.message);
    }
}

audit();
