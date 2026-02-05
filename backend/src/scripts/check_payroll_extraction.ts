
import { dataExtractorService } from "../services/dataExtractorService";

async function checkPayroll() {
    console.log("Checking Payroll Extraction...");

    // Check P1A
    console.log("\n--- Checking P1A ---");
    const p1a = await dataExtractorService.extractPayrollData("P1A", 1, 2026);
    const hm = p1a.filter(r => r.gang_code === 'HM');
    console.log(`Total P1A Rows: ${p1a.length}`);
    console.log(`Rows with Gang HM: ${hm.length}`);
    if (hm.length > 0) console.log("First HM Row:", hm[0]);

    // Check AB2
    console.log("\n--- Checking AB2 ---");
    const ab2 = await dataExtractorService.extractPayrollData("AB2", 1, 2026);
    const hmc = ab2.filter(r => r.gang_code === 'HMC');
    console.log(`Total AB2 Rows: ${ab2.length}`);
    console.log(`Rows with Gang HMC: ${hmc.length}`);
    if (hmc.length > 0) console.log("First HMC Row:", hmc[0]);

    // Check AB1 (Fallback)
    console.log("\n--- Checking AB1 (Fallback) ---");
    const ab1 = await dataExtractorService.extractPayrollData("AB1", 1, 2026);
    const hmc_ab1 = ab1.filter(r => r.gang_code === 'HMC');
    console.log(`Rows with Gang HMC in AB1: ${hmc_ab1.length}`);
}

checkPayroll().catch(console.error);
