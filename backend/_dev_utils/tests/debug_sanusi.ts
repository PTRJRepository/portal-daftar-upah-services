import { DataExtractorService } from "../../src/services/dataExtractorService";
import { EmployeeEstateService } from "../../src/services/employeeEstateService";
import Config, { DatabaseProfile } from "../../src/config";

async function run() {
    const dataExtractor = new DataExtractorService();
    // Assuming month: 3, year: 2026 as seen in logs
    const month = 3;
    const year = 2026;
    const division = "ARA";
    const gang = "F1BHL";
    const profile = Config.DB_PROFILE as DatabaseProfile;

    console.log(`Extracting for ${division} ${gang} ${month}/${year}`);
    const stream = dataExtractor.extractPayrollDataProgressive(month, year, gang, division, profile);
    
    let sanusiCount = 0;
    for await (const chunk of stream) {
        if (chunk.stage === "details" && chunk.data) {
            const sanusiRecords = chunk.data.filter(e => e.emp_name?.toUpperCase().includes("SANUSI") || e.nama?.toUpperCase().includes("SANUSI"));
            if (sanusiRecords.length > 0) {
                for (const r of sanusiRecords) {
                    sanusiCount++;
                    console.log(`SANUSI FOUND: EmpCode=${r.emp_code}, NIK=${r.nik}, PPh21=${r.pph21_ter}, Gross=${r.penghasilan_bruto}, HK=${r.hk}`);
                }
            }
        }
    }
    console.log(`Total Sanusi records found: ${sanusiCount}`);
    process.exit(0);
}

run().catch(console.error);
