
import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { DataExtractorService } from "../../backend/src/services/dataExtractorService";

async function verifyJabatanRate() {
    const dbName = 'staging_PTRJ_iFES_Plantware';
    const profile = Config.DB_PROFILE;
    const db = Database.getInstance(dbName, profile);

    console.log("Finding test data for Jabatan Rate verification...");

    // Find an employee who has JABATAN allowance
    // And ideally has some leave (Cuti) so HK != Hari Kerja
    // We look for DocDesc like 'JABATAN' in PR_ADTRANS

    const query = `
        SELECT TOP 5 
            t.EmpCode, t.DocDate, t.DocDesc, SUM(ln.Amount) as Amount
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE UPPER(t.DocDesc) LIKE '%JABATAN%'
        AND t.DocDate >= '2024-01-01'
        GROUP BY t.EmpCode, t.DocDate, t.DocDesc
        ORDER BY t.DocDate DESC
    `;

    const rows = await db.query(query);

    if (rows.length === 0) {
        console.log("No Jabatan allowance records found.");
        return;
    }

    // Try the first one
    const testRow = rows[0];
    const empCode = testRow.EmpCode;
    const date = new Date(testRow.DocDate);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const expectedAmount = testRow.Amount;

    console.log(`Testing Employee: ${empCode}, Month: ${month}/${year}`);
    console.log(`Expected Jabatan Amount: ${expectedAmount}`);

    console.log("Extracting payroll data...");
    const result = await DataExtractorService.getInstance().extractPayrollData(
        month,
        year,
        "ALL",
        undefined,
        empCode,
        profile
    );

    if (result.data_rows.length === 0) {
        console.log("No payroll rows returned.");
        return;
    }

    const row = result.data_rows[0];

    console.log("--- Result Data ---");
    console.log(`HK (Total): ${row.jumlah_hk}`);
    console.log(`Hari Kerja (Effective): ${row.hari_kerja}`);
    console.log(`Cuti Tahunan: ${row.cuti_tahunan_hari}`);
    console.log(`Cuti Minggu: ${row.cuti_minggu_hari}`);
    console.log(`Cuti Nasional: ${row.cuti_nasional_hari}`);
    console.log(`Jabatan Jumlah: ${row.jabatan_jumlah}`);
    console.log(`Jabatan Rate: ${row.jabatan_rate}`);

    // Verification
    if (row.hari_kerja > 0) {
        const calculatedRate = row.jabatan_jumlah / row.hari_kerja;
        // Allow small float diff
        const diff = Math.abs(calculatedRate - row.jabatan_rate);

        console.log(`Calculated Rate (Amount / Hari Kerja): ${row.jabatan_jumlah} / ${row.hari_kerja} = ${calculatedRate}`);

        if (diff < 0.01) {
            console.log("SUCCESS: Jabatan Rate matches Amount / Hari Kerja.");
        } else {
            console.log("FAILURE: Jabatan Rate does NOT match Amount / Hari Kerja.");
            console.log(`Difference: ${diff}`);

            // Check against HK to see if it was the old way
            if (row.jumlah_hk > 0) {
                const oldRate = row.jabatan_jumlah / row.jumlah_hk;
                console.log(`Note: Amount / HK would be: ${row.jabatan_jumlah} / ${row.jumlah_hk} = ${oldRate}`);
                if (Math.abs(oldRate - row.jabatan_rate) < 0.01) {
                    console.log("WARNING: It seems to still be using Amount / HK.");
                }
            }
        }
    } else {
        console.log("Hari Kerja is 0, cannot verify division.");
        if (row.jabatan_rate === 0) {
            console.log("SUCCESS: Jabatan Rate is 0 as expected when Hari Kerja is 0.");
        } else {
            console.log(`FAILURE: Jabatan Rate is ${row.jabatan_rate} but Hari Kerja is 0.`);
        }
    }
}

verifyJabatanRate().catch(console.error);
