/**
 * Verify the FULL pipeline for PG2B: getHistoricalPayrollDataAsExtractorFormat -> data_rows count & pph21 sum
 */
import { HistoryDatabaseService } from "../../src/services/historyDatabaseService";
import { writeFileSync } from "fs";

async function verify() {
    const historyDb = HistoryDatabaseService.getInstance();
    const result: any = {};

    // Call the same function the FAST endpoint calls
    const historyData = await historyDb.getHistoricalPayrollDataAsExtractorFormat(
        3, 2026, "ALL", "PG2B", null, undefined
    );

    if (!historyData) {
        result.error = "No historyData returned";
    } else {
        result.total_data_rows = historyData.data_rows.length;
        
        // Sum pph21_ter from data_rows
        let totalPph21 = 0;
        let totalUpahKotor = 0;
        let withHk = 0;
        let withIncome = 0;
        
        const empCodeSet = new Set<string>();
        const nikSet = new Set<string>();
        
        for (const r of historyData.data_rows) {
            totalPph21 += Number(r.pph21_ter || 0);
            totalUpahKotor += Number(r.jumlah_upah_kotor || 0);
            
            const hk = Number(r.jumlah_hk || r.hk || 0);
            const income = Number(r.jumlah_upah_kotor || 0);
            if (hk > 0) withHk++;
            if (income > 0) withIncome++;
            
            empCodeSet.add((r.emp_code || '').trim().toUpperCase());
            nikSet.add((r.nik || '').trim().toUpperCase());
        }
        
        // Now simulate what the FAST endpoint does: its own de-dup
        const employeeMap = new Map<string, any>();
        for (const r of historyData.data_rows) {
            const hk = Number(r.jumlah_hk || r.hk || 0);
            const hasIncome = Number(r.jumlah_upah_kotor || 0) > 0;
            if (hk > 0 || hasIncome) {
                const key = (r.emp_code || r.nik || r.actual_nik || '').trim().toUpperCase();
                if (key) {
                    employeeMap.set(key, r);
                }
            }
        }
        
        let fastPph21 = 0;
        for (const r of employeeMap.values()) {
            fastPph21 += Number(r.pph21_ter || 0);
        }
        
        result.service_level_results = {
            total_rows: historyData.data_rows.length,
            total_pph21: totalPph21,
            total_upah_kotor: totalUpahKotor,
            with_hk: withHk,
            with_income: withIncome,
            unique_emp_codes: empCodeSet.size,
            unique_niks: nikSet.size
        };
        
        result.fast_endpoint_dedup = {
            unique_employees: employeeMap.size,
            pph21_after_dedup: fastPph21
        };
        
        result.expected_pph21 = 22254328;
        result.service_matches = Math.round(totalPph21) === 22254328;
        result.fast_matches = Math.round(fastPph21) === 22254328;
        
        // Show first 3 data_rows keys for debugging
        if (historyData.data_rows.length > 0) {
            result.sample_row_keys = Object.keys(historyData.data_rows[0]);
            result.sample_row = {
                emp_code: historyData.data_rows[0].emp_code,
                nik: historyData.data_rows[0].nik,
                actual_nik: historyData.data_rows[0].actual_nik,
                pph21_ter: historyData.data_rows[0].pph21_ter,
                gang_code: historyData.data_rows[0].gang_code
            };
        }
    }

    writeFileSync("_dev_utils/tests/pg2b_pipeline_verify.json", JSON.stringify(result, null, 2));
    console.log("Done");
    process.exit(0);
}

verify().catch(e => { console.error("ERR:", e.message); process.exit(1); });
