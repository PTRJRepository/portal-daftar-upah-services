/**
 * Check what gang codes exist in history for PG2A Maret 2026
 */

import { historyDatabaseService } from './backend/src/services/historyDatabaseService';

async function checkHistoryHeaders() {
    console.log('='.repeat(80));
    console.log('CHECKING HISTORY HEADERS FOR PG2A - MARET 2026');
    console.log('='.repeat(80));

    const db = historyDatabaseService.getPayrollDatabase();

    // Query to see all headers for month 3, year 2026
    const query = `
        SELECT 
            id,
            period_month,
            period_year,
            division_code,
            gang_code,
            created_at,
            created_by
        FROM dbo.payroll_history_header
        WHERE period_month = 3 AND period_year = 2026
        ORDER BY division_code, gang_code
    `;

    try {
        const results = await db.query(query);
        
        console.log(`\nFound ${results.length} header records for March 2026:\n`);
        
        // Group by division
        const byDivision = {};
        results.forEach(r => {
            if (!byDivision[r.division_code]) {
                byDivision[r.division_code] = [];
            }
            byDivision[r.division_code].push(r.gang_code);
        });

        for (const [div, gangs] of Object.entries(byDivision)) {
            console.log(`Division: ${div}`);
            console.log(`  Gangs: ${gangs.join(', ')}`);
            console.log(`  Count: ${gangs.length}\n`);
        }

        // Check PG2A/P2A specifically
        const pg2aGangs = results.filter(r => 
            r.division_code === 'PG2A' || 
            r.division_code === 'P2A' ||
            r.division_code === 'P2a' ||
            r.division_code === 'pg2a'
        );

        console.log('='.repeat(80));
        console.log(`PG2A/P2A headers: ${pg2aGangs.length} found`);
        if (pg2aGangs.length > 0) {
            console.log('Gang codes:', pg2aGangs.map(r => r.gang_code).join(', '));
        } else {
            console.log('⚠️  NO PG2A/P2A history data found!');
            console.log('\nThis means the seeder did NOT seed PG2A data for March 2026');
            console.log('You need to re-seed with division=PG2A or P2A');
        }

        // Check if C1B exists
        const c1bRecords = results.filter(r => r.gang_code === 'C1B');
        console.log(`\nC1B gang records: ${c1bRecords.length} found`);
        if (c1bRecords.length > 0) {
            console.log('Divisions:', c1bRecords.map(r => r.division_code).join(', '));
        }

    } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        console.error(error);
    }

    console.log('\n' + '='.repeat(80));
}

checkHistoryHeaders()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
