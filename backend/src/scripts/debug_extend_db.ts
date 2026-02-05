
import { Database } from "../db/client";

async function run() {
    const db = Database.getExtendedInstance();
    console.log("Deep search for Lembur in dynamic data...");

    const month = 1;
    const year = 2026;

    const rows = await db.query(`
        SELECT TOP 1000 dynamic_premi_data
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ${month} AND period_year = ${year}
        AND division_code IS NOT NULL
        AND dynamic_premi_data IS NOT NULL
    `);

    console.log(`Scanned ${rows.length} rows.`);
    const headers = new Set<string>();
    let foundLembur = false;

    for (const row of rows) {
        try {
            const data = JSON.parse(row.dynamic_premi_data);
            data.forEach((x: any) => {
                const h = x.header.toUpperCase();
                headers.add(h);
                if (h.includes("LEMBUR") || h.includes("OVERTIME") || h.includes("OT")) {
                    console.log("FOUND POTENTIAL LEMBUR HEADER:", x.header, "Value:", x.total);
                    foundLembur = true;
                }
            });
        } catch (e) { }
    }

    if (!foundLembur) {
        console.log("No Lembur/Overtime headers found in 1000 rows.");
    }
    console.log("Total unique headers:", headers.size);
}

run();
