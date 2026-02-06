
import { DataExtractorService } from "./services/dataExtractorService";
import { gangService } from "./services/gangService";

const dataExtractorService = DataExtractorService.getInstance();

async function verify() {
    console.log("--- Verifying Gang Code Mapping ---");

    // 1. Fetch all gangs to find a good test candidate
    console.log("Fetching all gangs...");
    const gangs = await gangService.fetchGangs();

    // Find a gang where Code != Description (ignoring case)
    const testGang = gangs.find((g: any) => {
        const code = g.gang_code?.trim().toUpperCase();
        const desc = g.description?.trim().toUpperCase();
        return code && desc && code !== desc;
    });

    if (!testGang) {
        console.error("No suitable test gang found (where Code != Description).");
        // Fallback to any gang unique enough
        if (gangs.length > 0) {
            console.log("Using first available gang as fallback.");
        } else {
            console.error("No gangs found at all.");
            return;
        }
    }

    const targetCode = testGang?.gang_code || gangs[0]?.gang_code;
    const targetDesc = testGang?.description || gangs[0]?.description;

    console.log(`Test Candidate: Code='${targetCode}', Description='${targetDesc}'`);

    // 2. Test extractPayrollData with the Code
    console.log(`\nCalling extractPayrollData with gangCode='${targetCode}'...`);
    // Use a known historical month/year or current if safer. Let's try recently verified historical period Dec 2025 (AccMonth 9/2026) to be sure?
    // Or just current period if that works. Let's use current period (latest) to avoid empty historical data issues if 2025 is patchy.
    // Actually, user was looking at Dec 2025. Let's stick to a safe default month/year or query current period.
    const month = 12;
    const year = 2025; // As per user context

    const result = await dataExtractorService.extractPayrollData(month, year, targetCode, undefined, null, "SERVER_PROFILE_2");

    console.log(`\nResult Row Count: ${result.data_rows.length}`);

    if (result.data_rows.length > 0) {
        const firstRow = result.data_rows[0];
        console.log(`First Row Gang Code: '${firstRow.gang_code}'`);

        if (firstRow.gang_code === targetCode) {
            console.log("SUCCESS: Returned Gang Code matches Input Code.");
        } else {
            console.error(`FAILURE: Returned Gang Code '${firstRow.gang_code}' does NOT match Input Code '${targetCode}'. (Likely returned Description instead)`);
        }
    } else {
        console.warn("No rows returned. Cannot verify row mapping. Check if data exists for this period.");
    }
}

verify().catch(console.error);
