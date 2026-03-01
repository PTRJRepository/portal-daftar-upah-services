import { DataExtractorService } from "../../src/services/dataExtractorService";

async function main() {
    const extractor = (DataExtractorService as any).getInstance();

    // Check gang mapping for J0843
    console.log("Fetching J0843 explicitly:");
    const emps = await extractor.getEmployees("RTRIM(e.EmpCode) = 'J0843'", 2, 2026, undefined, false);
    console.log("LIVE:", emps);

    const empsArc = await extractor.getEmployees("RTRIM(e.EmpCode) = 'J0843'", 2, 2026, undefined, true);
    console.log("ARC (Month 2 2026):", empsArc);

    const empsArcJan = await extractor.getEmployees("RTRIM(e.EmpCode) = 'J0843'", 1, 2026, undefined, true);
    console.log("ARC (Month 1 2026):", empsArcJan);

}

main().catch(console.error).finally(() => process.exit(0));
