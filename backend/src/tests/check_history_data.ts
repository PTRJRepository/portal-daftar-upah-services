/**
 * Compare PPH21 from Daftar Upah (history) vs Tax Report for specific employee
 * NIK: 1902050811890001, Division: PG2B
 * Run: bun run src/tests/check_history_data.ts
 */
import { historyDatabaseService } from '../services/historyDatabaseService';
import { taxReportService } from '../services/taxReportService';
import { writeFileSync } from 'fs';

async function main() {
    const targetNik = '1902050811890001';
    const year = 2025;
    const division = 'PG2B';

    const results: any[] = [];

    // Compare across months 1-12
    for (let month = 1; month <= 12; month++) {
        try {
            // Get history data (= what Daftar Upah shows for past periods)
            const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
                month, year, 'ALL', undefined
            );

            // Get tax report data
            const taxData = await taxReportService.getMonthlyTaxReport(year, month, undefined);

            if (!historyData || historyData.data_rows.length === 0) {
                results.push({ month, error: 'No history data' });
                continue;
            }

            // Find employee by NIK
            const histRow = historyData.data_rows.find((r: any) =>
                String(r.nik || '').trim() === targetNik ||
                String(r.nik_ktp || '').trim() === targetNik
            );

            if (!histRow) {
                results.push({ month, error: `Employee NIK ${targetNik} not found in history` });
                continue;
            }

            const empCode = histRow.emp_code;
            const taxRow = taxData.employees.find((e: any) => e.emp_code === empCode);

            results.push({
                month,
                emp_code: empCode,
                emp_name: (histRow.nama || histRow.emp_name || '').substring(0, 25),
                daftar_upah: {
                    gaji_pokok_aktual: histRow.gaji_pokok_aktual,
                    total_tunjangan: histRow.total_tunjangan,
                    total_premi: histRow.total_premi,
                    premi_pph: histRow.premi_pph,
                    pot_koreksi: histRow.pot_koreksi,
                    jumlah_upah_kotor: histRow.jumlah_upah_kotor,
                    penghasilan_bruto: histRow.penghasilan_bruto,
                    pph21_ter: histRow.pph21_ter,
                    pot_pph21: histRow.pot_pph21,
                    tarif_pajak_ter: histRow.tarif_pajak_ter,
                },
                tax_report: taxRow ? {
                    gaji_pokok_aktual: taxRow.gaji_pokok_aktual,
                    total_tunjangan: taxRow.total_tunjangan,
                    total_premi: taxRow.total_premi,
                    premi_pph: taxRow.premi_pph,
                    pot_koreksi: taxRow.pot_koreksi,
                    upah_kotor: taxRow.upah_kotor,
                    penghasilan_bruto: taxRow.penghasilan_bruto,
                    pph21_ter: taxRow.pph21_ter,
                    tarif_pajak_ter: taxRow.tarif_pajak_ter,
                } : 'NOT FOUND IN TAX REPORT',
                diffs: taxRow ? {
                    upah_kotor: histRow.jumlah_upah_kotor - taxRow.upah_kotor,
                    penghasilan_bruto: (histRow.penghasilan_bruto || 0) - (taxRow.penghasilan_bruto || 0),
                    pph21: (histRow.pph21_ter || histRow.pot_pph21 || 0) - (taxRow.pph21_ter || 0),
                } : null,
            });
        } catch (e: any) {
            results.push({ month, error: e.message });
        }
    }

    writeFileSync('check_result.json', JSON.stringify(results, null, 2), 'utf8');
    console.log("Written to check_result.json");
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
