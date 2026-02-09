import { Config } from "../config";
import { AggregationRecord } from "./payrollDataService";
import { SummaryService } from "./summaryService";

export class AppsScriptService {
    /**
     * Sync division data to Google Spreadsheet via Apps Script Web App
     * Format matches Daftar Upah with gang headers, gang totals, and grand total
     */
    static async syncDivisionToSpreadsheet(
        division: string,
        month: number,
        year: number,
        records: any[] // Flat employee records
    ) {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
        const scriptSecret = process.env.GOOGLE_SCRIPT_SECRET;

        if (!scriptUrl || !scriptSecret) {
            throw new Error("Missing GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_SECRET in environment variables");
        }

        console.log(`[AppsScriptService] Syncing ${division} (${month}/${year}) to Spreadsheet (Daftar Upah Format)...`);

        // 1. Group employees by gang
        const gangsMap = new Map<string, any[]>();
        records.forEach(emp => {
            const gangCode = emp.gang_code || 'UNKNOWN';
            if (!gangsMap.has(gangCode)) {
                gangsMap.set(gangCode, []);
            }
            gangsMap.get(gangCode)!.push(emp);
        });

        // 2. Sort gangs alphabetically
        const sortedGangs = Array.from(gangsMap.keys()).sort();

        // 3. Define headers (multi-level format)
        const headers = [
            // Level 1
            ["IDENTITAS", "", "", "", "ABSENSI", "ABSENSI", "ABSENSI", "ABSENSI", "ABSENSI", "ABSENSI", "ABSENSI", "", "GAJI POKOK", "GAJI POKOK", "GAJI POKOK", "", "TUNJANGAN", "TUNJANGAN", "TUNJANGAN", "TUNJANGAN", "", "PREMI", "PREMI", "PREMI", "PREMI", "PREMI", "PREMI", "", "TUNJANGAN", "", "POTONGAN BERSIH", "POTONGAN BERSIH", "POTONGAN BERSIH", "POTONGAN BERSIH", "", "TOTAL", ""],
            // Level 2
            ["", "", "", "", "KEHADIRAN", "KETIDAKHADIRAN", "KETIDAKHADIRAN", "KETIDAKHADIRAN", "KETIDAKHADIRAN", "KETIDAKHADIRAN", "", "", "", "", "", "", "BERAS", "JABATAN", "MASA KERJA", "LEMBUR", "", "BRONDOL", "PRUNING", "", "", "", "", "", "", "", "", "", "", "ASTEK", "BPJS", "SPSI", "PPH21", "", "KOTOR", "BERSIH"],
            // Level 3
            ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "PEKERJA", "", "", "", "", "", "", "", "", ""],
            // Level 4 (column names)
            ["No", "NIK", "Nama", "Jabatan", "AN", "Cuti", "Sakit+Haid", "Minggu", "Nasional", "Jumlah HK", "Total Jam", "", "", "Ideal", "Aktual", "", "Jumlah", "Jumlah", "Jumlah", "Jumlah (Rp)", "", "Jumlah", "Jumlah", "", "", "", "", "Total", "", "", "", "Jumlah", "Jumlah", "Jumlah", "Jumlah", "", "", "Kotor", "Bersih"]
        ];

        // Flatten headers for spreadsheet (each row will be separate)
        // For Apps Script, we'll use a simpler single-row header format
        const flatHeaders = [
            "No", "NIK", "Nama", "Jabatan", "PPH21 TER",
            "AN", "Cuti", "Sakit+Haid", "Minggu", "Nasional", "Jumlah HK", "Total Jam",
            "", "GP Ideal", "GP Aktual", "",
            "Beras Jml", "Jabatan Jml", "Masa Kerja Jml", "Lembur Jml (Rp)", "Total Tunjangan",
            "Premi Brondol", "Premi Pruning", "", "", "", "", "Total Premi",
            "", "Upah Kotor",
            "Astek", "BPJS TK", "BPJS Kes", "SPSI", "Total Potongan",
            "", "Upah Bersih"
        ];

        // Helper to get numeric value
        const val = (v: any) => parseFloat(v) || 0;

        // 4. Build rows with gang headers and gang totals
        const spreadsheetRows: any[][] = [];
        let globalNo = 1;

        sortedGangs.forEach(gangCode => {
            const employees = gangsMap.get(gangCode)!;

            // A. Gang Header Row (merge all cells, show "GANG: XXX")
            const gangHeaderRow = new Array(flatHeaders.length).fill("");
            gangHeaderRow[2] = `GANG: ${gangCode}`; // Put in "Nama" column
            spreadsheetRows.push(gangHeaderRow);

            // B. Sort employees by NIK within gang
            employees.sort((a, b) => {
                const nikA = (a.nik || '').trim();
                const nikB = (b.nik || '').trim();
                return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // C. Calculate gang total while processing employees
            const gangTotal = new Array(flatHeaders.length).fill(0);
            gangTotal[0] = ""; // No
            gangTotal[1] = ""; // NIK
            gangTotal[2] = "TOTAL GANG"; // Nama

            // D. Employee rows
            employees.forEach(emp => {
                const row = [
                    globalNo++, // No
                    emp.nik || "", // NIK
                    emp.nama || "", // Nama
                    emp.jabatan_estate || emp.jabatan || "", // Jabatan
                    val(emp.pot_pph21), // PPH21 TER
                    val(emp.hari_kerja), // AN
                    val(emp.cuti_tahunan_hari), // Cuti
                    val(emp.cuti_sakit_haid_hari), // Sakit+Haid
                    val(emp.cuti_minggu_hari), // Minggu
                    val(emp.cuti_nasional_hari), // Nasional
                    val(emp.jumlah_hk), // Jumlah HK
                    val(emp.total_jam_kerja), // Total Jam
                    "", // (empty)
                    val(emp.gaji_pokok_ideal), // GP Ideal
                    val(emp.gaji_pokok_aktual), // GP Aktual
                    "", // (empty)
                    val(emp.beras_jumlah), // Beras Jml
                    val(emp.jabatan_jumlah), // Jabatan Jml
                    val(emp.masa_kerja_jumlah), // Masa Kerja Jml
                    val(emp.lembur_jumlah), // Lembur Jml
                    val(emp.total_tunjangan), // Total Tunjangan
                    val(emp.premi_brondol), // Premi Brondol
                    val(emp.premi_pruning), // Premi Pruning
                    "", "", "", "", // Empty for dynamic premi columns
                    val(emp.total_premi), // Total Premi
                    "", // (empty)
                    val(emp.jumlah_upah_kotor), // Upah Kotor
                    val(emp.pot_astek), // Astek
                    val(emp.pot_bpjs_kesehatan_pekerja), // BPJS TK
                    val(emp.pot_spsi), // SPSI
                    val(emp.pot_pph21), // PPH21
                    val(emp.total_potongan_bersih), // Total Potongan
                    "", // (empty)
                    val(emp.upah_bersih) // Upah Bersih
                ];
                spreadsheetRows.push(row);

                // Accumulate gang total (skip non-numeric columns)
                const numericIndices = [4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 17, 18, 19, 20, 21, 22, 24, 26, 27, 28, 29, 30, 31, 33];
                numericIndices.forEach((idx, i) => {
                    if (idx < row.length) {
                        const value = parseFloat(row[idx]) || 0;
                        gangTotal[idx] = (gangTotal[idx] as number) + value;
                    }
                });
            });

            // E. Add Gang Total Row
            spreadsheetRows.push(gangTotal);
        });

        // 5. Calculate and Add Grand Total Row
        const grandTotal = new Array(flatHeaders.length).fill(0);
        grandTotal[0] = ""; // No
        grandTotal[1] = ""; // NIK
        grandTotal[2] = "GRAND TOTAL"; // Nama

        // Sum all gang totals (they start at index 4)
        const numericIndices = [4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 17, 18, 19, 20, 21, 22, 24, 26, 27, 28, 29, 30, 31, 33];

        spreadsheetRows.forEach(row => {
            // Only sum rows that are NOT gang headers or totals
            if (row[2] && !row[2].toString().includes("GANG") && !row[2].toString().includes("TOTAL")) {
                numericIndices.forEach((idx, i) => {
                    if (idx < row.length) {
                        const value = parseFloat(row[idx]) || 0;
                        grandTotal[idx] = (grandTotal[idx] as number) + value;
                    }
                });
            }
        });

        spreadsheetRows.push(grandTotal);

        // 6. Prepare Payload for Apps Script
        const payload = {
            secret: scriptSecret,
            division: division,
            month: month,
            year: year,
            headers: flatHeaders,
            rows: spreadsheetRows,
            format: "DAFTAR_UPAH" // Indicate format type
        };

        // 7. Send to Web App
        try {
            const response = await fetch(scriptUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Apps Script Error (${response.status}): ${text}`);
            }

            const result: any = await response.json();

            if (result.status === 'error') {
                throw new Error(`Apps Script Detailed Error: ${result.message}`);
            }

            console.log(`[AppsScriptService] Sync Success for ${division}:`, result);
            return result;

        } catch (error) {
            console.error(`[AppsScriptService] Sync Failed for ${division}:`, error);
            throw error;
        }
    }

    /**
     * Sync Dashboard Summary Data (High Level Overview)
     */
    static async syncDashboard(month: number, year: number) {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
        const scriptSecret = process.env.GOOGLE_SCRIPT_SECRET;

        if (!scriptUrl || !scriptSecret) {
            throw new Error("Missing GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_SECRET");
        }

        console.log(`[AppsScriptService] Syncing DASHBOARD (${month}/${year})...`);

        // 1. Fetch all necessary data
        const summaryService = SummaryService.getInstance();

        // A. Comparison Data (includes current & previous totals)
        const comparisonData = await summaryService.getAllDivisionsComparison(month, year);

        // B. Impact Analysis
        const impactData = await summaryService.getImpactReportData(month, year);

        // 2. Structure Payload for GAS
        const payload = {
            secret: scriptSecret,
            type: "DASHBOARD",
            month: month,
            year: year,
            data: {
                kpi: comparisonData.kpi_summary,
                comparisons: comparisonData.divisions,
                impact: {
                    hk_analysis: impactData.hk_analysis,
                    main_table: impactData.main_table,
                    pruning_table: impactData.pruning_table
                }
            }
        };

        // 3. Send to Web App
        try {
            const response = await fetch(scriptUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Apps Script Error (${response.status}): ${text}`);
            }

            const result: any = await response.json();
            console.log(`[AppsScriptService] Dashboard Sync Success:`, result);
            return result;

        } catch (error) {
            console.error(`[AppsScriptService] Dashboard Sync Failed:`, error);
            throw error;
        }
    }
}
