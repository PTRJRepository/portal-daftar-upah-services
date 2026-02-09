
const BASE = 'http://localhost:8002/payroll/dashboard';

async function test() {
    try {
        console.log('Fetching Filter Options...');
        const fRes = await fetch(`${BASE}/filter-options?month=1&year=2025`);
        if (!fRes.ok) {
            const txt = await fRes.text();
            throw new Error(`Filter Error (${fRes.status}): ${txt}`);
        }

        const txt = await fRes.text();
        console.log('Raw Response:', txt.substring(0, 100) + '...');
        let fJson;
        try {
            fJson = JSON.parse(txt);
        } catch (e) {
            throw new Error(`Invalid JSON: ${txt}`);
        }

        console.log('Filters Result:', fJson.success ? 'SUCCESS' : 'FAILED');
        if (!fJson.success) {
            console.error(fJson);
            return;
        }

        const divisions = fJson.data.divisions;
        const gangs = fJson.data.gangs;

        console.log(`Divisions: ${divisions.length}, Gangs: ${gangs.length}`);

        if (divisions.length > 0) {
            const div = divisions[0];
            console.log(`\nTesting Comparison for Division: ${div}`);
            const cRes = await fetch(`${BASE}/comparison`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'division', codes: [div], month: 1, year: 2025 })
            });
            const cJson = await cRes.json();
            console.log('Div Comp Result:', cJson.success ? 'SUCCESS' : 'FAILED');
            console.log('Data:', JSON.stringify(cJson.data, null, 2));
        }

        if (gangs.length > 0) {
            const gang = gangs[0];
            console.log(`\nTesting Comparison for Gang: ${gang}`);
            const cRes = await fetch(`${BASE}/comparison`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'gang', codes: [gang], month: 1, year: 2025 })
            });
            const cJson = await cRes.json();
            console.log('Gang Comp Result:', cJson.success ? 'SUCCESS' : 'FAILED');
            console.log('Data:', JSON.stringify(cJson.data, null, 2));
        }

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

test();
