/**
 * Test direct connection to Server 1 (extend_db_ptrj) via SQL Gateway
 */

import { Database } from './backend/src/db/client';
import { Config } from './backend/src/config';

async function testServer1Connection() {
    console.log('='.repeat(80));
    console.log('TESTING SERVER 1 CONNECTION (extend_db_ptrj)');
    console.log('='.repeat(80));

    console.log(`\nConfiguration:`);
    console.log(`  DB_API_URL: ${Config.DB_API_URL}`);
    console.log(`  DB_EXTEND_DATABASE: ${Config.DB_EXTEND_DATABASE}`);
    console.log(`  DB_EXTEND_PROFILE: ${Config.DB_EXTEND_PROFILE}`);

    console.log('\n[TEST 1] Creating Database instance for Server 1...');
    const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
    console.log(`✅ Database instance created`);

    console.log('\n[TEST 2] Querying payroll_history_header table...');
    try {
        const query = `
            SELECT TOP 5
                id,
                period_month,
                period_year,
                division_code,
                gang_code,
                created_at,
                created_by
            FROM dbo.payroll_history_header
            ORDER BY period_year DESC, period_month DESC, created_at DESC
        `;

        const results = await db.query(query);
        
        console.log(`✅ Query successful! Found ${results.length} recent headers:\n`);
        results.forEach((r, idx) => {
            console.log(`  ${idx + 1}. Period: ${r.period_month}/${r.period_year} | Division: ${r.division_code} | Gang: ${r.gang_code} | Created: ${r.created_at}`);
        });
    } catch (error: any) {
        console.log(`❌ Query failed: ${error.message}`);
        console.error(error);
    }

    console.log('\n[TEST 3] Counting headers for PG2A Maret 2026...');
    try {
        const countQuery = `
            SELECT COUNT(*) as total
            FROM dbo.payroll_history_header
            WHERE period_month = 3 AND period_year = 2026
                AND (division_code = 'PG2A' OR division_code = 'P2A' OR division_code = 'P2a')
        `;

        const countResult = await db.query(countQuery);
        console.log(`✅ PG2A Maret 2026 headers: ${countResult[0].total}`);
    } catch (error: any) {
        console.log(`❌ Count query failed: ${error.message}`);
    }

    console.log('\n[TEST 4] Counting ALL headers for Maret 2026...');
    try {
        const allCountQuery = `
            SELECT division_code, COUNT(*) as cnt
            FROM dbo.payroll_history_header
            WHERE period_month = 3 AND period_year = 2026
            GROUP BY division_code
            ORDER BY division_code
        `;

        const allCountResult = await db.query(allCountQuery);
        console.log(`✅ Headers by division for Maret 2026:\n`);
        allCountResult.forEach((r) => {
            console.log(`  ${r.division_code}: ${r.cnt}`);
        });
    } catch (error: any) {
        console.log(`❌ Count query failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
}

testServer1Connection()
    .then(() => {
        console.log('\n✅ Test complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
