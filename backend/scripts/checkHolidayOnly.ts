import { Database } from "../src/db/client";
import { cacheService } from "../src/services/cacheService";

const db = Database.getInstance();

async function checkHolidayIssue() {
    console.log("=== DEBUG HOLIDAY ISSUE ===\n");

    // 1. Check database directly (bypass cache)
    console.log("1. Database - Direct Query (no cache):");
    const dbResult = await db.query<{
        HolidayDate: string;
        Description: string;
        IsRegionPH: number;
        Status: number;
    }>(`
        SELECT HolidayDate, Description, IsRegionPH, Status
        FROM HR_GPH
        WHERE HolidayDate = '2026-01-16'
    `);

    if (dbResult.length === 0) {
        console.log("   ❌ Tidak ada data di database");
    } else {
        const row = dbResult[0];
        console.log(`   Date: ${row.HolidayDate}`);
        console.log(`   Description: ${row.Description}`);
        console.log(`   IsRegionPH: ${row.IsRegionPH} (${row.IsRegionPH === 1 ? '✅ Libur Keagamaan' : '❌ Libur Umum'})`);
        console.log(`   Status: ${row.Status}`);
    }

    // 2. Check cache
    console.log("\n2. Checking Cache:");
    const cacheKey = `holidays:2026`;
    const cachedData = cacheService.get<any>(cacheKey);

    if (!cachedData) {
        console.log("   ℹ️  Cache kosong atau expired");
    } else {
        console.log("   ⚠️  Data ditemukan di cache:");
        const cachedHoliday = cachedData["2026-01-16"];
        if (cachedHoliday) {
            console.log(`   Description: ${cachedHoliday.description}`);
            console.log(`   is_religious: ${cachedHoliday.is_religious} (${cachedHoliday.is_religious ? '✅ Libur Keagamaan' : '❌ Libur Umum'})`);

            // Check if cache matches database
            if (cachedHoliday.is_religious !== dbResult[0]?.IsRegionPH === 1) {
                console.log("   ❌ CACHE TIDAK SAMA dengan database!");
            } else {
                console.log("   ✅ Cache sama dengan database");
            }
        } else {
            console.log("   ❌ Tanggal 2026-01-16 tidak ada di cache");
        }
    }

    // 3. Test classification
    console.log("\n3. Testing Day Classification:");
    const { DayType, lemburCalculator } = await import("../src/services/lemburCalculator");

    // Clear cache first
    cacheService.delete(cacheKey);
    console.log("   ✅ Cache cleared");

    // Now test
    const dayType = await lemburCalculator.classifyDay(new Date("2026-01-16"), 2026);
    console.log(`   DayType: ${dayType}`);

    if (dayType === "HOLIDAY_RELIGIOUS") {
        console.log("   ✅ Classifikasi BENAR: Libur Keagamaan");
    } else {
        console.log("   ❌ Classifikasi SALAH: Seharusnya HOLIDAY_RELIGIOUS");
    }

    // 4. Re-check cache after classification
    console.log("\n4. Cache after classification:");
    const newCachedData = cacheService.get<any>(cacheKey);
    if (newCachedData && newCachedData["2026-01-16"]) {
        console.log(`   is_religious: ${newCachedData["2026-01-16"].is_religious}`);
    }

    // 5. Sample calculation
    console.log("\n5. Sample Overtime Calculation:");
    const breakdown = lemburCalculator.quickCalculate(10, "HOLIDAY_RELIGIOUS", false);
    console.log(`   10 jam lembur (Libur Keagamaan): Rp ${breakdown.total_amount.toLocaleString('id-ID')}`);
    console.log(`   Tier 1: ${breakdown.tier_1_hours}j @ ${breakdown.tier_1_rate}x = Rp ${breakdown.tier_1_amount.toLocaleString('id-ID')}`);
    console.log(`   Tier 2: ${breakdown.tier_2_hours}j @ ${breakdown.tier_2_rate}x = Rp ${breakdown.tier_2_amount.toLocaleString('id-ID')}`);

    await db.close();
    console.log("\n=== COMPLETE ===");
}

checkHolidayIssue().catch(console.error);
