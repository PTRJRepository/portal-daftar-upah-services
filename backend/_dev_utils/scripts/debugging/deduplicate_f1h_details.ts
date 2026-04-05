import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const gangCode = "F1H";
    const headerId = 3832;
    
    console.log(`=== DEDUPLICATING payroll_history_detail for ${gangCode} (Header ${headerId}) ===\n`);
    
    // Get all detail records
    const allDetails = await extDb.query<any>(`
        SELECT id, emp_code, emp_name, upah_bersih, jumlah_upah_kotor, total_potongan
        FROM dbo.payroll_history_detail
        WHERE master_id = ?
        ORDER BY emp_code, id
    `, [headerId]);
    
    console.log(`Total detail records: ${allDetails.length}`);
    console.log(`Unique emp_codes: ${new Set(allDetails.map(d => d.emp_code)).size}\n`);
    
    // Check for duplicate emp_codes
    const dupes = await extDb.query<any>(`
        SELECT emp_code, COUNT(*) as cnt
        FROM dbo.payroll_history_detail
        WHERE master_id = ?
        GROUP BY emp_code
        HAVING COUNT(*) > 1
        ORDER BY emp_code
    `, [headerId]);
    
    console.log(`Duplicate employees (${dupes.length}):\n`);
    for (const dupe of dupes.slice(0, 5)) {
        console.log(`${dupe.emp_code}: ${dupe.cnt} records`);
        
        // Show all records for this emp
        const empRecords = allDetails.filter(d => d.emp_code === dupe.emp_code);
        for (const rec of empRecords) {
            console.log(`  ID ${rec.id}: upah_bersih=${(rec.upah_bersih || 0).toLocaleString('id-ID')}`);
        }
        console.log();
    }
    
    // Calculate deduplicated totals - take LATEST (highest ID) for each emp_code
    console.log(`\n=== CALCULATING DEDUPLICATED TOTALS ===`);
    console.log(`(Taking latest record per emp_code)\n`);
    
    const uniqueEmpMap = new Map<string, any>();
    for (const detail of allDetails) {
        const existing = uniqueEmpMap.get(detail.emp_code);
        if (!existing || detail.id > existing.id) {
            uniqueEmpMap.set(detail.emp_code, detail);
        }
    }
    
    let sumKotor = 0;
    let sumPotongan = 0;
    let sumBersih = 0;
    
    console.log(`Unique employees (${uniqueEmpMap.size}):\n`);
    for (const [empCode, detail] of uniqueEmpMap) {
        sumKotor += detail.jumlah_upah_kotor || 0;
        sumPotongan += detail.total_potongan || 0;
        sumBersih += detail.upah_bersih || 0;
    }
    
    console.log(`Deduplicated totals:`);
    console.log(`  upah_kotor: ${sumKotor.toLocaleString('id-ID')}`);
    console.log(`  potongan: ${sumPotongan.toLocaleString('id-ID')}`);
    console.log(`  upah_bersih: ${sumBersih.toLocaleString('id-ID')}`);
    console.log(`  verify (kotor - potongan): ${(sumKotor - sumPotongan).toLocaleString('id-ID')}`);
    
    console.log(`\n=== COMPARISON ===`);
    console.log(`Header 3832 upah_bersih: 170.378.347,46`);
    console.log(`Deduplicated detail sum: ${sumBersih.toLocaleString('id-ID')}`);
    console.log(`Difference: ${(170378347.46 - sumBersih).toLocaleString('id-ID')}`);
}

main().catch(console.error);
