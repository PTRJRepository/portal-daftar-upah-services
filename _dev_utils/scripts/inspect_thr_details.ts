/**
 * Inspect stored THR details for specific divisions to debug 
 * missing Tunjangan Beras and Masa Kerja values
 */
import { Database } from '../src/config/database';

async function inspectThrDetails() {
    const db = Database.getExtendedInstance();

    const rows = await db.query<any>(`
        SELECT nik, emp_name, division_code, gang_code, amount, details_json 
        FROM employee_other_incomes 
        WHERE period_year = 2026 AND period_month = 2 AND income_type = 'THR'
        AND division_code IN ('IJL', 'WKS_AR', 'HMC', 'AB2', 'ARC')
        ORDER BY division_code, nik
    `, []);

    console.log(`\n=== Found ${rows.length} THR records ===\n`);

    // Group by division
    const divGroups: Record<string, any[]> = {};
    for (const r of rows) {
        const div = r.division_code || 'UNKNOWN';
        if (!divGroups[div]) divGroups[div] = [];
        divGroups[div].push(r);
    }

    for (const [div, records] of Object.entries(divGroups)) {
        console.log(`\n--- Division: ${div} (${records.length} employees) ---`);

        let totalBeras = 0, totalMasaKerja = 0, totalThr = 0;
        let samplesShown = 0;

        for (const r of records) {
            let details: any = null;
            if (r.details_json) {
                try { details = JSON.parse(r.details_json); } catch { details = null; }
            }

            const vars = details?.variables || {};
            const beras = vars.TOTAL_TUNJANGAN_BERAS || vars.BERAS_JUMLAH || ((vars.BERAS_RATE || 0) * 30);
            const masaKerja = vars.MASA_KERJA_JUMLAH || 0;

            totalBeras += beras;
            totalMasaKerja += masaKerja;
            totalThr += r.amount || 0;

            // Show first 3 samples per division
            if (samplesShown < 3) {
                console.log(`  NIK: ${r.nik}, Name: ${r.emp_name}, Amount: ${r.amount}`);
                console.log(`    BERAS_RATE: ${vars.BERAS_RATE}, BERAS_JUMLAH: ${vars.BERAS_JUMLAH}, TOTAL_TUNJANGAN_BERAS: ${vars.TOTAL_TUNJANGAN_BERAS}`);
                console.log(`    MASA_KERJA_JUMLAH: ${vars.MASA_KERJA_JUMLAH}`);
                console.log(`    JABATAN_RATE: ${vars.JABATAN_RATE}, JABATAN_JUMLAH: ${vars.JABATAN_JUMLAH}`);
                console.log(`    UPAH_DASAR: ${vars.UPAH_DASAR}, GAJI_POKOK: ${vars.GAJI_POKOK}`);
                console.log(`    details_json present: ${!!r.details_json}, details parsed: ${!!details}`);
                samplesShown++;
            }
        }

        console.log(`  TOTALS => Beras: ${totalBeras}, MasaKerja: ${totalMasaKerja}, THR: ${totalThr}`);
    }

    process.exit(0);
}

inspectThrDetails().catch(e => { console.error(e); process.exit(1); });
