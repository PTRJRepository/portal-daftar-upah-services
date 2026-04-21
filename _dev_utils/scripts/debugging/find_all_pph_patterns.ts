/**
 * Find ALL unique DocDesc patterns that contain PPH
 */

import sql from 'mssql';

const DB_CONFIG = {
    driver: "ODBC Driver 17 for SQL Server",
    server: "10.0.0.2",
    port: 1888,
    user: "sa",
    password: "supp0rt@",
    database: "db_ptrj",
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};

async function main() {
    console.log('Connecting to database...');
    const pool = await sql.connect(DB_CONFIG);
    console.log('Connected!\n');

    // Get ALL unique DocDesc values that contain PPH (case insensitive)
    console.log('Finding ALL unique PPH-related DocDesc patterns...\n');

    const result = await pool.request().query(`
        SELECT DISTINCT 
            DocDesc,
            COUNT(*) as record_count
        FROM PR_ADTRANS
        WHERE UPPER(DocDesc) LIKE '%PPH%'
           OR UPPER(DocDesc) LIKE '%PPh%'
           OR UPPER(DocDesc) LIKE '%pajak%'
           OR UPPER(DocDesc) LIKE '%PAJAK%'
        GROUP BY DocDesc
        ORDER BY DocDesc
    `);

    console.log(`Found ${result.recordset.length} unique PPH-related DocDesc patterns:\n`);

    const patterns = new Map<string, number>();

    result.recordset.forEach(row => {
        const docDesc = row.DocDesc.trim();
        const count = row.record_count;
        patterns.set(docDesc, count);
        console.log(`  "${docDesc}" (${count} records)`);
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log('Summary:');
    console.log(`  Total unique patterns: ${patterns.size}`);
    console.log(`  Total records: ${result.recordset.reduce((sum: number, r: any) => sum + r.record_count, 0)}`);

    // Show which ones match our current patterns
    console.log(`\n${'='.repeat(80)}`);
    console.log('Matching with current patterns:');

    const currentPatterns = [
        '%Potongan Pph21%',
        '%Potongan PPH 21%',
        '%Potongan PPH21%',
        '%PPH 21%',
        '%PPH21%',
        '%POTONGAN PPH%',
        '%PPh 21%',
        '%PPh21%'
    ];

    let matchedCount = 0;
    let unmatchedPatterns: string[] = [];

    for (const [docDesc, count] of patterns) {
        const upperDocDesc = docDesc.toUpperCase();
        const matches = currentPatterns.some(pattern => {
            const upperPattern = pattern.toUpperCase().replace(/%/g, '');
            return upperDocDesc.includes(upperPattern.replace('POTONGAN PPH', 'POTONGAN PPH'));
        });

        if (matches) {
            matchedCount += count;
        } else {
            unmatchedPatterns.push(`    "${docDesc}" (${count} records)`);
        }
    }

    console.log(`  ✅ Matched: ${matchedCount} records`);
    console.log(`  ❌ Unmatched: ${unmatchedPatterns.length} patterns\n`);

    if (unmatchedPatterns.length > 0) {
        console.log('Unmatched patterns (need to be added):');
        unmatchedPatterns.forEach(p => console.log(p));
    }

    // Generate the complete pattern list
    console.log(`\n${'='.repeat(80)}`);
    console.log('Complete pattern list for script:');
    console.log('const PPH21_PATTERNS = [');
    for (const [docDesc, count] of patterns) {
        const upperDocDesc = docDesc.toUpperCase();
        // Convert to LIKE pattern
        const pattern = `%${docDesc.replace(/'/g, "''")}%`;
        console.log(`    '${pattern}',  // ${count} records`);
    }
    console.log('];');

    await pool.close();
    console.log('\nDone!');
}

main().catch(console.error);
