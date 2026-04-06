
import { Database } from "../../src/db/client";

async function checkHistoryPph21() {
    const db = Database.getExtendedInstance();
    
    // Check March 2026 (Calendar Month 3, Year 2026)
    const month = 3;
    const year = 2026;

    console.log(`Checking history payroll_history_detail for period ${month}/${year}...`);

    const rows = await db.query(`
        SELECT 
            h.division_code,
            h.gang_code,
            d.emp_code, 
            d.emp_name,
            d.pot_pph21,
            d.pph21_ter
        FROM dbo.payroll_history_header h
        JOIN dbo.payroll_history_detail d ON h.id = d.master_id
        WHERE h.period_month = ? AND h.period_year = ?
        ORDER BY h.division_code, d.emp_code
    `, [month, year]);

    console.log(`Checking ${rows.length} total rows in history for this period.`);
    
    const withPotPph21 = rows.filter((r: any) => r.pot_pph21 > 0);
    const withPph21Ter = rows.filter((r: any) => r.pph21_ter > 0);

    console.log(`Rows with pot_pph21 > 0: ${withPotPph21.length}`);
    console.log(`Rows with pph21_ter > 0: ${withPph21Ter.length}`);
    
    if (rows.length > 0) {
        console.log('Sample records (first 10):');
        console.table(rows.slice(0, 10));
    } else {
        console.log('No PPH21 records found in history DB for this period.');
        
        // Also check if any rows exist at all for this period
        const totalRows = await db.query(`
            SELECT COUNT(*) as count 
            FROM dbo.payroll_history_header h
            JOIN dbo.payroll_history_detail d ON h.id = d.master_id
            WHERE h.period_month = ? AND h.period_year = ?
        `, [month, year]);
        
        console.log(`Total rows for this period in history: ${totalRows[0].count}`);
    }

    process.exit(0);
}

checkHistoryPph21().catch(console.error);
