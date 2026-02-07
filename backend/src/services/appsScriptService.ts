import { Config } from "../config";
import { AggregationRecord } from "./payrollDataService";

export class AppsScriptService {
    /**
     * Sync division data to Google Spreadsheet via Apps Script Web App
     */
    /**
     * Sync division data to Google Spreadsheet via Apps Script Web App
     */
    static async syncDivisionToSpreadsheet(
        division: string,
        month: number,
        year: number,
        records: any[] // Changed from AggregationRecord[] to detailed employee records
    ) {
        const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
        const scriptSecret = process.env.GOOGLE_SCRIPT_SECRET;

        if (!scriptUrl || !scriptSecret) {
            throw new Error("Missing GOOGLE_SCRIPT_URL or GOOGLE_SCRIPT_SECRET in environment variables");
        }

        console.log(`[AppsScriptService] Syncing ${division} (${month}/${year}) to Spreadsheet (Detailed)...`);

        // 1. Transform Data for Spreadsheet (Array of Arrays)
        // Header Row - Detailed "Daftar Upah" format
        const headers = [
            "No",
            "NIK",
            "Nama",
            "Jabatan",
            "PPH21 TER",
            "AN",
            "Cuti",
            "Sakit+Haid",
            "Minggu",
            "Nasional",
            "Jumlah HK",
            "Total Jam",
            "Upah Dasar",
            "GP Ideal",
            "GP Aktual",
            "Koreksi HK",
            "Rate Beras",
            "Jumlah Beras",
            "Lembur (Rp)",
            "Premi Brondol",
            "Premi Panen",
            "Premi Kinerja",
            "Premi Pruning",
            "Premi Koreksi",
            "Total Premi",
            "Tunj. Jabatan",
            "Total Tunjangan",
            "Upah Kotor",
            "Pot. BPJS TK",
            "Pot. BPJS Kes",
            "Pot. SPSI",
            "Total Potongan",
            "Upah Bersih"
        ];

        // Process records to extract dynamic premi components for categorization
        const processedRows = records.map((r, index) => {
            // Helper to safe parse float or int
            const val = (v: any) => parseFloat(v) || 0;

            // Extract dynamic premi
            let p_panen = 0;
            let p_kinerja = 0;
            let p_pruning = 0;
            let p_koreksi = 0;

            for (const [key, value] of Object.entries(r)) {
                if (key.startsWith('premi_') && (value as number) !== 0) {
                    const k = key.toLowerCase();
                    if (k === 'premi_brondol' || k === 'premi_pph' || k === 'total_premi') continue;

                    if (k.includes('insentif') || k.includes('panen')) p_panen += val(value);
                    else if (k.includes('kinerja')) p_kinerja += val(value);
                    else if ((k.includes('prun') || k.includes('pruning'))) p_pruning += val(value);
                    else if (k.includes('koreksi')) p_koreksi += val(value);
                    else {
                        // Default to performance/kinerja if unknown
                        p_kinerja += val(value);
                    }
                }

                // Also check KOREKSI_* fields from dynamic potongan/koreksi
                if (key.startsWith('KOREKSI') && (value as number) !== 0) {
                    p_koreksi += val(value);
                }
            }

            // Return mapped row matching defined headers
            return [
                index + 1,
                r.nik || "",
                r.nama || "",
                r.jabatan_estate || r.jabatan || "", // User requested layout
                val(r.pot_pph21), // PPH21 TER
                val(r.hari_kerja), // AN
                val(r.cuti_tahunan_hari), // CUTI
                val(r.cuti_sakit_haid_hari), // SAKIT+HAID
                val(r.cuti_minggu_hari), // MINGGU
                val(r.cuti_nasional_hari), // NASIONAL
                val(r.jumlah_hk), // JUMLAH HK
                val(r.total_jam_kerja), // TOTAL JAM
                val(r.upah_dasar), // UPAH DASAR
                val(r.gaji_pokok_ideal), // GP IDEAL
                val(r.gaji_pokok_aktual), // GP AKTUAL
                val(r.koreksi_hk), // KOREKSI HK
                val(r.beras_rate), // RATE (Beras)
                val(r.beras_jumlah), // JUMLAH (Beras)
                // Additional Financials
                val(r.lembur_jumlah),
                val(r.premi_brondol),
                p_panen,
                p_kinerja,
                p_pruning,
                p_koreksi,
                val(r.total_premi),
                val(r.jabatan_jumlah),
                val(r.total_tunjangan),
                val(r.jumlah_upah_kotor),
                val(r.pot_bpjs_pekerja_total), // BPJS TK
                val(r.pot_bpjs_kesehatan_pekerja),
                val(r.pot_spsi),
                val(r.total_potongan), // Includes PPh21 from logic? No, pot_pph21 is separate in layout?
                val(r.upah_bersih)
            ];
        });

        // 2. Prepare Payload
        const payload = {
            secret: scriptSecret,
            division: division,
            month: month,
            year: year,
            headers: headers,
            rows: processedRows
        };

        // 3. Send to Web App
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
}
