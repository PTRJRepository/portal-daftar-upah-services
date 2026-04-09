import { Database } from "../../src/db/client";
import { DataExtractorService } from "../../src/services/dataExtractorService";

async function main() {
    const service = new DataExtractorService();
    
    const divisionCode = "PG1A"; // LocCode: P1A
    const month = 3;
    const year = 2026;
    
    console.log(`Testing extraction for ${divisionCode} (All Groups, All Gangs)...`);
    
    // Simulate Request: month, year, gangCode, divisionCode, ..., gangPrefix
    const result = await (service as any).extractPayrollData(
        month, 
        year, 
        "ALL", 
        divisionCode,
        null, // specificEmpCode
        undefined, // serverProfile
        false, // includeVirtualGangs
        null, // useHistoryDb
        "" // gangPrefix = empty (Semua Group)
    );
    
    console.log(`Found ${result.data_rows.length} employees.`);
    
    if (result.data_rows.length > 0) {
        // Group by gang to see if multiple gangs are present
        const gMap = new Map();
        result.data_rows.forEach((row: any) => {
            const gc = row.gang_code;
            gMap.set(gc, (gMap.get(gc) || 0) + 1);
        });
        console.log(`Employees are distributed across ${gMap.size} gangs.`);
        console.log("Sample gangs found:", Array.from(gMap.keys()).slice(0, 10));
    } else {
        console.error("FAILED: No employees found for PG1A!");
    }
}

main().catch(console.error).finally(() => process.exit(0));
