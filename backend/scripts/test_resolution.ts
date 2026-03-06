import { Database } from "../src/db/client";

async function testResolution() {
    const mainDb = Database.getInstance();
    const { employeeGangHistoryService } = await import("../src/services/employeeGangHistoryService");

    // SISWANTO ( HANIA ) NIK
    const nik = '1902051902910001';
    
    console.log("Resolving without gang preference...");
    const map1 = await employeeGangHistoryService.resolveLatestEmpCodes([nik]);
    console.log("Result:", map1.get(nik));

    console.log("\nResolving with gang 'INF' preference...");
    const pref = new Map();
    pref.set(nik, 'INF');
    const map2 = await employeeGangHistoryService.resolveLatestEmpCodes([nik], pref);
    console.log("Result:", map2.get(nik));

    console.log("\nResolving with gang 'RANDOM' preference (should fallback to latest active)...");
    const pref2 = new Map();
    pref2.set(nik, 'XYZ');
    const map3 = await employeeGangHistoryService.resolveLatestEmpCodes([nik], pref2);
    console.log("Result:", map3.get(nik));
}

testResolution();
