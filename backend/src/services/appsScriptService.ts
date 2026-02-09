import { Config } from "../config";
import { AggregationRecord } from "./payrollDataService";
import { SummaryService } from "./summaryService";

export class AppsScriptService {
    /**
     * Sync division data to Google Spreadsheet via Apps Script Web App
     * Handles DYNAMIC columns for premi and potongan
     */
    static async syncDivisionToSpreadsheet(
        division: string,
        month: number,
        year: number,
        records: any[] // Flat employee records with dynamic fields
    ) {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
        const scriptSecret = process.env.GOOGLE_SCRIPT_SECRET;

        if (!scriptUrl || !scriptSecret) {
            throw new Error("Missing GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_SECRET in environment variables");
        }

        console.log(`[AppsScriptService] Syncing ${division} (${month}/${year}) to Spreadsheet (Dynamic Column Format)...`);

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

        // 3. Build DYNAMIC column structure by scanning all records
        const dynamicColumns = this.buildDynamicColumnStructure(records);

        // 4. Build headers dynamically
        const headers = this.buildDynamicHeaders(dynamicColumns);

        // Get the actual number of columns from headers
        const numCols = headers[0].length;
        console.log(`[AppsScriptService] Built headers: ${headers.length} levels, ${numCols} columns`);
        console.log(`[AppsScriptService] Headers structure:`, JSON.stringify(headers.map(h => h.slice(0, 10)))); // Log first 10 columns of each level

        // 5. Build rows with gang headers and gang totals
        const spreadsheetRows: any[][] = [];
        let globalNo = 1;

        sortedGangs.forEach(gangCode => {
            const employees = gangsMap.get(gangCode)!;

            // A. Gang Header Row - use numCols instead of headers.length
            const gangHeaderRow = new Array(numCols).fill("");
            gangHeaderRow[2] = `GANG: ${gangCode}`; // Put in "Nama" column (index 2)
            spreadsheetRows.push(gangHeaderRow);

            // B. Sort employees by NIK within gang
            employees.sort((a, b) => {
                const nikA = (a.nik || '').trim();
                const nikB = (b.nik || '').trim();
                return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // C. Calculate gang total - use numCols instead of headers.length
            const gangTotal = new Array(numCols).fill(0);
            gangTotal[0] = ""; // No
            gangTotal[1] = ""; // NIK
            gangTotal[2] = "TOTAL GANG"; // Nama

            // D. Employee rows
            employees.forEach(emp => {
                const row = this.buildDynamicEmployeeRow(emp, globalNo++, dynamicColumns);
                spreadsheetRows.push(row);

                // Accumulate gang total for numeric columns
                this.accumulateDynamicTotal(gangTotal, row);
            });

            // E. Add Gang Total Row
            spreadsheetRows.push(gangTotal);
        });

        // 6. Calculate and Add Grand Total Row - use numCols instead of headers.length
        const grandTotal = this.calculateDynamicGrandTotal(spreadsheetRows, numCols);
        spreadsheetRows.push(grandTotal);

        console.log(`[AppsScriptService] Total rows: ${spreadsheetRows.length}, First row has ${spreadsheetRows[0]?.length} columns`);

        // Validate all rows have same column count
        const colCounts = spreadsheetRows.map(r => r.length);
        const uniqueColCounts = [...new Set(colCounts)];
        if (uniqueColCounts.length > 1) {
            console.error(`[AppsScriptService] ERROR: Inconsistent column counts!`, uniqueColCounts);
            throw new Error(`Inconsistent row lengths: ${uniqueColCounts.join(', ')}`);
        }

        // 7. Prepare Payload for Apps Script
        const payload = {
            secret: scriptSecret,
            division: division,
            month: month,
            year: year,
            headers: headers,
            rows: spreadsheetRows,
            format: "DAFTAR_UPAH_DYNAMIC"
        };

        // 8. Send to Web App
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
     * Build dynamic column structure by scanning all employee records
     * Returns list of all unique dynamic field names for premi and potongan
     */
    private static buildDynamicColumnStructure(records: any[]) {
        const dynamicPremiFields = new Set<string>();
        const dynamicPotonganFields = new Set<string>();

        // Scan all records for dynamic fields
        records.forEach(emp => {
            // Find all fields starting with 'premi_' except static ones
            Object.keys(emp).forEach(key => {
                if (key.startsWith('premi_') &&
                    key !== 'premi_brondol' &&
                    key !== 'premi_pruning' &&
                    key !== 'total_premi') {
                    dynamicPremiFields.add(key);
                }

                // Find all fields starting with 'pot_' except static ones
                if (key.startsWith('pot_') &&
                    key !== 'pot_astek' &&
                    key !== 'pot_bpjs_kesehatan_pekerja' &&
                    key !== 'pot_bpjs_kesehatan_majikan' &&
                    key !== 'pot_spsi' &&
                    key !== 'pot_pph21' &&
                    key !== 'pot_pph21_ter' &&
                    key !== 'total_potongan_bersih') {
                    dynamicPotonganFields.add(key);
                }
            });
        });

        return {
            dynamicPremiFields: Array.from(dynamicPremiFields).sort(),
            dynamicPotonganFields: Array.from(dynamicPotonganFields).sort()
        };
    }

    /**
     * Build MULTI-LEVEL headers dynamically based on actual columns present
     * Returns array of arrays where each sub-array is a header level
     */
    private static buildDynamicHeaders(dynamicCols: ReturnType<typeof AppsScriptService.buildDynamicColumnStructure>): string[][] {
        const level0: string[] = [];  // Top level (main categories)
        const level1: string[] = [];  // Second level (sub-categories)
        const level2: string[] = [];  // Third level (detail sub-categories)
        const level3: string[] = [];  // Bottom level (column names)

        // Helper to add empty value for spanning
        const empty = "";

        // Count columns for positioning
        let colIndex = 0;

        // IDENTITAS (4 columns)
        for (let i = 0; i < 4; i++) {
            level0.push('IDENTITAS');
            level1.push(empty);
            level2.push(empty);
        }
        level3.push('NO', 'NIK', 'NAMA', 'JABATAN');
        colIndex += 4;

        // ABSENSI (6 columns)
        // First 1 column: KEHADIRAN
        level0.push('ABSENSI');
        level1.push('KEHADIRAN');
        level2.push(empty);
        level3.push('AN');
        colIndex++;

        // Next 4 columns: KETIDAKHADIRAN
        for (let i = 0; i < 4; i++) {
            level0.push('ABSENSI');
            level1.push('KETIDAKHADIRAN');
            level2.push(empty);
        }
        level3.push('CUTI', 'SAKIT+HAID', 'MINGGU', 'NASIONAL');
        colIndex += 4;

        // Last column: REKAP
        level0.push('ABSENSI');
        level1.push('REKAP');
        level2.push(empty);
        level3.push('JUMLAH HK');
        colIndex++;

        // GAJI POKOK (3 columns)
        for (let i = 0; i < 3; i++) {
            level0.push('GAJI POKOK');
            level1.push(empty);
            level2.push(empty);
        }
        level3.push('JUMLAH', 'IDEAL', 'AKTUAL');
        colIndex += 3;

        // TUNJANGAN (5 columns)
        level0.push('TUNJANGAN');
        level1.push('BERAS');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        level0.push('TUNJANGAN');
        level1.push('JABATAN');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        level0.push('TUNJANGAN');
        level1.push('MASA KERJA');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        level0.push('TUNJANGAN');
        level1.push('LEMBUR');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        level0.push('TUNJANGAN');
        level1.push(empty);
        level2.push(empty);
        level3.push('TOTAL');
        colIndex++;

        // PREMI - Brondol, Pruning, Dynamic fields, Total
        level0.push('PREMI');
        level1.push('BRONDOL');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        level0.push('PREMI');
        level1.push('PRUNING');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        dynamicCols.dynamicPremiFields.forEach(field => {
            level0.push('PREMI');
            level1.push('PREMI DINAMIS');
            level2.push(empty);
            const displayName = field.replace('premi_', '').replace(/_/g, ' ').toUpperCase();
            level3.push(displayName);
            colIndex++;
        });

        level0.push('PREMI');
        level1.push(empty);
        level2.push(empty);
        level3.push('TOTAL');
        colIndex++;

        // POTONGAN - Dynamic fields, then static
        dynamicCols.dynamicPotonganFields.forEach(field => {
            level0.push('POTONGAN');
            level1.push('POTONGAN DINAMIS');
            level2.push(empty);
            const displayName = field.replace('pot_', '').replace(/_/g, ' ').toUpperCase();
            level3.push(displayName);
            colIndex++;
        });

        // Static potongan fields (matching data row: pot_astek, pot_bpjs_kesehatan_pekerja, pot_spsi, pot_pph21, total_potongan_bersih)
        // ASTEK
        level0.push('POTONGAN');
        level1.push('ASTEK');
        level2.push(empty);
        level3.push('PEKERJA');
        colIndex++;

        // BPJS
        level0.push('POTONGAN');
        level1.push('BPJS');
        level2.push('PEKERJA');
        level3.push('JUMLAH');
        colIndex++;

        // SPSI
        level0.push('POTONGAN');
        level1.push('SPSI');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        // PPH21
        level0.push('POTONGAN');
        level1.push('PPH21');
        level2.push(empty);
        level3.push('JUMLAH');
        colIndex++;

        // Total potongan
        level0.push('POTONGAN');
        level1.push(empty);
        level2.push(empty);
        level3.push('TOTAL');
        colIndex++;

        // TOTAL (2 columns)
        for (let i = 0; i < 2; i++) {
            level0.push('TOTAL');
            level1.push(empty);
            level2.push(empty);
        }
        level3.push('KOTOR', 'BERSIH');

        // ========== ANALISIS LEMBUR ==========
        // Get unique task_desc from all employee lembur records
        const lemburTasks = new Set<string>();
        records.forEach(emp => {
            if (emp.lembur_records && Array.isArray(emp.lembur_records)) {
                emp.lembur_records.forEach((record: any) => {
                    const taskDesc = record.task_desc || record.task_code || 'LAINNYA';
                    lemburTasks.add(taskDesc);
                });
            }
        });
        const sortedLemburTasks = Array.from(lemburTasks).sort();

        // For each task, add 2 columns: JAM, JUMLAH
        sortedLemburTasks.forEach(task => {
            const taskName = task.replace(/\s+/g, ' ').toUpperCase().substring(0, 15); // Limit length
            level0.push('ANALISIS LEMBUR');
            level1.push(taskName);
            level2.push('JAM');
            level3.push('JAM');
            colIndex++;

            level0.push('ANALISIS LEMBUR');
            level1.push(taskName);
            level2.push('JUMLAH');
            level3.push('RP');
            colIndex++;
        });

        // ========== ANALISIS PREMI ==========
        // Premi columns breakdown: Brondol, Pruning, Dynamic
        level0.push('ANALISIS PREMI');
        level1.push('BRONDOL');
        level2.push('JUMLAH');
        level3.push('RP');
        colIndex++;

        level0.push('ANALISIS PREMI');
        level1.push('PRUNING');
        level2.push('JUMLAH');
        level3.push('RP');
        colIndex++;

        dynamicCols.dynamicPremiFields.forEach(field => {
            const displayName = field.replace('premi_', '').replace(/_/g, ' ').toUpperCase().substring(0, 15);
            level0.push('ANALISIS PREMI');
            level1.push(displayName);
            level2.push('JUMLAH');
            level3.push('RP');
            colIndex++;
        });

        return [level0, level1, level2, level3];
    }

    /**
     * Build employee data row dynamically based on actual columns
     */
    private static buildDynamicEmployeeRow(emp: any, no: number, dynamicCols: ReturnType<typeof AppsScriptService.buildDynamicColumnStructure>): any[] {
        const val = (v: any) => parseFloat(v) || 0;
        const row: any[] = [];

        // IDENTITAS (4)
        row.push(no, emp.nik || "", emp.nama || "", emp.jabatan_estate || emp.jabatan || "");

        // ABSENSI (6)
        row.push(
            val(emp.hari_kerja),
            val(emp.cuti_tahunan_hari),
            val(emp.cuti_sakit_haid_hari),
            val(emp.cuti_minggu_hari),
            val(emp.cuti_nasional_hari),
            val(emp.jumlah_hk)
        );

        // GAJI POKOK (3)
        row.push(val(emp.gaji_pokok), val(emp.gaji_pokok_ideal), val(emp.gaji_pokok_aktual));

        // TUNJANGAN (5)
        row.push(
            val(emp.beras_jumlah),
            val(emp.jabatan_jumlah),
            val(emp.masa_kerja_jumlah),
            val(emp.lembur_jumlah),
            val(emp.total_tunjangan)
        );

        // PREMI - Static
        row.push(val(emp.premi_brondol), val(emp.premi_pruning));

        // PREMI - Dynamic
        dynamicCols.dynamicPremiFields.forEach(field => {
            row.push(val(emp[field]));
        });

        // PREMI - Total
        row.push(val(emp.total_premi));

        // POTONGAN - Dynamic
        dynamicCols.dynamicPotonganFields.forEach(field => {
            row.push(val(emp[field]));
        });

        // POTONGAN - Static
        row.push(
            val(emp.pot_astek),
            val(emp.pot_bpjs_kesehatan_pekerja),
            val(emp.pot_spsi),
            val(emp.pot_pph21),
            val(emp.total_potongan_bersih)
        );

        // TOTAL (2)
        row.push(val(emp.jumlah_upah_kotor), val(emp.upah_bersih));

        return row;
    }

    /**
     * Accumulate values into total array (dynamic)
     */
    private static accumulateDynamicTotal(total: any[], row: any[]): void {
        // Skip label columns (indices 0-3)
        for (let i = 4; i < row.length; i++) {
            if (i < row.length) {
                const value = parseFloat(row[i]) || 0;
                total[i] = (total[i] as number) + value;
            }
        }
    }

    /**
     * Calculate grand total from all employee rows (dynamic)
     */
    private static calculateDynamicGrandTotal(rows: any[][], numCols: number): any[] {
        const grandTotal = new Array(numCols).fill(0);
        grandTotal[0] = ""; // No
        grandTotal[1] = ""; // NIK
        grandTotal[2] = "GRAND TOTAL"; // Nama

        // Sum only employee rows (not gang headers or totals)
        rows.forEach(row => {
            const thirdCol = row[2] ? row[2].toString() : "";

            // Skip non-employee rows
            if (!thirdCol.startsWith("GANG") && !thirdCol.includes("TOTAL")) {
                this.accumulateDynamicTotal(grandTotal, row);
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
