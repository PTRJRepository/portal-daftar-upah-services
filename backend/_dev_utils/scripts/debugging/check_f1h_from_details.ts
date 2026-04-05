import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const gangCode = "F1H";
    const month = 3;
    const year = 2026;
    
    console.log(`=== INVESTIGATING: ${gangCode} (HARVESTING BUKIT PANJANG) ===\n`);
    
    // 1. Check master record
    const masterRows = await extDb.query<any>(`
        SELECT id, gang_code, total_upah_kotor, total_potongan, total_upah_bersih, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (masterRows.length === 0) {
        console.log("❌ No master record found");
        return;
    }
    
    const master = masterRows[0];
    console.log(`MASTER RECORD:`);
    console.log(`  total_upah_kotor: ${(master.total_upah_kotor || 0).toLocaleString('id-ID')}`);
    console.log(`  total_potongan: ${(master.total_potongan || 0).toLocaleString('id-ID')}`);
    console.log(`  total_upah_bersih: ${(master.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    console.log(`  total_employees: ${master.total_employees}`);
    
    // 2. Check detail records
    console.log(`\nDETAIL RECORDS (payroll_history_detail):\n`);
    
    const detailRows = await extDb.query<any>(`
        SELECT emp_code, emp_name, 
               jumlah_upah_kotor, total_potongan, upah_bersih
        FROM dbo.payroll_history_detail
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_master
            WHERE period_month = ? AND period_year = ? AND gang_code = ?
        )
        ORDER BY emp_code
    `, [month, year, gangCode]);
    
    if (detailRows.length === 0) {
        console.log("⚠️ NO detail records found in payroll_history_detail!");
        console.log("Trying alternative table...");
        
        // Try different table name
        const altRows = await extDb.query<any>(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME LIKE '%detail%' OR TABLE_NAME LIKE '%payroll%'
        `);
        
        console.log("\nAvailable tables:");
        altRows.forEach((r: any) => console.log(`  ${r.TABLE_NAME}`));
    } else {
        console.log(`Found ${detailRows.length} employee details:\n`);
        
        let sumKotor = 0;
        let sumPotongan = 0;
        let sumBersih = 0;
        
        for (const emp of detailRows.slice(0, 10)) {
            console.log(`${emp.emp_code} (${emp.emp_name}):`);
            console.log(`  upah_kotor: ${(emp.jumlah_upah_kotor || 0).toLocaleString('id-ID')}`);
            console.log(`  potongan: ${(emp.total_potongan || 0).toLocaleString('id-ID')}`);
            console.log(`  upah_bersih: ${(emp.upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log();
            
            sumKotor += emp.jumlah_upah_kotor || 0;
            sumPotongan += emp.total_potongan || 0;
            sumBersih += emp.upah_bersih || 0;
        }
        
        // Calculate from all details
        for (const emp of detailRows) {
            sumKotor += emp.jumlah_upah_kotor || 0;
            sumPotongan += emp.total_potongan || 0;
            sumBersih += emp.upah_bersih || 0;
        }
        // Subtract first 10 (already added)
        for (const emp of detailRows.slice(0, 10)) {
            sumKotor -= emp.jumlah_upah_kotor || 0;
            sumPotongan -= emp.total_potongan || 0;
            sumBersih -= emp.upah_bersih || 0;
        }
        
        console.log(`\nCALCULATED FROM DETAILS:`);
        console.log(`  Total upah_kotor: ${sumKotor.toLocaleString('id-ID')}`);
        console.log(`  Total potongan: ${sumPotongan.toLocaleString('id-ID')}`);
        console.log(`  Total upah_bersih: ${sumBersih.toLocaleString('id-ID')}`);
        console.log(`  Verify (kotor - potongan): ${(sumKotor - sumPotongan).toLocaleString('id-ID')}`);
        
        console.log(`\n=== COMPARISON ===`);
        console.log(`Master upah_bersih: ${(master.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`Details sum: ${sumBersih.toLocaleString('id-ID')}`);
        console.log(`Difference: ${((master.total_upah_bersih || 0) - sumBersih).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
