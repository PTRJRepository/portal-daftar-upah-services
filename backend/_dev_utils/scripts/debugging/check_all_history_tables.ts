import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const gangCode = "F1H";
    const month = 3;
    const year = 2026;
    
    console.log(`=== CHECKING PAYROLL HISTORY TABLES ===\n`);
    
    // Check payroll_history_master
    console.log("1. payroll_history_master:");
    const masterRows = await extDb.query<any>(`
        SELECT id, history_id, gang_code, total_employees
        FROM dbo.payroll_history_master
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (masterRows.length > 0) {
        for (const m of masterRows) {
            console.log(`  Master ID: ${m.id}, gang: ${m.gang_code}, employees: ${m.total_employees}`);
        }
    } else {
        console.log("  No records");
    }
    
    // Check payroll_history_header
    console.log("\n2. payroll_history_header:");
    const headerRows = await extDb.query<any>(`
        SELECT id, gang_code, total_employees, total_upah_bersih, total_potongan
        FROM dbo.payroll_history_header
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [month, year, gangCode]);
    
    if (headerRows.length > 0) {
        for (const h of headerRows) {
            console.log(`  Header ID: ${h.id}, gang: ${h.gang_code}, employees: ${h.total_employees}`);
            console.log(`    total_upah_bersih: ${(h.total_upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log(`    total_potongan: ${(h.total_potongan || 0).toLocaleString('id-ID')}`);
        }
    } else {
        console.log("  No records");
    }
    
    // Check payroll_history_detail
    console.log("\n3. payroll_history_detail:");
    const detailCount = await extDb.query<any>(`
        SELECT COUNT(*) as cnt
        FROM dbo.payroll_history_detail d
        JOIN dbo.payroll_history_master m ON d.master_id = m.id
        WHERE m.period_month = ? AND m.period_year = ? AND m.gang_code = ?
    `, [month, year, gangCode]);
    
    console.log(`  Detail records: ${detailCount[0].cnt}`);
    
    if (detailCount[0].cnt > 0) {
        const sampleDetails = await extDb.query<any>(`
            SELECT d.emp_code, d.emp_name, d.upah_bersih, d.jumlah_upah_kotor, d.total_potongan
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_master m ON d.master_id = m.id
            WHERE m.period_month = ? AND m.period_year = ? AND m.gang_code = ?
            ORDER BY d.emp_code
        `, [month, year, gangCode]);
        
        console.log(`\n  Sample details (first 5):\n`);
        let sumBersih = 0;
        for (const d of sampleDetails.slice(0, 5)) {
            console.log(`  ${d.emp_code} (${d.emp_name}):`);
            console.log(`    kotor: ${(d.jumlah_upah_kotor || 0).toLocaleString('id-ID')}`);
            console.log(`    potongan: ${(d.total_potongan || 0).toLocaleString('id-ID')}`);
            console.log(`    bersih: ${(d.upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log();
            sumBersih += d.upah_bersih || 0;
        }
        
        // Calculate total from ALL details
        const totalResult = await extDb.query<any>(`
            SELECT SUM(d.upah_bersih) as total_bersih, 
                   SUM(d.jumlah_upah_kotor) as total_kotor,
                   SUM(d.total_potongan) as total_potongan
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_master m ON d.master_id = m.id
            WHERE m.period_month = ? AND m.period_year = ? AND m.gang_code = ?
        `, [month, year, gangCode]);
        
        const total = totalResult[0];
        console.log(`\n  TOTALS from payroll_history_detail:`);
        console.log(`    upah_kotor: ${(total.total_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`    potongan: ${(total.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`    upah_bersih: ${(total.total_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`    verify (kotor - potongan): ${((total.total_kotor || 0) - (total.total_potongan || 0)).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
