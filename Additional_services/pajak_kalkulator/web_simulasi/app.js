const API_BASE = "http://localhost:8002";
const parseCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

async function loginAdmin() {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin' })
        });
        const data = await res.json();
        return data.access_token;
    } catch (e) {
        console.error("Login failed:", e);
        return null;
    }
}

async function loadData() {
    try {
        // Fetch static data
        const [identitasRes, thrInfraRes, thr1bRes, thr2aRes, ptkpRes] = await Promise.all([
            fetch('../data_statis/infra/identitas_pajak_infra.json'),
            fetch('../data_statis/infra/thr_bonus_infra.json'),
            fetch('../data_statis/1b/thr_bonus_1b.json'),
            fetch('../data_statis/2a/thr_bonus_2a.json'),
            fetch('../../hitung_pajak/rule_PTKP_Tahunan.json')
        ]);

        const identitasData = await identitasRes.json();
        const thrInfra = await thrInfraRes.json();
        const thr1b = await thr1bRes.json();
        const thr2a = await thr2aRes.json();
        const ptkpRules = await ptkpRes.json();

        const thrBonus = [...thrInfra, ...thr1b, ...thr2a];

        const ptkpMap = {};
        ptkpRules.conditions.forEach(c => { ptkpMap[c.condition] = c.value; });

        const thrMap = {};
        const exgratiaMap = {};
        thrBonus.forEach(item => {
            const keyStr = String(item.nik || item.nama || '').trim().toUpperCase();
            if (keyStr) {
                thrMap[keyStr] = item.thr || 0;
                exgratiaMap[keyStr] = item.exgratia || item.bonus || 0;
            }
        });

        // Setup UI
        const tbody = document.getElementById('table-body');


        let totalStatsPenghasilan = 0;
        let totalStatsPKP = 0;

        // AUTHENTICATE
        const token = await loginAdmin();
        if (!token) {
            alert("Gagal koneksi ke backend (login admin). Cek console.");
            return;
        }

        // FETCH INFRA GANG HISTORY FOR DECEMBER 2025
        const historyListRes = await fetch(`${API_BASE}/payroll/history?period_month=12&period_year=2025&division_code=INFRA`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const historyListData = await historyListRes.json();

        let identitas = [];
        if (historyListData.success && historyListData.data) {
            identitas = historyListData.data.map(h => {
                // Find static supplementary info if available
                const staticInfo = identitasData.find(i => i.nik === h.nik) || {};
                return {
                    nik: h.nik,
                    nama: h.emp_name || h.nama || staticInfo.nama || '-',
                    jenis_kelamin: staticInfo.jenis_kelamin || '-',
                    status_keluarga: staticInfo.status_keluarga || 'TK/0',
                    emp_code: h.emp_code
                };
            });
        }

        if (identitas.length === 0) {
            // Fallback to static if backend returns nothing (or if we need to test)
            console.warn("No history found for INFRA in Dec 2025, falling back to static list");
            identitas = identitasData;
        }

        document.getElementById('stat-karyawan').innerText = identitas.length;

        // Generate loading rows
        const rowElements = [];
        identitas.forEach((emp, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="sticky-col-1 text-center">${index + 1}</td>
                <td class="sticky-col-2">${emp.nama}</td>
                <td class="text-center">${emp.jenis_kelamin || '-'}</td>
                <td class="text-center">${emp.status_keluarga || 'TK/0'}</td>
                <td class="text-center">12</td>
                <td colspan="12" class="text-center" style="color: #64748B;">
                    Memuat data history API...
                </td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
            `;
            tbody.appendChild(tr);
            rowElements.push({ emp, tr, index });
        });

        // BATCH PROCESSING TO AVOID OVERLOADING
        const annualTaxRes = await fetch(`${API_BASE}/report/tax/annual?year=2025&division=INFRA`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const annualData = await annualTaxRes.json();

        if (annualData.success && annualData.data && annualData.data.employees) {
            tbody.innerHTML = ''; // clear loading rows

            let index = 0;
            for (const emp of annualData.data.employees) {
                const tr = document.createElement('tr');

                let monthCols = '';
                for (let i = 1; i <= 12; i++) {
                    monthCols += `<td class="text-right">${parseCurrency(emp.monthly_income[i] || 0)}</td>`;
                }

                totalStatsPenghasilan += emp.total_penghasilan_setahun;
                totalStatsPKP += emp.penghasilan_kena_pajak;

                tr.innerHTML = `
                    <td class="sticky-col-1 text-center">${index + 1}</td>
                    <td class="sticky-col-2">${emp.emp_name}</td>
                    <td class="text-center">${emp.gender || '-'}</td>
                    <td class="text-center">${emp.status_ptkp || 'TK/0'}</td>
                    <td class="text-center">12</td>
                    ${monthCols}
                    <td class="text-right" style="font-weight: 600;">${parseCurrency(emp.total_income)}</td>
                    <td class="text-right">${parseCurrency(emp.thr)}</td>
                    <td class="text-right">${parseCurrency(emp.bonus)}</td>
                    <td class="text-right">${parseCurrency(emp.medical_claim)}</td>
                    <td class="text-right highlight-col">${parseCurrency(emp.total_penghasilan_setahun)}</td>
                    <td class="text-right highlight-col">${parseCurrency(emp.ptkp)}</td>
                    <td class="text-right highlight-col-alt">${parseCurrency(emp.penghasilan_kena_pajak)}</td>
                `;
                tbody.appendChild(tr);
                index++;
            }

            // Update live stats
            document.getElementById('stat-karyawan').innerText = annualData.data.employees.length;
            document.getElementById('stat-penghasilan').innerText = parseCurrency(totalStatsPenghasilan);
            document.getElementById('stat-pkp').innerText = parseCurrency(totalStatsPKP);
        } else {
            console.warn("No data returned from /report/tax/annual API");
            tbody.innerHTML = '<tr><td colspan="19" class="text-center" style="color: red;">Gagal memuat data histori dari backend.</td></tr>';
        }

    } catch (error) {
        console.error("Failed to load or parse data:", error);
        alert("Error loading static data. Check console for details.");
    }
}

document.getElementById('btn-export').addEventListener('click', () => {
    let csv = [];
    const rows = document.querySelectorAll("table tr");

    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').replace(/(\s\s)/gm, ' ');
            data = data.replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        csv.push(row.join(","));
    }

    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const downloadLink = document.createElement("a");
    downloadLink.download = "Pajak_Perbulan.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
});

document.addEventListener('DOMContentLoaded', loadData);
