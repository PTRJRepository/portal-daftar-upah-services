
import { DataExtractorService } from "./services/dataExtractorService";
import { Database } from "./db/client";

async function verifyFridayLogic() {
    console.log("🔍 Verifying Friday Logic...");
    const db = Database.getInstance();

    // 1. Test DATEDIFF logic directly
    // 2026-01-30 is a Friday.
    // 1900-01-05 was a Friday.
    // Difference should be divisible by 7?

    // Let's run a raw query to check what the DB thinks
    const testDate = '2026-01-30';
    try {
        const result = await db.query(`
            SELECT 
                DATEDIFF(day, '1900-01-05', '${testDate}') as diff,
                DATEDIFF(day, '1900-01-05', '${testDate}') % 7 as mod_result,
                DATENAME(weekday, '${testDate}') as date_name
        `);
        console.log("📅 Date Check for 2026-01-30 (Friday):", result[0]);

        if (result[0].mod_result === 0) {
            console.log("✅ DATEDIFF Logic confirms this is a zero-mod day (Friday).");
        } else {
            console.log("❌ DATEDIFF Logic FAILS. Mod result is:", result[0].mod_result);
        }

    } catch (e) {
        console.error("SQL Error:", e);
    }
}

verifyFridayLogic();
