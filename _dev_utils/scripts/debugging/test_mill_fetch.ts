/**
 * Test fetchMillData directly
 */
import { Database } from "../../../backend/src/db/client";
import { fetchMillData } from "../../../backend/src/api/aggregationSeederRoutes";

async function test() {
    console.log('Testing fetchMillData for March 2026...');

    try {
        const result = await fetchMillData(3, 2026);
        console.log('\n=== fetchMillData Result ===');
        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

test()
    .then(() => { console.log('\nDone'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });