import { Database } from '../db/client';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    
    // Check tables in extended DB
    const tables = await db.query<any>(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'dbo'
        ORDER BY TABLE_NAME
    `);
    console.log('=== Extended DB tables ===');
    for (const t of tables) {
        console.log(t.TABLE_NAME);
    }

    // Check if there's payroll history with THR
    const mainTables = await mainDb.query<any>(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND (TABLE_NAME LIKE '%THR%' OR TABLE_NAME LIKE '%thr%' 
          OR TABLE_NAME LIKE '%PAYROLL%' OR TABLE_NAME LIKE '%OTHER%' OR TABLE_NAME LIKE '%INCOME%'
          OR TABLE_NAME LIKE '%BONUS%' OR TABLE_NAME LIKE '%HARI%' OR TABLE_NAME LIKE '%RAYA%')
        ORDER BY TABLE_NAME
    `);
    console.log('\n=== Main DB tables (THR/payroll related) ===');
    for (const t of mainTables) {
        console.log(t.TABLE_NAME);
    }

    // Check history_payroll_detail for THR
    try {
        const histThr = await db.query<any>(`
            SELECT TOP 5 * FROM history_payroll_detail
            WHERE UPPER(income_type) LIKE '%THR%' OR UPPER(field_name) LIKE '%THR%'
        `);
        if (histThr.length > 0) {
            console.log('\n=== THR in history_payroll_detail ===');
            console.log(JSON.stringify(histThr, null, 2));
        }
    } catch (e) {
        console.log('\nNo history_payroll_detail table or no THR column');
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
