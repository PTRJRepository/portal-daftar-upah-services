import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    console.log("Checking current F1H values:\n");
    
    // Check aggregation history
    const aggRows = await extDb.query<any>(`
        SELECT gang_code, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026 AND gang_code = 'F1H'
    `);
    
    console.log(`daftar_upah_aggregation_history:`);
    if (aggRows.length > 0) {
        for (const r of aggRows) {
            console.log(`  ${r.gang_code}: ${(r.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        }
    } else {
        console.log(`  No records found!`);
    }
    
    // Check payroll_history_header
    const headerRows = await extDb.query<any>(`
        SELECT id, gang_code, total_upah_bersih, total_employees
        FROM dbo.payroll_history_header
        WHERE period_month = 3 AND period_year = 2026 AND gang_code = 'F1H'
    `);
    
    console.log(`\npayroll_history_header:`);
    if (headerRows.length > 0) {
        for (const h of headerRows) {
            console.log(`  ID ${h.id}: ${h.gang_code} (${h.total_employees} emp) = ${(h.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        }
    } else {
        console.log(`  No records found!`);
    }
}

main().catch(console.error);
