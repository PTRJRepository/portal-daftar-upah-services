import { Database } from '../../backend/src/db/client';
import { Config } from '../../backend/src/config';
import fs from 'fs';
import path from 'path';

async function inspectThrDetails() {
    let output = "";
    try {
        const db = Database.getInstance('extend_db_ptrj', Config.DB_EXTEND_PROFILE || 'SERVER_PROFILE_1');

        // Get ALL rows and analyze
        const allDetailRows = await db.query(`
            SELECT division_code, gang_code, nik, emp_name, amount, details_json
            FROM dbo.employee_other_incomes 
            WHERE period_year = 2026 AND period_month = 2 AND income_type = 'THR'
            ORDER BY division_code, nik
        `);

        output += `Total records: ${(allDetailRows as any[]).length}\n\n`;

        const divTotals: Record<string, { cnt: number, beras: number, masaKerja: number, thr: number, samples: any[] }> = {};
        for (const r of allDetailRows as any[]) {
            const div = r.division_code || 'UNKNOWN';
            if (!divTotals[div]) divTotals[div] = { cnt: 0, beras: 0, masaKerja: 0, thr: 0, samples: [] };
            divTotals[div].cnt++;
            divTotals[div].thr += r.amount || 0;

            let details: any = null;
            if (r.details_json) { try { details = JSON.parse(r.details_json); } catch { } }
            const vars = details?.variables || {};
            const beras = vars.TOTAL_TUNJANGAN_BERAS || vars.BERAS_JUMLAH || ((vars.BERAS_RATE || 0) * 30);
            const masaKerja = vars.MASA_KERJA_JUMLAH || 0;
            divTotals[div].beras += beras;
            divTotals[div].masaKerja += masaKerja;

            // Keep first 2 samples for IJL, HMC, AB2
            if (divTotals[div].samples.length < 2 && ['IJL', 'AB2', 'ARC'].includes(div)) {
                divTotals[div].samples.push({
                    nik: r.nik, name: r.emp_name, gang: r.gang_code, amount: r.amount,
                    beras_rate: vars.BERAS_RATE, beras_jumlah: vars.BERAS_JUMLAH,
                    total_beras: vars.TOTAL_TUNJANGAN_BERAS,
                    masa_kerja: vars.MASA_KERJA_JUMLAH,
                    jabatan_rate: vars.JABATAN_RATE, jabatan_jumlah: vars.JABATAN_JUMLAH,
                    upah_dasar: vars.UPAH_DASAR, gaji_pokok: vars.GAJI_POKOK,
                    has_json: !!r.details_json, parsed: !!details
                });
            }
        }

        output += "=== Per-Division Totals ===\n";
        for (const [div, t] of Object.entries(divTotals).sort((a, b) => a[0].localeCompare(b[0]))) {
            output += `\n${div}: ${t.cnt} employees | Beras: ${t.beras} | MasaKerja: ${t.masaKerja} | THR: ${t.thr}\n`;
            if (t.samples.length > 0) {
                output += `  Samples:\n`;
                for (const s of t.samples) {
                    output += `    ${s.nik} (${s.name}) gang=${s.gang} amt=${s.amount}\n`;
                    output += `      beras_rate=${s.beras_rate} beras_jumlah=${s.beras_jumlah} total_beras=${s.total_beras}\n`;
                    output += `      masa_kerja=${s.masa_kerja} jabatan_rate=${s.jabatan_rate} jabatan_jumlah=${s.jabatan_jumlah}\n`;
                    output += `      upah_dasar=${s.upah_dasar} gaji_pokok=${s.gaji_pokok} has_json=${s.has_json} parsed=${s.parsed}\n`;
                }
            }
        }

        const outputPath = path.join(__dirname, 'inspect_thr_details.txt');
        fs.writeFileSync(outputPath, output);
        console.log(`Done - wrote to ${outputPath}`);
    } catch (e) {
        console.error("Failed:", e);
    }
}

inspectThrDetails();
