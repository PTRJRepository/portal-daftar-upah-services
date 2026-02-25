const fs = require('fs');

async function testFetch() {
    try {
        const loginRes = await fetch('http://localhost:8002/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.access_token;

        const historyListRes = await fetch('http://localhost:8002/payroll/history?period_month=12&period_year=2025&division_code=INFRA', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const historyListData = await historyListRes.json();
        const backendData = historyListData.data || [];

        const thrInfra = JSON.parse(fs.readFileSync('D:/Gawean Rebinmas/Monitoring Database/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/Additional_services/pajak_kalkulator/data_statis/infra/thr_bonus_infra.json', 'utf8'));
        const thr1b = JSON.parse(fs.readFileSync('D:/Gawean Rebinmas/Monitoring Database/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/Additional_services/pajak_kalkulator/data_statis/1b/thr_bonus_1b.json', 'utf8'));
        const thr2a = JSON.parse(fs.readFileSync('D:/Gawean Rebinmas/Monitoring Database/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/Additional_services/pajak_kalkulator/data_statis/2a/thr_bonus_2a.json', 'utf8'));

        const thrBonus = [...thrInfra, ...thr1b, ...thr2a];

        const thrMap = {};
        const exgratiaMap = {};

        thrBonus.forEach(item => {
            const keyStr = String(item.nik || item.nama || '').trim().toUpperCase();
            if (keyStr) {
                thrMap[keyStr] = item.thr || 0;
                exgratiaMap[keyStr] = item.exgratia || item.bonus || 0;
            }
        });

        let matched = 0;
        let missed = [];

        backendData.forEach(h => {
            const empName = String(h.emp_name || h.nama || '').trim().toUpperCase();
            const empNik = String(h.nik || '').trim().toUpperCase();

            if (thrMap[empNik] !== undefined || thrMap[empName] !== undefined || exgratiaMap[empNik] !== undefined || exgratiaMap[empName] !== undefined) {
                matched++;
            } else {
                missed.push({ name: empName, nik: empNik, emp_code: h.emp_code, gang_code: h.gang_code });
            }
        });

        console.log("Matched: " + matched + " / " + backendData.length);
        if (missed.length > 0) {
            console.log('Missed employees (first 10):');
            console.table(missed.slice(0, 10));
        }

    } catch (e) { console.error(e); }
}

testFetch();
