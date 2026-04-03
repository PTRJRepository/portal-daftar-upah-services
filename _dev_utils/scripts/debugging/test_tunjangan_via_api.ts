/**
 * Test the actual API endpoint to check if jabatan_jumlah is in the response
 */

const API_URL = 'http://localhost:8002/backend/upah';

async function test() {
    const params = new URLSearchParams({
        division_code: 'AB1',
        month: '3',
        year: '2026',
    });

    console.log(`Testing /payroll/report/division-raw-tree?${params}`);
    const url = `${API_URL}/payroll/report/division-raw-tree?${params}`;
    console.log(`URL: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    console.log(`\nResponse keys: ${Object.keys(data)}`);
    console.log(`Gangs count: ${data.gangs?.length || 0}`);

    // Check each gang and employee for jabatan_jumlah
    let totalWithJabatan = 0;
    let totalWithoutJabatan = 0;
    let employeesChecked = 0;

    for (const gang of (data.gangs || [])) {
        for (const emp of (gang.employees || [])) {
            employeesChecked++;
            const jb = emp.jabatan_jumlah;
            if (jb && jb > 0) {
                totalWithJabatan++;
                if (totalWithJabatan <= 5) {
                    console.log(`  ✓ ${emp.emp_code} (${emp.nama}): jabatan_jumlah = ${jb}`);
                }
            } else {
                totalWithoutJabatan++;
            }
        }
    }

    console.log(`\nTotal employees checked: ${employeesChecked}`);
    console.log(`Employees with jabatan_jumlah > 0: ${totalWithJabatan}`);
    console.log(`Employees with jabatan_jumlah = 0 or undefined: ${totalWithoutJabatan}`);

    // Show gang totals
    for (const gang of (data.gangs || [])) {
        const jbTotal = gang.gang_totals?.jabatan_jumlah;
        console.log(`\nGang ${gang.gang_code}: ${gang.employees?.length || 0} employees, jabatan_jumlah total = ${jbTotal}`);
    }

    // Check if the data has the field at all
    if (data.gangs?.[0]?.employees?.[0]) {
        const emp = data.gangs[0].employees[0];
        const keys = Object.keys(emp).filter(k => k.includes('jabatan') || k.includes('tunjangan'));
        console.log(`\nFields containing 'jabatan' or 'tunjangan' in first employee:`);
        console.log(keys);
        console.log(`Sample values:`, keys.reduce((acc, k) => ({ ...acc, [k]: emp[k] }), {}));
    }
}

test().catch(console.error).finally(() => process.exit());
