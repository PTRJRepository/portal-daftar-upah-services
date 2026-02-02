import { Database } from "../src/db/client.js";

const db = Database.getInstance();

async function checkAndFixHoliday() {
    console.log("=== DEBUG & FIX HOLIDAY 2026-01-16 ===\n");

    // 1. Check current data
    console.log("1. Checking current data for 2026-01-16:");
    const checkResult = await db.query(`
        SELECT
            HolidayDate,
            Description,
            IsRegionPH,
            Status,
            CASE
                WHEN IsRegionPH = 1 THEN 'Libur Keagamaan (3-4-4 pattern)'
                ELSE 'Libur Umum (2-3-4 pattern)'
            END AS HolidayType
        FROM HR_GPH
        WHERE HolidayDate = '2026-01-16'
    `);

    if (checkResult.length === 0) {
        console.log("   ❌ Tidak ada data untuk 2026-01-16");
        console.log("\n❌ Tanggal 2026-01-16 tidak ada di database. Silakan tambahkan manual.");
        await db.close();
        return;
    }

    const currentData = checkResult[0];
    console.log(`   Date: ${currentData.HolidayDate}`);
    console.log(`   Description: ${currentData.Description}`);
    console.log(`   IsRegionPH: ${currentData.IsRegionPH} (${currentData.HolidayType})`);
    console.log(`   Status: ${currentData.Status}`);

    // 2. Check if fix is needed
    if (currentData.IsRegionPH === 1) {
        console.log("\n✅ Data sudah BENAR - IsRegionPH = 1 (Libur Keagamaan)");
        console.log("   Tidak perlu update.");
    } else {
        console.log("\n❌ Data SALAH - IsRegionPH = 0 (Libur Umum)");
        console.log("   Perlu update ke IsRegionPH = 1 (Libur Keagamaan)\n");

        // 3. Update to Religious Holiday
        console.log("3. Updating HR_GPH set IsRegionPH = 1 for 2026-01-16...");
        const updateResult = await db.query(`
            UPDATE HR_GPH
            SET IsRegionPH = 1
            WHERE HolidayDate = '2026-01-16'
        `);

        console.log("   ✅ Update completed");

        // 4. Verify update
        console.log("\n4. Verifying update:");
        const verifyResult = await db.query(`
            SELECT
                HolidayDate,
                Description,
                IsRegionPH,
                Status,
                CASE
                    WHEN IsRegionPH = 1 THEN 'Libur Keagamaan (3-4-4 pattern)'
                    ELSE 'Libur Umum (2-3-4 pattern)'
                END AS HolidayType
            FROM HR_GPH
            WHERE HolidayDate = '2026-01-16'
        `);

        if (verifyResult.length > 0) {
            const updatedData = verifyResult[0];
            console.log(`   Date: ${updatedData.HolidayDate}`);
            console.log(`   Description: ${updatedData.Description}`);
            console.log(`   IsRegionPH: ${updatedData.IsRegionPH} (${updatedData.HolidayType})`);
            console.log(`   Status: ${updatedData.Status}`);

            if (updatedData.IsRegionPH === 1) {
                console.log("\n✅✅✅ UPDATE BERHASIL - 2026-01-16 sekarang Libur Keagamaan!");
            } else {
                console.log("\n❌ UPDATE GAGAL - IsRegionPH masih 0");
            }
        }
    }

    // 5. Show all holidays in January 2026
    console.log("\n5. All holidays in January 2026:");
    const allHolidays = await db.query(`
        SELECT
            HolidayDate,
            Description,
            IsRegionPH,
            Status,
            CASE
                WHEN IsRegionPH = 1 THEN '🕌 Libur Keagamaan'
                ELSE '🏛️ Libur Umum'
            END AS HolidayType
        FROM HR_GPH
        WHERE YEAR(HolidayDate) = 2026
          AND MONTH(HolidayDate) = 1
          AND Status = 1
        ORDER BY HolidayDate
    `);

    if (allHolidays.length === 0) {
        console.log("   ❌ Tidak ada libur di Januari 2026");
    } else {
        for (const h of allHolidays) {
            console.log(`   ${h.HolidayDate} - ${h.Description} - ${h.HolidayType}`);
        }
    }

    // 6. Show calculation comparison
    console.log("\n6. Perhitungan Lembur (10 jam, UPJ 17257):");
    const UPJ = 17257;
    const hours = 10;

    // Regular Holiday (2-3-4)
    const regularAmount = (UPJ * 2.0 * 7) + (UPJ * 3.0 * 1) + (UPJ * 4.0 * 2);
    console.log(`   Libur Umum (2-3-4): Rp ${regularAmount.toLocaleString('id-ID')}`);

    // Religious Holiday (3-4-4)
    const religiousAmount = (UPJ * 3.0 * 7) + (UPJ * 4.0 * 3);
    console.log(`   Libur Keagamaan (3-4-4): Rp ${religiousAmount.toLocaleString('id-ID')}`);

    const diff = religiousAmount - regularAmount;
    console.log(`   Selisih: Rp ${diff.toLocaleString('id-ID')} (${religiousAmount > regularAmount ? 'lebih tinggi' : 'lebih rendah'})`);

    await db.close();
    console.log("\n=== COMPLETE ===");
}

checkAndFixHoliday().catch(console.error);
