import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    // Check available periods in payroll data
    const periods = await db.query<any>(`
        SELECT DISTINCT 
            MONTH(DocDate) as month, 
            YEAR(DocDate) as year
        FROM PR_ADTRANS
        WHERE DocDate >= '2025-01-01'
        ORDER BY year DESC, month DESC
    `);
    
    console.log("Available payroll periods:\n");
    for (const p of periods) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        console.log(`  ${monthNames[p.month - 1]} ${p.year}`);
    }
    
    // Also check aggregation history
    const extDb = Database.getExtendedInstance();
    const aggPeriods = await extDb.query<any>(`
        SELECT DISTINCT period_month as month, period_year as year
        FROM dbo.daftar_upah_aggregation_history
        ORDER BY year DESC, month DESC
    `);
    
    console.log("\nAggregation history periods:\n");
    for (const p of aggPeriods) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        console.log(`  ${monthNames[p.month - 1]} ${p.year}`);
    }
}

main().catch(console.error);
