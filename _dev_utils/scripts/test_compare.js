const MONTH = 12; // Adjust if needed
const YEAR = 2024; // Adjust if needed
const GANG = 'ALL';
const DIVISION = 'NRS'; // Based on login.json

const TOKEN = 'dev-bypass-token-12345';

async function test() {
    try {
        console.log(`Using provided token to fetch data...`);
        const headers = { 'Authorization': `Bearer ${TOKEN}` };

        console.log(`Fetching Daftar Upah (Origin)...`);
        const resOrigin = await fetch(`http://127.0.0.1:8002/payroll/report?month=${MONTH}&year=${YEAR}&gang_code=${GANG}&use_history=false`, { headers });
        const textOrigin = await resOrigin.text();
        const duOrigin = JSON.parse(textOrigin);
        if (duOrigin.error) { throw new Error(duOrigin.error); }

        console.log(`Fetching Daftar Upah (History)...`);
        const resHistory = await fetch(`http://127.0.0.1:8002/payroll/report?month=${MONTH}&year=${YEAR}&gang_code=${GANG}&use_history=true`, { headers });
        const textHistory = await resHistory.text();
        const duHistory = JSON.parse(textHistory);

        console.log(`Fetching Tax Report...`);
        const resTax = await fetch(`http://127.0.0.1:8002/tax-report/monthly?month=${MONTH}&year=${YEAR}&gang=${GANG}&division=${DIVISION}`, { headers });
        const textTax = await resTax.text();
        const taxReport = JSON.parse(textTax);

        // Use data instead of data_rows based on the /payroll/report res.data
        let originMap = new Map();
        if (duOrigin.data) duOrigin.data.forEach(r => originMap.set(r.emp_code, r));

        let historyMap = new Map();
        if (duHistory.data) duHistory.data.forEach(r => historyMap.set(r.emp_code, r));

        let totalMismatchOrigin = 0;
        let totalMismatchHistory = 0;

        console.log("\n=== COMPARISON ===");
        const activeEmps = taxReport.employees || [];
        for (const emp of activeEmps) {
            const taxKotor = emp.upah_kotor;
            const oRow = originMap.get(emp.emp_code);
            const hRow = historyMap.get(emp.emp_code);

            const oKotor = oRow ? oRow.jumlah_upah_kotor : null;
            const hKotor = hRow ? hRow.jumlah_upah_kotor : null;

            if (oKotor !== taxKotor) {
                totalMismatchOrigin++;
            }
            if (hKotor !== taxKotor) {
                totalMismatchHistory++;
            }
        }
        console.log(`Mismatch Tax VS Origin : ${totalMismatchOrigin} / ${activeEmps.length} employees`);
        console.log(`Mismatch Tax VS History: ${totalMismatchHistory} / ${activeEmps.length} employees`);

        const sampleEmp = activeEmps.find(e => {
            const oR = originMap.get(e.emp_code);
            // Ignore minor float precision
            return oR && Math.abs(oR.jumlah_upah_kotor - e.upah_kotor) > 0.01;
        });

        if (sampleEmp) {
            console.log("\nSample Mismatch Employee:", sampleEmp.emp_code, sampleEmp.emp_name);
            console.log("  Tax Upah Kotor:", sampleEmp.upah_kotor);

            const oR = originMap.get(sampleEmp.emp_code);
            console.log("  Org Upah Kotor:", oR?.jumlah_upah_kotor);
            if (oR) {
                console.log("    Org Gaji Pokok (Aktual):", oR.gaji_pokok_aktual);
                console.log("    Org Tunjangan:", oR.total_tunjangan);
                console.log("    Org Premi:", oR.total_premi);
                console.log("    Org Pot Koreksi:", oR.pot_koreksi);
            }

            const hR = historyMap.get(sampleEmp.emp_code);
            if (hR) {
                console.log("  His Upah Kotor:", hR?.jumlah_upah_kotor);
            }
        } else {
            const sampleEmpHist = activeEmps.find(e => {
                const hR = historyMap.get(e.emp_code);
                return hR && Math.abs(hR.jumlah_upah_kotor - e.upah_kotor) > 0.01;
            });
            if (sampleEmpHist) {
                console.log("\nSample Mismatch Employee (History only):", sampleEmpHist.emp_code, sampleEmpHist.emp_name);
                console.log("  Tax Upah Kotor:", sampleEmpHist.upah_kotor);
                console.log("  Org Upah Kotor:", originMap.get(sampleEmpHist.emp_code)?.jumlah_upah_kotor);
                console.log("  His Upah Kotor:", historyMap.get(sampleEmpHist.emp_code)?.jumlah_upah_kotor);

                const hR = historyMap.get(sampleEmpHist.emp_code);
                if (hR) {
                    console.log("    His Gaji Pokok (Aktual):", hR.gaji_pokok_aktual);
                    console.log("    His Tunjangan:", hR.total_tunjangan);
                    console.log("    His Premi:", hR.total_premi);
                    console.log("    His Pot Koreksi:", hR.pot_koreksi);

                    if (hR.premi_koreksi !== undefined) console.log("    His Premi Koreksi:", hR.premi_koreksi);
                }
            } else {
                console.log("\nAll good! No mismatches > 0.01 found.");
            }
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
