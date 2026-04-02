import { Database } from "../src/db/client";
import { divisionConfigService } from "../src/services/config/DivisionConfigService";

async function run() {
    await Database.connect();
    console.log("INFRA:", await divisionConfigService.getGangsForDivision("INFRA"));
    console.log("NURSERY:", await divisionConfigService.getGangsForDivision("NURSERY"));
    console.log("WORKSHOP:", await divisionConfigService.getGangsForDivision("WORKSHOP"));
    
    // Also test what data extractor gets
    const { dataExtractorService } = await import("../src/services/dataExtractorService");
    const res = await dataExtractorService.extractPayrollData(10, 2025, 'ALL', 'INFRA', null, undefined, true);
    console.log("Rows extracted for INFRA:", res.data_rows.length);
    process.exit(0);
}

run().catch(console.error);
