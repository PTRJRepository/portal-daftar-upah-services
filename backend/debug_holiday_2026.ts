import { Database } from "./src/db/client";
import { lemburCalculator } from "./src/services/lemburCalculator";

async function debugHoliday2026() {
    const db = Database.getInstance();

    console.log("=== DEBUG HOLIDAY 2026-01-16 ===\n");

    // 1. Check database directly
    console.log("1. Checking HR_GPH table for 2026-01-16:");
    try {
        const rows = await db.query<{
            HolidayDate: string;
            Description: string;
            IsRegionPH: number;
            Status: number;
        }>(`
            SELECT HolidayDate, Description, IsRegionPH, Status
            FROM HR_GPH
            WHERE HolidayDate = '2026-01-16'
        `);

        if (rows.length === 0) {
            console.log("   ❌ TIDAK ADA DATA untuk 2026-01-16 di HR_GPH");
        } else {
            for (const row of rows) {
                console.log(`   Date: ${row.HolidayDate}`);
                console.log(`   Description: ${row.Description}`);
                console.log(`   IsRegionPH: ${row.IsRegionPH} (${row.IsRegionPH === 1 ? '✅ Libur Keagamaan' : '❌ Libur Umum'})`);
                console.log(`   Status: ${row.Status} (${row.Status === 1 ? 'Aktif' : 'Tidak Aktif'})`);
            }
        }
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
    }

    // 2. Check all holidays in January 2026
    console.log("\n2. All holidays in January 2026:");
    try {
        const rows = await db.query<{
            HolidayDate: string;
            Description: string;
            IsRegionPH: number;
            Status: number;
        }>(`
            SELECT HolidayDate, Description, IsRegionPH, Status
            FROM HR_GPH
            WHERE YEAR(HolidayDate) = 2026 AND MONTH(HolidayDate) = 1 AND Status = 1
            ORDER BY HolidayDate
        `);

        if (rows.length === 0) {
            console.log("   ❌ TIDAK ADA DATA libur di Januari 2026");
        } else {
            for (const row of rows) {
                const type = row.IsRegionPH === 1 ? "🕌 Libur Keagamaan" : "🏛️ Libur Umum";
                console.log(`   ${row.HolidayDate} - ${row.Description} - ${type} (IsRegionPH=${row.IsRegionPH})`);
            }
        }
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
    }

    // 3. Test with lemburCalculator
    console.log("\n3. Testing lemburCalculator.getHolidays(2026):");
    try {
        const holidays = await lemburCalculator.getHolidays(2026);
        const dateKey = "2026-01-16";
        const holiday = holidays[dateKey];

        if (!holiday) {
            console.log(`   ❌ Tanggal ${dateKey} TIDAK ditemukan di cache holidays`);
        } else {
            console.log(`   ✅ Tanggal ${dateKey} ditemukan:`);
            console.log(`   Description: ${holiday.description}`);
            console.log(`   is_religious: ${holiday.is_religious} (${holiday.is_religious ? '✅ Libur Keagamaan' : '❌ Libur Umum'})`);
        }
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
    }

    // 4. Test classification
    console.log("\n4. Testing day classification for 2026-01-16:");
    try {
        const { DayType } = await import("./src/services/lemburCalculator");
        const dayType = await lemburCalculator.classifyDay(new Date("2026-01-16"), 2026);
        console.log(`   DayType: ${dayType}`);
        console.log(`   Expected: HOLIDAY_RELIGIOUS (Libur Keagamaan)`);
        console.log(`   ${dayType === "HOLIDAY_RELIGIOUS" ? "✅" : "❌"} Result: ${dayType}`);
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
    }

    // 5. Sample overtime calculation comparison
    console.log("\n5. Sample overtime calculation (10 jam, UPJ 17257):");
    try {
        const { DayType } = await import("./src/services/lemburCalculator");
        const upj = 17257;

        // Regular Holiday calculation
        const regularResult = lemburCalculator.quickCalculate(10, "HOLIDAY_REGULAR", false);
        console.log(`   HOLIDAY_REGULAR (2-3-4 pattern):`);
        console.log(`     Tier 1: ${regularResult.tier_1_hours} jam @ ${regularResult.tier_1_rate}x = ${regularResult.tier_1_amount.toLocaleString()}`);
        console.log(`     Tier 2: ${regularResult.tier_2_hours} jam @ ${regularResult.tier_2_rate}x = ${regularResult.tier_2_amount.toLocaleString()}`);
        console.log(`     Tier 3: ${regularResult.tier_3_hours} jam @ ${regularResult.tier_3_rate}x = ${regularResult.tier_3_amount.toLocaleString()}`);
        console.log(`     Total: ${regularResult.total_amount.toLocaleString()}`);

        // Religious Holiday calculation
        const religiousResult = lemburCalculator.quickCalculate(10, "HOLIDAY_RELIGIOUS", false);
        console.log(`\n   HOLIDAY_RELIGIOUS (3-4-4 pattern):`);
        console.log(`     Tier 1: ${religiousResult.tier_1_hours} jam @ ${religiousResult.tier_1_rate}x = ${religiousResult.tier_1_amount.toLocaleString()}`);
        console.log(`     Tier 2: ${religiousResult.tier_2_hours} jam @ ${religiousResult.tier_2_rate}x = ${religiousResult.tier_2_amount.toLocaleString()}`);
        console.log(`     Tier 3: ${religiousResult.tier_3_hours} jam @ ${religiousResult.tier_3_rate}x = ${religiousResult.tier_3_amount.toLocaleString()}`);
        console.log(`     Total: ${religiousResult.total_amount.toLocaleString()}`);

        const difference = religiousResult.total_amount - regularResult.total_amount;
        console.log(`\n   💰 Selisih: ${difference.toLocaleString()} (${religiousResult.total_amount.toLocaleString()} - ${regularResult.total_amount.toLocaleString()})`);
    } catch (e: any) {
        console.log(`   ❌ Error: ${e.message}`);
    }

    await db.close();
    console.log("\n=== DEBUG COMPLETE ===");
}

debugHoliday2026().catch(console.error);
