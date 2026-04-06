/**
 * Debug script to check MILL PYCompCode patterns
 */

import { Database } from "../../../backend/src/db/client";

async function checkMillCompCodes() {
    const db = Database.getVenusInstance();
    const pattern = 'PYW/PTRJ/202603%';

    console.log('Checking MILL PYCompCode patterns for:', pattern);

    const query = `
        SELECT TOP 30
            PYCompCode,
            COUNT(*) as cnt,
            SUM(CompAmount) as total_amount,
            CASE WHEN SUM(CAST(IsTakeHomePay AS INT)) > 0 THEN 1 ELSE 0 END as has_takehome
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE PYNumber LIKE ?
        GROUP BY PYCompCode
        ORDER BY total_amount DESC;
    `;

    const results = await db.query(query, [pattern]);
    console.log('\n=== PYCompCode patterns ===');
    console.table(results);

    // Also check what "upah" related codes exist
    console.log('\n=== Codes containing "UP" or "GAJI" ===');
    const upahQuery = `
        SELECT DISTINCT PYCompCode
        FROM [dbo].[HR_T_PYWeekly_DComponent]
        WHERE PYNumber LIKE ?
          AND (PYCompCode LIKE '%UP%' OR PYCompCode LIKE '%GAJI%' OR PYCompCode LIKE '%BERSIH%')
    `;
    const upahResults = await db.query(upahQuery, [pattern]);
    console.table(upahResults);
}

checkMillCompCodes()
    .then(() => { console.log('\nDone'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });