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
        const [identitasRes, thrBonusRes, ptkpRes] = await Promise.all([
            fetch('../data_statis/infra/identitas_pajak_infra.json'),
            fetch('../data_statis/infra/thr_bonus_infra.json'),
            fetch('../../hitung_pajak/rule_PTKP_Tahunan.json')
        ]);

        const identitasData = await identitasRes.json();
        const thrBonus = await thrBonusRes.json();
        const ptkpRules = await ptkpRes.json();

        const ptkpMap = {};
        ptkpRules.conditions.forEach(c => { ptkpMap[c.condition] = c.value; });

        const thrMap = {};
        const bonusMap = {};
        thrBonus.forEach(item => {
            thrMap[item.nik] = item.thr || 0;
            bonusMap[item.nik] = item.bonus || 0;
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
        const CONCURRENCY = 3;

        async function fetchHistoryForEmp(emp) {
            try {
                // 1. Resolve NIK to EmpCode
                const authHeader = { 'Authorization': `Bearer ${token}` };
                let targetEmpCode = null;

                try {
                    const nikRes = await fetch(`${API_BASE}/payroll/employee/by-nik/${emp.nik}`, { headers: authHeader });
                    if (nikRes.ok) {
                        const nikData = await nikRes.json();
                        targetEmpCode = nikData.EmpCode || nikData.emp_code;
                    }
                } catch (e) {
                    console.warn("Failed NIK lookup, using NIK directly", e);
                }

                if (!targetEmpCode) {
                    targetEmpCode = emp.emp_code || emp.nik; // Use history emp_code or fallback
                }

                // 2. Fetch History (For 2025)
                // We ask for 12 months, starting from Dec 2025 to capture Jan-Dec 2025
                // Wait, if current is considered Dec 2025, we want the whole 2025.
                // The history route returns requested number of months backwards. If we are in 2026, we fetch period using specific parameters?
                // The /history endpoint uses the current period backward.
                // If we want exactly 2025, we can just fetch history and filter client-side.
                const histRes = await fetch(`${API_BASE}/payroll/employee/${targetEmpCode}/history?months=24&include_current=true`, { headers: authHeader });
                const historyFetchData = await histRes.json();

                let monthlyIncomes = new Array(12).fill(0);

                if (historyFetchData.success && historyFetchData.data) {
                    historyFetchData.data.forEach(p => {
                        // Filter for 2025 specifically
                        if (p.period_year === 2025) {
                            let m = p.period_month;
                            if (m >= 1 && m <= 12) {
                                monthlyIncomes[m - 1] = p.jumlah_upah_kotor || p.penghasilan_bruto || p.upah_kotor || p.total_upah_kotor || 0;
                            }
                        }
                    });
                }

                return monthlyIncomes;
            } catch (error) {
                console.error(`Error fetching history for ${emp.nama} (${emp.nik}):`, error);
                return new Array(12).fill(0);
            }
        }

        // Process sequentially with chunks
        for (let i = 0; i < rowElements.length; i += CONCURRENCY) {
            const chunk = rowElements.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(async (item) => {
                const { emp, tr } = item;
                const monthlyIncomes = await fetchHistoryForEmp(emp);

                let totalBulan = monthlyIncomes.reduce((a, b) => a + b, 0);
                let monthCols = '';
                monthlyIncomes.forEach(inc => {
                    monthCols += `<td class="text-right">${parseCurrency(inc)}</td>`;
                });

                const thr = thrMap[emp.nik] || 0;
                const bonus = bonusMap[emp.nik] || 0;
                const medical = 0;

                const totalSetahun = totalBulan + thr + bonus + medical;
                const statusKeluarga = emp.status_keluarga || 'TK/0';
                const valuePTKP = ptkpMap[statusKeluarga] || 54000000;

                let pkp = totalSetahun - valuePTKP;
                if (pkp < 0) pkp = 0;

                totalStatsPenghasilan += totalSetahun;
                totalStatsPKP += pkp;

                tr.innerHTML = `
                    <td class="sticky-col-1 text-center">${item.index + 1}</td>
                    <td class="sticky-col-2">${emp.nama}</td>
                    <td class="text-center">${emp.jenis_kelamin || '-'}</td>
                    <td class="text-center">${statusKeluarga}</td>
                    <td class="text-center">12</td>
                    ${monthCols}
                    <td class="text-right" style="font-weight: 600;">${parseCurrency(totalBulan)}</td>
                    <td class="text-right">${parseCurrency(thr)}</td>
                    <td class="text-right">${parseCurrency(bonus)}</td>
                    <td class="text-right">${parseCurrency(medical)}</td>
                    <td class="text-right highlight-col">${parseCurrency(totalSetahun)}</td>
                    <td class="text-right highlight-col">${parseCurrency(valuePTKP)}</td>
                    <td class="text-right highlight-col-alt">${parseCurrency(pkp)}</td>
                `;
            }));

            // Update live stats
            document.getElementById('stat-penghasilan').innerText = parseCurrency(totalStatsPenghasilan);
            document.getElementById('stat-pkp').innerText = parseCurrency(totalStatsPKP);
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
