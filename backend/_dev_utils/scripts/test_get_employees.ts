import { DataExtractorService } from "../../src/services/dataExtractorService";
import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function main() {
    const extractor = DataExtractorService.getInstance();
    
    // Test for March 2026 (Historical)
    const month = 3;
    const year = 2026;

    console.log(`--- Testing getEmployees for DME (March 2026, Historical=true) ---`);
    const dmeGangs = await divisionConfigService.getGangsForDivision("DME");
    if (dmeGangs.length === 0) {
        console.error("No gangs found for DME in DivisionConfigService!");
    } else {
        const codes = dmeGangs.map(g => g.gang_code);
        const placeholders = codes.map(c => `'${c.trim()}'`).join(",");
        // In live path, it uses g.GangCode. Extractor will replace it with g.GangID for historical.
        const gangCondition = `(UPPER(RTRIM(g.GangCode)) IN (${placeholders}) OR UPPER(RTRIM(g.Description)) IN (${placeholders}))`;
        
        console.log(`Querying DME with condition: ${gangCondition}`);
        const emps = await extractor.getEmployees(gangCondition, month, year, undefined, true);
        console.log(`Found ${emps.length} employees for DME (Historical)`);
        
        if (emps.length === 0) {
            console.log("Checking live fallback for DME...");
            const liveEmps = await extractor.getEmployees(gangCondition, month, year, undefined, false);
            console.log(`Found ${liveEmps.length} employees for DME (Live)`);
        }
    }

    console.log(`\n--- Testing getEmployees for IJL (March 2026, Historical=true) ---`);
    const ijlGangs = await divisionConfigService.getGangsForDivision("IJL");
    if (ijlGangs.length === 0) {
        console.error("No gangs found for IJL in DivisionConfigService!");
    } else {
        const codes = ijlGangs.map(g => g.gang_code);
        const placeholders = codes.map(c => `'${c.trim()}'`).join(",");
        const gangCondition = `(UPPER(RTRIM(g.GangCode)) IN (${placeholders}) OR UPPER(RTRIM(g.Description)) IN (${placeholders}))`;
        
        console.log(`Querying IJL with condition: ${gangCondition}`);
        const emps = await extractor.getEmployees(gangCondition, month, year, undefined, true);
        console.log(`Found ${emps.length} employees for IJL (Historical)`);

        if (emps.length === 0) {
            console.log("Checking live fallback for IJL...");
            const liveEmps = await extractor.getEmployees(gangCondition, month, year, undefined, false);
            console.log(`Found ${liveEmps.length} employees for IJL (Live)`);
        }
    }
}

main().catch(console.error);
