/**
 * Test if cache is returning stale data for tunjangan jabatan
 * Run: cd backend && bun run ../_dev_utils/scripts/debugging/test_cache_tunjangan.ts
 */

import { dataExtractorService } from "../../../backend/src/services/dataExtractorService";
import { cacheService } from "../../../backend/src/services/cacheService";
import { Config } from "../../../backend/src/config";

async function test() {
    const month = 3;
    const year = 2026;
    const division = 'AB1';
    const gangCode = 'G1H';

    console.log(`\n=== Testing cache for ${division} (${month}/${year}) ===`);
    console.log(`Current period: ${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
    console.log(`isHistorical: ${(year < new Date().getFullYear()) || (year === new Date().getFullYear() && month < new Date().getMonth() + 1)}`);
    console.log(`Cache stats:`, cacheService.getStats());

    const cacheKey = cacheService.buildPayrollKey(gangCode, month, year, division);
    console.log(`\nCache key for G1H: ${cacheKey}`);

    // Check if cached
    const cached = cacheService.get(cacheKey);
    if (cached) {
        console.log(`✅ CACHE HIT! Cached rows: ${cached.data_rows.length}`);
        const withJab = cached.data_rows.filter((r: any) => (r.jabatan_jumlah || 0) > 0);
        console.log(`Cached rows with jabatan_jumlah > 0: ${withJab.length}`);
        if (withJab.length > 0) {
            console.log(`First few with jabatan_jumlah:`);
            for (const r of withJab.slice(0, 3)) {
                console.log(`  ${r.emp_code}: ${r.jabatan_jumlah}`);
            }
        }
    } else {
        console.log(`❌ CACHE MISS - fresh data will be fetched`);
    }

    // Now test the ACTUAL API call (with caching)
    console.log(`\n--- Testing fresh fetch (bypass cache by using specificEmpCode) ---`);
    const result = await dataExtractorService.extractPayrollData(
        month, year, gangCode, division, null, Config.DB_PROFILE, false, null, undefined, true
    );

    console.log(`Fresh fetch: ${result.data_rows.length} rows`);
    const withJab = result.data_rows.filter((r: any) => (r.jabatan_jumlah || 0) > 0);
    console.log(`Fresh rows with jabatan_jumlah > 0: ${withJab.length}`);
    if (withJab.length > 0) {
        console.log(`First few with jabatan_jumlah:`);
        for (const r of withJab.slice(0, 3)) {
            console.log(`  ${r.emp_code} (${r.nama}): ${r.jabatan_jumlah}`);
        }
    }

    // Check if the CACHED version differs
    const cachedAfter = cacheService.get(cacheKey);
    if (cachedAfter) {
        console.log(`\n--- After fresh fetch, cache now has: ---`);
        const withJabCached = cachedAfter.data_rows.filter((r: any) => (r.jabatan_jumlah || 0) > 0);
        console.log(`Cached rows with jabatan_jumlah > 0: ${withJabCached.length}`);
    }

    console.log(`\n=== END ===`);
}

test().catch(console.error).finally(() => process.exit());
