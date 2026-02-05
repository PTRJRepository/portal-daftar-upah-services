
import { Database } from './src/db/client';
import { Config } from './src/config';

console.log("Config URL:", Config.DB_API_URL);

const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

async function checkPphValues() {
    console.log("Checking PPH values (limited to 50)...");

    try {
        const query = `
            SELECT TOP 50
                RTRIM(t.EmpCode) as emp_code,
                t.DocDesc,
                mt.TaskDesc,
                ln.Amount,
                t.DocDate
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
            WHERE (
                  t.DocDesc LIKE '%PPH%' 
                  OR t.DocDesc LIKE '%POT%' 
                  OR t.DocDesc LIKE '%KOREKSI%'
                  OR t.DocDesc LIKE '%PREMI%'
              )
            ORDER BY t.DocDate DESC
        `;

        const rows = await db.query(query);

        console.log("Fetched " + (rows as any[]).length + " rows.");
        (rows as any[]).forEach(r => {
            console.log(`[${r.emp_code}] Date: ${r.DocDate} | Doc: "${r.DocDesc}" | Task: "${r.TaskDesc}" | Amt: ${r.Amount}`);

            // Simulate Normalization
            const normalized = normalizePotonganName(r.DocDesc, r.TaskDesc);
            console.log(`   -> Normalized Key: ${normalized.key} | Title: ${normalized.title}\n`);
        });

    } catch (err) {
        console.error("Error:", err);
    }
}

function normalizePotonganName(docDesc: string, taskDesc?: string | null): { key: string; title: string } {
    const upper = docDesc.toUpperCase().trim();
    const upperTask = taskDesc ? taskDesc.toUpperCase().trim() : "";
    const cleanTitle = docDesc.trim();

    if (upper.includes("KOREKSI")) {
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

    if (upper.includes("PPH") || upper.includes("PAJAK")) {
        if (upper.includes("PREMI") || upperTask.includes("PREMI")) {
            const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
            return { key, title: cleanTitle };
        }
        return { key: "PPH21", title: "PPH21" };
    }

    if (upper.includes("SPSI")) {
        return { key: "SPSI", title: "SPSI" };
    }

    if (upper.startsWith("POTONGAN") || upper.startsWith("POT ") || upper.startsWith("POT_")) {
        const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
        return { key, title: cleanTitle };
    }

    const key = upper.replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
    return { key, title: cleanTitle };
}

checkPphValues();
