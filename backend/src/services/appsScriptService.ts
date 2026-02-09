import { Config } from "../config";
import { AggregationRecord } from "./payrollDataService";
import { SummaryService } from "./summaryService";

/**
 * Multi-level header definition matching Daftar Upah format
 * Original structure: 34 columns to match employee data
 */
const MULTI_LEVEL_HEADERS = [
    // IDENTITAS (4 columns)
    { field: 'no', headers: ['IDENTITAS', null, null, 'NO'] },
    { field: 'nik', headers: ['IDENTITAS', null, null, 'NIK'] },
    { field: 'nama', headers: ['IDENTITAS', null, null, 'NAMA'] },
    { field: 'jabatan', headers: ['IDENTITAS', null, null, 'JABATAN'] },

    // ABSENSI (6 columns)
    { field: 'hari_kerja', headers: ['ABSENSI', 'KEHADIRAN', null, 'AN'] },
    { field: 'cuti_tahunan_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'CUTI'] },
    { field: 'cuti_sakit_haid_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'SAKIT+HAID'] },
    { field: 'cuti_minggu_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'MINGGU'] },
    { field: 'cuti_nasional_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'NASIONAL'] },
    { field: 'jumlah_hk', headers: ['ABSENSI', 'REKAP', null, 'JUMLAH HK'] },

    // GAJI POKOK (3 columns)
    { field: 'gaji_pokok', headers: ['GAJI POKOK', null, null, 'JUMLAH'] },
    { field: 'gaji_pokok_ideal', headers: ['GAJI POKOK', null, null, 'IDEAL'] },
    { field: 'gaji_pokok_aktual', headers: ['GAJI POKOK', null, null, 'AKTUAL'] },

    // TUNJANGAN (5 columns)
    { field: 'beras_jumlah', headers: ['TUNJANGAN', 'BERAS', null, 'JUMLAH'] },
    { field: 'jabatan_jumlah', headers: ['TUNJANGAN', 'JABATAN', null, 'JUMLAH'] },
    { field: 'masa_kerja_jumlah', headers: ['TUNJANGAN', 'MASA KERJA', null, 'JUMLAH'] },
    { field: 'lembur_jumlah', headers: ['TUNJANGAN', 'LEMBUR', null, 'JUMLAH'] },
    { field: 'total_tunjangan', headers: ['TUNJANGAN', null, null, 'TOTAL'] },

    // PREMI (6 columns: brondol, pruning, 3 empty, total)
    { field: 'premi_brondol', headers: ['PREMI', 'BRONDOL', null, 'JUMLAH'] },
    { field: 'premi_pruning', headers: ['PREMI', 'PRUNING', null, 'JUMLAH'] },
    { field: 'premi_empty_1', headers: ['PREMI', 'DINAMIS', null, ''] },
    { field: 'premi_empty_2', headers: ['PREMI', 'DINAMIS', null, ''] },
    { field: 'premi_empty_3', headers: ['PREMI', 'DINAMIS', null, ''] },
    { field: 'total_premi', headers: ['PREMI', null, null, 'TOTAL'] },

    // POTONGAN (8 columns: 3 empty, astek, bpjs, spsi, pph21, total)
    { field: 'pot_empty_1', headers: ['POTONGAN', 'DINAMIS', null, ''] },
    { field: 'pot_empty_2', headers: ['POTONGAN', 'DINAMIS', null, ''] },
    { field: 'pot_empty_3', headers: ['POTONGAN', 'DINAMIS', null, ''] },
    { field: 'pot_astek', headers: ['POTONGAN', 'ASTEK', 'PEKERJA', 'JUMLAH'] },
    { field: 'pot_bpjs_kesehatan_pekerja', headers: ['POTONGAN', 'BPJS', 'PEKERJA', 'JUMLAH'] },
    { field: 'pot_spsi', headers: ['POTONGAN', 'SPSI', null, 'JUMLAH'] },
    { field: 'pot_pph21', headers: ['POTONGAN', 'PPH21', null, 'JUMLAH'] },
    { field: 'total_potongan_bersih', headers: ['POTONGAN', null, null, 'TOTAL'] },

    // TOTAL (2 columns)
    { field: 'jumlah_upah_kotor', headers: ['TOTAL', null, null, 'KOTOR'] },
    { field: 'upah_bersih', headers: ['TOTAL', null, null, 'BERSIH'] }
];

export class AppsScriptService {
    /**
     * Sync division data to Google Spreadsheet via Apps Script Web App
     * Format matches Daftar Upah with multi-level headers, gang headers, gang totals, and grand total
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

        console.log(`[AppsScriptService] Syncing ${division} (${month}/${year}) to Spreadsheet (Daftar Upah Multi-Level Format)...`);

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

        // 3. Build multi-level headers (4 levels)
        const headers = this.buildMultiLevelHeaders();
        const flatHeaders = this.flattenHeaders(headers);

        // Helper to get numeric value
        const val = (v: any) => parseFloat(v) || 0;

        // 4. Build rows with gang headers and gang totals
        const spreadsheetRows: any[][] = [];
        let globalNo = 1;

        sortedGangs.forEach(gangCode => {
            const employees = gangsMap.get(gangCode)!;

            // A. Gang Header Row
            const gangHeaderRow = new Array(flatHeaders.length).fill("");
            gangHeaderRow[2] = `GANG: ${gangCode}`; // Put in "Nama" column (index 2)
            spreadsheetRows.push(gangHeaderRow);

            // B. Sort employees by NIK within gang
            employees.sort((a, b) => {
                const nikA = (a.nik || '').trim();
                const nikB = (b.nik || '').trim();
                return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // C. Calculate gang total
            const gangTotal = new Array(flatHeaders.length).fill(0);
            gangTotal[0] = ""; // No
            gangTotal[1] = ""; // NIK
            gangTotal[2] = "TOTAL GANG"; // Nama

            // D. Employee rows
            employees.forEach(emp => {
                const row = this.buildEmployeeRow(emp, globalNo++, flatHeaders.length);
                spreadsheetRows.push(row);

                // Accumulate gang total for numeric columns
                this.accumulateTotal(gangTotal, row);
            });

            // E. Add Gang Total Row
            spreadsheetRows.push(gangTotal);
        });

        // 5. Calculate and Add Grand Total Row
        const grandTotal = this.calculateGrandTotal(spreadsheetRows, flatHeaders.length);
        spreadsheetRows.push(grandTotal);

        // 6. Prepare Payload for Apps Script
        const payload = {
            secret: scriptSecret,
            division: division,
            month: month,
            year: year,
            headers: headers, // Multi-level headers!
            rows: spreadsheetRows,
            format: "DAFTAR_UPAH_MULTILEVEL"
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
     * Build simple single-row headers for now
     * TODO: Implement proper multi-level headers with cell merging
     */
    private static buildMultiLevelHeaders() {
        // Just return the bottom level (level 3) with column names
        const headers: string[] = [];
        for (const colDef of MULTI_LEVEL_HEADERS) {
            headers.push(colDef.headers[3]);
        }
        return headers;
    }

    /**
     * Flatten multi-level headers for spreadsheet (for backward compatibility)
     */
    private static flattenHeaders(headers: any[][]) {
        // Return the bottom level (level 3) with column names
        return headers[headers.length - 1];
    }

    /**
     * Build employee data row matching the header structure
     * Original structure: 34 columns
     */
    private static buildEmployeeRow(emp: any, no: number, numCols: number): any[] {
        const val = (v: any) => parseFloat(v) || 0;

        return [
            no,                              // 0: No
            emp.nik || "",                   // 1: NIK
            emp.nama || "",                   // 2: Nama
            emp.jabatan_estate || emp.jabatan || "",  // 3: Jabatan

            // ABSENSI (6 columns)
            val(emp.hari_kerja),             // 4: AN
            val(emp.cuti_tahunan_hari),      // 5: Cuti
            val(emp.cuti_sakit_haid_hari),    // 6: Sakit+Haid
            val(emp.cuti_minggu_hari),        // 7: Minggu
            val(emp.cuti_nasional_hari),      // 8: Nasional
            val(emp.jumlah_hk),               // 9: Jumlah HK

            // GAJI POKOK (3 columns)
            val(emp.gaji_pokok),              // 10: Jumlah
            val(emp.gaji_pokok_ideal),        // 11: Ideal
            val(emp.gaji_pokok_aktual),        // 12: Aktual

            // TUNJANGAN (5 columns)
            val(emp.beras_jumlah),           // 13: Beras
            val(emp.jabatan_jumlah),          // 14: Jabatan
            val(emp.masa_kerja_jumlah),       // 15: Masa Kerja
            val(emp.lembur_jumlah),           // 16: Lembur
            val(emp.total_tunjangan),         // 17: Total

            // PREMI (6 columns with empty placeholders)
            val(emp.premi_brondol),           // 18: Brondol
            val(emp.premi_pruning),            // 19: Pruning
            "", "", "",                       // 20-22: Empty for dynamic premi
            val(emp.total_premi),             // 23: Total

            // POTONGAN (8 columns with empty placeholders)
            "", "", "",                       // 24-26: Empty for dynamic potongan
            val(emp.pot_astek),              // 27: Astek
            val(emp.pot_bpjs_kesehatan_pekerja), // 28: BPJS TK
            val(emp.pot_spsi),                 // 29: SPSI
            val(emp.pot_pph21),                // 30: PPH21
            val(emp.total_potongan_bersih),   // 31: Total

            // TOTAL (2 columns)
            val(emp.jumlah_upah_kotor),       // 32: Kotor
            val(emp.upah_bersih)               // 33: Bersih
        ];
    }

    /**
     * Accumulate values into total array
     * Original structure: 34 columns total
     */
    private static accumulateTotal(total: any[], row: any[]): void {
        // Columns that should be summed (numeric columns only)
        // Skip empty columns (20-22, 24-26)
        const sumIndices = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 23, 27, 28, 29, 30, 31, 32, 33];

        sumIndices.forEach(idx => {
            if (idx < row.length) {
                const value = parseFloat(row[idx]) || 0;
                total[idx] = (total[idx] as number) + value;
            }
        });
    }

    /**
     * Calculate grand total from all employee rows
     */
    private static calculateGrandTotal(rows: any[][], numCols: number): any[] {
        const grandTotal = new Array(numCols).fill(0);
        grandTotal[0] = ""; // No
        grandTotal[1] = ""; // NIK
        grandTotal[2] = "GRAND TOTAL"; // Nama

        // Sum only employee rows (not gang headers or totals)
        rows.forEach(row => {
            const thirdCol = row[2] ? row[2].toString() : "";

            // Skip non-employee rows
            if (!thirdCol.startsWith("GANG") && !thirdCol.includes("TOTAL")) {
                this.accumulateTotal(grandTotal, row);
            }
        });

        return grandTotal;
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
