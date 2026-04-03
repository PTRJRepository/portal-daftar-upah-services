import { dataExtractorService } from '../../src/services/dataExtractorService';
import { Database } from '../../src/db/client';
import { Config } from '../../src/config';

async function runTest() {
    console.log("Starting test for cuti calculation...");
    
    // Choose a recent month to test
    const month = 4; // April
    const year = 2024;
    
    // Test on one or two specific employees if known, or get first 5
    console.log(`Extracting payroll data for ${month}/${year}`);
    const result = await dataExtractorService.extractPayrollData(
        month, 
        year, 
        "ALL", 
        undefined, 
        "F0444", 
        Config.DB_PROFILE, 
        false, 
        null, 
        undefined, 
        true // skipHarvest for speed
    );
    
    console.log(`Found ${result.data_rows.length} records.`);
    
    // Filter rows that have ANY cuti_minggu or cuti_nasional > 0
    const havingCuti = result.data_rows.filter(r => r.cuti_minggu_hari > 0 || r.cuti_nasional_hari > 0);
    const havingTahunan = result.data_rows.filter(r => r.cuti_tahunan_hari > 0 || r.cuti_sakit_haid_hari > 0);
    
    console.log(`Records with Cuti Minggu or Libur Nasional: ${havingCuti.length}`);
    console.log(`Records with Cuti Tahunan or Sakit/Haid: ${havingTahunan.length}`);
    
    // Print a few examples
    console.log("\n--- Sample records with Cuti Minggu/Nasional ---");
    havingCuti.slice(0, 5).forEach(r => {
        console.log(`[${r.emp_code}] ${r.emp_name} - HK: ${r.jumlah_hk}, Efektif: ${r.kehadiran}, Minggu: ${r.cuti_minggu_hari}, Nasional: ${r.cuti_nasional_hari}`);
    });
    
    console.log("\n--- Sample records with Cuti Tahunan/Sakit ---");
    havingTahunan.slice(0, 5).forEach(r => {
        console.log(`[${r.emp_code}] ${r.emp_name} - HK: ${r.jumlah_hk}, Efektif: ${r.kehadiran}, Tahunan: ${r.cuti_tahunan_hari}, Sakit: ${r.cuti_sakit_haid_hari}`);
    });

    // Close DB connection
    // Database.getInstance().close();
    // Database.getExtendedInstance().close();
    console.log("Test finished.");
}

runTest().catch(console.error);
