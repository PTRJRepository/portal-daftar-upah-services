import { dataExtractorService } from "../../backend/src/services/dataExtractorService";
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { historySeederService } from "../../backend/src/services/historySeederService";
import { historyDatabaseService } from "../../backend/src/services/historyDatabaseService";

async function runTest() {
    console.log("=== Testing Origin vs Historical Payroll (ICNO Approach) ===");

    // Test parameters
    const month = 1;
    const year = 2026;
    const testEmpCode = "A0150"; // Use a known employee from the logs

    // 1. Get Origin Data using DataExtractorService (this uses EmpCode)
    console.log(`\n1. Fetching Origin Data for EmpCode: ${testEmpCode} (${month}/${year})`);
    const originResult = await dataExtractorService.extractPayrollData(
        month,
        year,
        "ALL", // gangCode
        undefined, // divisionCode
        testEmpCode, // specificEmpCode
        Config.DB_PROFILE, // serverProfile
        false // includeVirtualGangs
    );

    if (!originResult || originResult.data_rows.length === 0) {
        console.error("No origin data found for this employee.");
        process.exit(1);
    }

    const originData = originResult.data_rows[0];
    const nik = originData.nik || testEmpCode; // extractPayrollData sets row.nik to emp_code usually, let's check NIK in HR_EMPLOYEE

    // Get actual NIK from HR_EMPLOYEE to be sure
    const db = Database.getInstance(undefined, Config.DB_PROFILE);
    const empRows = await db.query<any>(`SELECT NewICNo FROM HR_EMPLOYEE WHERE EmpCode = '${testEmpCode}'`);
    const actualNik = empRows.length > 0 && empRows[0].NewICNo ? empRows[0].NewICNo.trim() : originData.nik;

    console.log(`Origin Data Fetched:`);
    console.log(`- Nama: ${originData.nama}`);
    console.log(`- NIK (ICNO): ${actualNik}`);
    console.log(`- Gaji Pokok: Rp ${originData.gaji_pokok}`);
    console.log(`- Total Potongan: Rp ${originData.total_potongan}`);
    console.log(`- PPH21: Rp ${originData.pph21 || originData.pot_pph21}`);
    console.log(`- Upah Bersih: Rp ${originData.upah_bersih}`);

    // 2. Query Historical Data strictly using NIK (ICNO)
    console.log(`\n3. Seeding Historical Data for testing (Gang: ${originData.gang_code}, Div: ${originData.division_code})...`);
    const seedResult = await historySeederService.seedPayrollHistory({
        periodMonth: month,
        periodYear: year,
        divisionCode: originData.division_code,
        gangCode: originData.gang_code,
        createdBy: "PlaygroundTest"
    });
    console.log(`Seed Result: ${seedResult.success ? 'Success' : 'Failed'}`);
    if (!seedResult.success) {
        console.error("Errors:", seedResult.errors);
        process.exit(1);
    }

    console.log(`\n3. Fetching Historical Data using NIK: ${actualNik} (${month}/${year})`);

    // Since extend_db is where history is seeded
    const extendDb = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);

    let historyRows: any[] = [];
    try {
        historyRows = await extendDb.query<any>(`
            SELECT 
                d.emp_code,
                d.nik,
                d.emp_name,
                d.gaji_pokok,
                d.total_potongan,
                d.pot_pph21 as pph21,
                d.upah_bersih
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_header m ON d.master_id = m.id
            WHERE d.nik = ? AND m.period_month = ? AND m.period_year = ?
        `, [actualNik, month, year]);
    } catch (e: any) {
        console.error("Historical DB Query Failed:");
        console.error(e.message);
        process.exit(1);
    }

    if (historyRows.length === 0) {
        console.error(`No historical data found for NIK: ${actualNik}. Make sure the History Seeder has successfully run for this period/division first!`);
        process.exit(1);
    }

    // There could be multiple rows if the NIK has multiple EmpCodes (e.g. rotation, promotion)
    // We will aggregate them just like the 'History Endpoint' logic would
    console.log(`Historical Data Fetched (${historyRows.length} records found for this NIK):`);

    let histGajiPokok = 0;
    let histTotalPotongan = 0;
    let histPph21 = 0;
    let histUpahBersih = 0;

    for (const row of historyRows) {
        console.log(`  -> Record for EmpCode: ${row.emp_code}, Name: ${row.emp_name}`);
        histGajiPokok += row.gaji_pokok || 0;
        histTotalPotongan += row.total_potongan || 0;
        histPph21 += row.pph21 || 0;
        histUpahBersih += row.upah_bersih || 0;
    }

    console.log(`\n--- Aggregated Historical Totals ---`);
    console.log(`- Gaji Pokok: Rp ${histGajiPokok}`);
    console.log(`- Total Potongan: Rp ${histTotalPotongan}`);
    console.log(`- PPH21: Rp ${histPph21}`);
    console.log(`- Upah Bersih: Rp ${histUpahBersih}`);

    console.log("\n=== COMPARISON ===");
    const gajiDiff = Math.abs(originData.gaji_pokok - histGajiPokok);
    const potDiff = Math.abs(originData.total_potongan - histTotalPotongan);
    const bersihDiff = Math.abs(originData.upah_bersih - histUpahBersih);

    console.log(`Gaji Pokok Match: ${gajiDiff === 0 ? '✅ YES' : `❌ NO (Diff: ${gajiDiff})`}`);
    console.log(`Total Potongan Match: ${potDiff === 0 ? '✅ YES' : `❌ NO (Diff: ${potDiff})`}`);
    console.log(`Upah Bersih Match: ${bersihDiff === 0 ? '✅ YES' : `❌ NO (Diff: ${bersihDiff})`}`);

    process.exit(0);
}

runTest().catch(console.error);
