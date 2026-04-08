/**
 * Diagnostic: Write PG2B master analysis to a JSON file to avoid terminal truncation.
 * Run with: bun run _dev_utils/tests/diagnose_pg2b_masters.ts
 */
import { Database } from "../../src/db/client";
import { writeFileSync } from "fs";

async function diagnose() {
    const db = Database.getExtendedInstance();
    const results: any = {};
    
    // 1. All master headers that could affect PG2B
    const masters = await db.query<any>(`
        SELECT id, division_code, gang_code, period_month, period_year
        FROM dbo.payroll_history_header 
        WHERE period_month = 3 AND period_year = 2026 
          AND (division_code LIKE '%2B%' OR division_code LIKE '%PG2B%' OR division_code = 'ALL')
        ORDER BY division_code, gang_code
    `);
    
    results.all_matching_masters = [];
    for (const m of masters) {
        const sums = await db.query<any>(`
            SELECT COUNT(*) as cnt, 
                   SUM(CAST(ISNULL(pph21_ter, 0) AS FLOAT)) as pph21,
                   SUM(CAST(ISNULL(jumlah_upah_kotor, 0) AS FLOAT)) as upah_kotor
            FROM dbo.payroll_history_detail WHERE master_id = ?
        `, [m.id]);
        results.all_matching_masters.push({
            id: m.id, div: m.division_code, gang: m.gang_code,
            detail_count: sums[0]?.cnt, pph21_sum: sums[0]?.pph21, upah_kotor_sum: sums[0]?.upah_kotor
        });
    }
    
    // 2. PG2B only (no ALL)
    const pg2bOnly = masters.filter((m: any) => m.division_code !== 'ALL');
    const masterIds = pg2bOnly.map((m: any) => m.id);
    
    if (masterIds.length > 0) {
        const allDetails = await db.query<any>(`
            SELECT d.emp_code, d.nik, d.gang_code, 
                   CAST(ISNULL(d.pph21_ter, 0) AS FLOAT) as pph21_ter, 
                   CAST(ISNULL(d.jumlah_upah_kotor, 0) AS FLOAT) as jumlah_upah_kotor,
                   d.master_id
            FROM dbo.payroll_history_detail d
            WHERE master_id IN (${masterIds.join(',')})
        `);
        
        const empMap = new Map<string, any[]>();
        for (const d of allDetails) {
            const key = (d.nik || d.emp_code || '').trim().toUpperCase();
            if (!key) continue;
            if (!empMap.has(key)) empMap.set(key, []);
            empMap.get(key)!.push(d);
        }
        
        let dupes = 0;
        let pph21Raw = 0, pph21Deduped = 0, upahRaw = 0, upahDeduped = 0;
        const dupeSamples: any[] = [];
        
        for (const [key, rows] of empMap) {
            pph21Deduped += Number(rows[0]?.pph21_ter || 0);
            upahDeduped += Number(rows[0]?.jumlah_upah_kotor || 0);
            for (const r of rows) {
                pph21Raw += Number(r.pph21_ter || 0);
                upahRaw += Number(r.jumlah_upah_kotor || 0);
            }
            if (rows.length > 1) {
                dupes++;
                if (dupes <= 10) {
                    dupeSamples.push({
                        key, count: rows.length,
                        masters: rows.map((r: any) => r.master_id),
                        gangs: rows.map((r: any) => r.gang_code)
                    });
                }
            }
        }
        
        results.pg2b_analysis = {
            master_ids: masterIds,
            total_detail_rows: allDetails.length,
            unique_employees: empMap.size,
            duplicated_employees: dupes,
            pph21_raw: pph21Raw,
            pph21_deduped: pph21Deduped,
            upah_kotor_raw: upahRaw,
            upah_kotor_deduped: upahDeduped,
            expected_pph21: 22254328,
            pph21_matches: Math.round(pph21Deduped) === 22254328,
            duplicate_samples: dupeSamples
        };
    }
    
    writeFileSync("_dev_utils/tests/pg2b_results.json", JSON.stringify(results, null, 2));
    console.log("Done! Results written to _dev_utils/tests/pg2b_results.json");
    process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
