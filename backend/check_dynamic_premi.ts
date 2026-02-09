import { Database } from './src/services/database';
import { Config } from './src/config';

async function checkDynamicPremi() {
    await Database.initialize();
    const extendDb = Database.getInstance(Config.dbExtendProfile);

    const query = `
        SELECT TOP 5
            division_code,
            gang_code,
            dynamic_premi_data,
            total_premi,
            total_premi_brondol,
            total_premi_prunning,
            total_premi_insentif,
            total_premi_kinerja
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 1 AND period_year = 2025
            AND dynamic_premi_data IS NOT NULL
    `;

    const rows = await extendDb.query<any>(query, []);

    console.log('=== Dynamic Premi Data Structure ===');
    for (const row of rows) {
        console.log(`\n--- ${row.division_code} / ${row.gang_code} ---`);
        console.log('Total Premi:', row.total_premi);
        console.log('Brondol:', row.total_premi_brondol);
        console.log('Pruning:', row.total_premi_prunning);
        console.log('Insentif:', row.total_premi_insentif);
        console.log('Kinerja:', row.total_premi_kinerja);
        console.log('Dynamic Data Type:', typeof row.dynamic_premi_data);
        console.log('Dynamic Data:', row.dynamic_premi_data);

        // Try to parse
        if (row.dynamic_premi_data) {
            try {
                const parsed = typeof row.dynamic_premi_data === 'string'
                    ? JSON.parse(row.dynamic_premi_data)
                    : row.dynamic_premi_data;
                console.log('Parsed:', JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log('Parse Error:', e);
            }
        }
    }

    await Database.closeAll();
}

checkDynamicPremi().catch(console.error);
