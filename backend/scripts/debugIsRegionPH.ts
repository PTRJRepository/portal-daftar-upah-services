import { Database } from "../src/db/client";

const db = Database.getInstance();

async function debugIsRegionPH() {
    console.log("=== DEBUG IsRegionPH TYPE ISSUE ===\n");

    const result = await db.query<{
        HolidayDate: string;
        Description: string;
        IsRegionPH: any;
        Status: number;
    }>(`
        SELECT HolidayDate, Description, IsRegionPH, Status
        FROM HR_GPH
        WHERE HolidayDate = '2026-01-16'
    `);

    if (result.length > 0) {
        const row = result[0];
        console.log("Raw values:");
        console.log(`  IsRegionPH value:`, row.IsRegionPH);
        console.log(`  IsRegionPH type:`, typeof row.IsRegionPH);
        console.log(`  IsRegionPH === 1:`, row.IsRegionPH === 1);
        console.log(`  IsRegionPH == 1:`, row.IsRegionPH == 1);
        console.log(`  Number(IsRegionPH) === 1:`, Number(row.IsRegionPH) === 1);
        console.log(`  parseInt(IsRegionPH) === 1:`, parseInt(row.IsRegionPH) === 1);

        // Test the actual condition used in getHolidays
        const is_religious = row.IsRegionPH === 1;
        console.log(`\nResult:`);
        console.log(`  is_religious (using === 1): ${is_religious}`);

        // Try alternative checks
        console.log(`\nAlternative checks:`);
        console.log(`  IsRegionPH == 1: ${row.IsRegionPH == 1}`);
        console.log(`  IsRegionPH == '1': ${row.IsRegionPH == '1'}`);
        console.log(`  IsRegionPH === true: ${row.IsRegionPH === true}`);
        console.log(`  Boolean(IsRegionPH): ${Boolean(row.IsRegionPH)}`);
    }
}

debugIsRegionPH().catch(console.error);
