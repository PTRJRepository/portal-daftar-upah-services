
import { Database } from "../db/client";

async function main() {
    const db = Database.getExtendedInstance();
    const month = 2;
    const year = 2026;
    const gangCode = "C2T";
    const division = "TRANSPORT";

    try {
        // Check if exists
        const existing = await db.query<any>(`
            SELECT id FROM daftar_upah_aggregation_history 
            WHERE gang_code = ? AND period_month = ? AND period_year = ?
        `, [gangCode, month, year]);

        if (existing.length > 0) {
            console.log(`Gang ${gangCode} already exists in history.`);
            return;
        }

        console.log(`Inserting dummy data for Gang ${gangCode}...`);

        await db.query(`
            INSERT INTO daftar_upah_aggregation_history (
                period_month, period_year, division_code, gang_code, gang_description,
                total_employees, total_hk, total_upah_bersih, total_premi, total_lembur,
                total_ffb_weight, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                5, 120, 15000000, 500000, 200000,
                0, GETDATE(), GETDATE()
            )
        `, [month, year, division, gangCode, "Transport Gang C2 Test"]);

        console.log("Insert successful.");

    } catch (e) {
        console.error("Error:", e);
    }
}

main().catch(console.error);
