/**
 * Simulasi Pajak PPh 21 - Main Application
 * Web App for Monthly (TER) and Annual Tax Calculation
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const AppState = {
    employees: [],
    currentEmployeeId: null,

    // Get current employee
    getCurrentEmployee() {
        if (!this.currentEmployeeId) return null;
        return this.employees.find(emp => emp.id === this.currentEmployeeId) || null;
    },

    // Add new employee
    addEmployee(employee) {
        employee.id = Date.now().toString();
        employee.monthlyIncome = employee.monthlyIncome || {};
        employee.monthlyComponents = employee.monthlyComponents || {};
        this.employees.push(employee);
        this.saveToStorage();
        return employee;
    },

    // Update employee
    updateEmployee(id, data) {
        const index = this.employees.findIndex(emp => emp.id === id);
        if (index !== -1) {
            this.employees[index] = { ...this.employees[index], ...data };
            this.saveToStorage();
            return this.employees[index];
        }
        return null;
    },

    // Delete employee
    deleteEmployee(id) {
        this.employees = this.employees.filter(emp => emp.id !== id);
        if (this.currentEmployeeId === id) {
            this.currentEmployeeId = null;
        }
        this.saveToStorage();
    },

    // Save to localStorage
    saveToStorage() {
        try {
            localStorage.setItem('simulasiPajak_employees', JSON.stringify(this.employees));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },

    // Load from localStorage
    loadFromStorage() {
        try {
            const data = localStorage.getItem('simulasiPajak_employees');
            if (data) {
                this.employees = JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
        }
    },

    // Reset all data
    reset() {
        this.employees = [];
        this.currentEmployeeId = null;
        localStorage.removeItem('simulasiPajak_employees');
    }
};

// ============================================
// SAMPLE DATA
// ============================================

const SAMPLE_DATA = [
    {
        no: 1,
        name: "SARWANDI",
        nik: "1902050708780007",
        npwp: "97.228.383.2-305.000",
        gender: "L",
        status: "K/1",
        position: "KARYAWAN PERAWATAN",
        address: "DSN AIR BEGANTUNG RT. 009 RW. 003 DESA KACANG BUTOR KEC. BADAU",
        masaKerja: 12,
        year: 2026,
        monthlyIncome: {
            january: 4048600,
            february: 7080250,
            march: 9732523,
            april: 8456290,
            may: 9340382,
            june: 8904452,
            july: 8824994,
            august: 8768974,
            september: 8915655,
            october: 9205932,
            november: 8624350,
            december: 9310269
        },
        monthlyComponents: {
            january: 77532,
            february: 77532,
            march: 77532,
            april: 77532,
            may: 77532,
            june: 77532,
            july: 78542,
            august: 78542,
            september: 78542,
            october: 78542,
            november: 78542,
            december: 79562
        },
        thr: 4053100,
        bonus: 600000,
        tantiem: 0
    },
    {
        no: 2,
        name: "SUHARMAN",
        nik: "1902051909730001",
        npwp: "97.228.314.7-305.000",
        gender: "L",
        status: "K/0",
        position: "KARYAWAN PERAWATAN",
        address: "DSN. AIR BEGANTUNG RT.009 RW.003 DESA KACANG BUTOR KEC. BADAU",
        masaKerja: 12,
        year: 2026,
        monthlyIncome: {
            january: 4455775,
            february: 4108374,
            march: 4192070,
            april: 5359270,
            may: 7161143,
            june: 5205913,
            july: 6705276,
            august: 6660460,
            september: 5844543,
            october: 5810931,
            november: 6079828,
            december: 5977013
        },
        monthlyComponents: {
            january: 77532,
            february: 77532,
            march: 77532,
            april: 77532,
            may: 77532,
            june: 77532,
            july: 79312,
            august: 79312,
            september: 79312,
            october: 79312,
            november: 79312,
            december: 80152
        },
        thr: 4059600,
        bonus: 200000,
        tantiem: 0
    },
    {
        no: 3,
        name: "ERWIN HAZANI",
        nik: "1902050708720001",
        npwp: "97.237.829.3-305.000",
        gender: "L",
        status: "K/1",
        position: "KARYAWAN PERAWATAN",
        address: "DSN. AIR BEGANTUNG RT.009 RW.003 DESA KACANG BUTOR KEC. BADAU",
        masaKerja: 12,
        year: 2026,
        monthlyIncome: {
            january: 4469625,
            february: 4957785,
            march: 4586316,
            april: 5472014,
            may: 6692677,
            june: 5763319,
            july: 6939165,
            august: 6771104,
            september: 6054624,
            october: 5717924,
            november: 6054624,
            december: 6150000
        },
        monthlyComponents: {
            january: 77532,
            february: 77532,
            march: 77532,
            april: 77532,
            may: 77532,
            june: 77532,
            july: 78542,
            august: 78542,
            september: 78542,
            october: 78542,
            november: 78542,
            december: 79562
        },
        thr: 4049100,
        bonus: 600000,
        tantiem: 0
    },
    {
        no: 4,
        name: "ARLINI",
        nik: "1902050708720002",
        npwp: "-",
        gender: "P",
        status: "TK/0",
        position: "KERANI",
        address: "DSN. AIR BEGANTUNG",
        masaKerja: 12,
        year: 2026,
        monthlyIncome: {
            january: 5502555,
            february: 5258094,
            march: 5388607,
            april: 5227229,
            may: 5825565,
            june: 5182413,
            july: 5779544,
            august: 6049645,
            september: 5528534,
            october: 5897789,
            november: 4174048,
            december: 5500000
        },
        monthlyComponents: {
            january: 77532,
            february: 77532,
            march: 77532,
            april: 77532,
            may: 77532,
            june: 77532,
            july: 78542,
            august: 78542,
            september: 78542,
            october: 78542,
            november: 78542,
            december: 79562
        },
        thr: 3994600,
        bonus: 600000,
        tantiem: 0
    }
];

// ============================================
// UI RENDERING
// ============================================

const UI = {
    // Render employee list
    renderEmployeeList() {
        const container = document.getElementById('employeeList');
        if (!container) return;

        if (AppState.employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👤</div>
                    <h3>Belum ada data karyawan</h3>
                    <p>Klik "Tambah" untuk menambahkan karyawan</p>
                </div>
            `;
            document.getElementById('totalEmployees').textContent = '0';
            return;
        }

        container.innerHTML = AppState.employees.map(emp => {
            const isActive = emp.id === AppState.currentEmployeeId;
            const taxResult = emp.monthlyIncome ? calculateEmployeeTax(emp) : null;
            const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            return `
                <div class="employee-item ${isActive ? 'active' : ''}" data-id="${emp.id}">
                    <div class="employee-avatar">${initials}</div>
                    <div class="employee-info">
                        <div class="employee-name">${emp.name}</div>
                        <div class="employee-status">${emp.status} • ${emp.position || '-'}</div>
                    </div>
                    ${taxResult ? `<div class="employee-tax">${taxResult.totalTaxYearFormatted}</div>` : ''}
                </div>
            `;
        }).join('');

        document.getElementById('totalEmployees').textContent = AppState.employees.length;

        // Add click handlers
        container.querySelectorAll('.employee-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                AppState.currentEmployeeId = id;
                this.renderEmployeeList();
                this.loadEmployeeToForm();
                this.renderAllTaxCalculations();
            });
        });
    },

    // Load employee data to form
    loadEmployeeToForm() {
        const emp = AppState.getCurrentEmployee();
        if (!emp) {
            document.getElementById('employeeForm').reset();
            document.getElementById('btnDeleteEmployee').style.display = 'none';
            return;
        }

        document.getElementById('empNo').value = emp.no || '';
        document.getElementById('empName').value = emp.name || '';
        document.getElementById('empNIK').value = emp.nik || '';
        document.getElementById('empNPWP').value = emp.npwp || '';
        document.getElementById('empGender').value = emp.gender || 'L';
        document.getElementById('empStatus').value = emp.status || 'TK/0';
        document.getElementById('empPosition').value = emp.position || '';
        document.getElementById('empAddress').value = emp.address || '';
        document.getElementById('empMasaKerja').value = emp.masaKerja || 12;
        document.getElementById('empYear').value = emp.year || 2026;

        // Load monthly income
        const months = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];

        months.forEach(month => {
            const incomeInput = document.querySelector(`.month-income[data-month="${month}"]`);
            const componentInput = document.querySelector(`.month-component[data-month="${month}"]`);

            if (incomeInput) incomeInput.value = emp.monthlyIncome?.[month] || '';
            if (componentInput) componentInput.value = emp.monthlyComponents?.[month] || '';
        });

        // Load irregular income
        document.getElementById('incomeTHR').value = emp.thr || '';
        document.getElementById('incomeBonus').value = emp.bonus || '';
        document.getElementById('incomeTantiem').value = emp.tantiem || '';

        // Update badge
        const terCategory = getTERCategory(emp.status || 'TK/0');
        document.getElementById('terCategoryBadge').textContent = terCategory.replace('_', ' ');

        document.getElementById('btnDeleteEmployee').style.display = 'inline-flex';
    },

    // Save form to employee
    saveEmployeeFromForm() {
        const empData = {
            no: document.getElementById('empNo').value,
            name: document.getElementById('empName').value,
            nik: document.getElementById('empNIK').value,
            npwp: document.getElementById('empNPWP').value,
            gender: document.getElementById('empGender').value,
            status: document.getElementById('empStatus').value,
            position: document.getElementById('empPosition').value,
            address: document.getElementById('empAddress').value,
            masaKerja: parseInt(document.getElementById('empMasaKerja').value) || 12,
            year: parseInt(document.getElementById('empYear').value) || 2026
        };

        const currentEmp = AppState.getCurrentEmployee();
        if (currentEmp) {
            AppState.updateEmployee(currentEmp.id, empData);
        } else {
            const newEmp = AppState.addEmployee(empData);
            AppState.currentEmployeeId = newEmp.id;
        }

        this.renderEmployeeList();
        alert('Data karyawan berhasil disimpan!');
    },

    // Save monthly income
    saveMonthlyIncome() {
        const currentEmp = AppState.getCurrentEmployee();
        if (!currentEmp) {
            alert('Pilih atau buat data karyawan terlebih dahulu!');
            return;
        }

        const monthlyIncome = {};
        const monthlyComponents = {};

        const months = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];

        months.forEach(month => {
            const incomeInput = document.querySelector(`.month-income[data-month="${month}"]`);
            const componentInput = document.querySelector(`.month-component[data-month="${month}"]`);

            monthlyIncome[month] = parseInt(incomeInput?.value) || 0;
            monthlyComponents[month] = parseInt(componentInput?.value) || 0;
        });

        const irregularIncome = {
            thr: parseInt(document.getElementById('incomeTHR').value) || 0,
            bonus: parseInt(document.getElementById('incomeBonus').value) || 0,
            tantiem: parseInt(document.getElementById('incomeTantiem').value) || 0
        };

        AppState.updateEmployee(currentEmp.id, {
            monthlyIncome,
            monthlyComponents,
            ...irregularIncome
        });

        this.renderAllTaxCalculations();
        this.renderEmployeeList();
        alert('Data penghasilan berhasil disimpan!');
    },

    // Render all tax calculations
    renderAllTaxCalculations() {
        const emp = AppState.getCurrentEmployee();
        if (!emp) return;

        const taxResult = calculateEmployeeTax(emp);

        this.renderMonthlyTax(taxResult);
        this.renderAnnualTax(taxResult);
        this.renderASTEK(emp, taxResult);
    },

    // Render monthly tax table
    renderMonthlyTax(taxResult) {
        const tbody = document.querySelector('#monthlyTaxTable tbody');
        if (!tbody) return;

        const months = [
            { key: 'january', label: 'Januari' },
            { key: 'february', label: 'Februari' },
            { key: 'march', label: 'Maret' },
            { key: 'april', label: 'April' },
            { key: 'may', label: 'Mei' },
            { key: 'june', label: 'Juni' },
            { key: 'july', label: 'Juli' },
            { key: 'august', label: 'Agustus' },
            { key: 'september', label: 'September' },
            { key: 'october', label: 'Oktober' },
            { key: 'november', label: 'November' }
        ];

        tbody.innerHTML = months.map(m => {
            const tax = taxResult.monthlyTaxes[m.key];
            if (!tax || tax.grossIncome === 0) {
                return `
                    <tr>
                        <td>${m.label}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                `;
            }
            return `
                <tr>
                    <td>${m.label}</td>
                    <td>${formatCurrency(tax.grossIncome)}</td>
                    <td>${tax.category}</td>
                    <td>${tax.rateFormatted}</td>
                    <td>${tax.taxFormatted}</td>
                </tr>
            `;
        }).join('');

        // Update summary cards
        document.getElementById('totalTaxJanNov').textContent = taxResult.totalTaxJanNovFormatted;
        document.getElementById('taxDecember').textContent = taxResult.decemberTaxFormatted;
        document.getElementById('totalTaxYear').textContent = taxResult.totalTaxYearFormatted;
        document.getElementById('tableTotalJanNov').textContent = taxResult.totalTaxJanNovFormatted;
    },

    // Render annual tax
    renderAnnualTax(taxResult) {
        // Income section
        document.getElementById('annualGajiPokok').textContent = taxResult.totalGajiPokokFormatted;
        document.getElementById('annualTunjangan').textContent = formatCurrency(0);
        document.getElementById('annualPremi').textContent = taxResult.totalPremiAsuransiFormatted;
        document.getElementById('annualTHR').textContent = taxResult.thrFormatted;
        document.getElementById('annualBonus').textContent = taxResult.bonusFormatted;
        document.getElementById('annualTantiem').textContent = taxResult.tantiemFormatted;
        document.getElementById('annualBrutoTotal').innerHTML = `<strong>${taxResult.penghasilanBrutoSetahunFormatted}</strong>`;

        // Deductions & Tax section
        document.getElementById('annualBiayaJabatan').textContent = taxResult.biayaJabatanFormatted;
        document.getElementById('annualIuranJHT').textContent = taxResult.iuranJHTJPFormatted;
        document.getElementById('annualNetto').innerHTML = `<strong>${taxResult.penghasilanNettoSetahunFormatted}</strong>`;
        document.getElementById('annualPTKPStatus').textContent = AppState.getCurrentEmployee()?.status || '-';
        document.getElementById('annualPTKP').textContent = taxResult.ptkpFormatted;
        document.getElementById('annualPKP').innerHTML = `<strong>${taxResult.pkpFormatted}</strong>`;
        document.getElementById('annualPPh21Setahun').textContent = taxResult.annualTaxFormatted;
        document.getElementById('annualPPh21Terbayar').textContent = taxResult.totalTaxJanNovFormatted;

        const decemberElement = document.getElementById('annualPPh21Desember');
        if (taxResult.isOverpaid) {
            decemberElement.innerHTML = `<strong style="color: var(--success-color)">Lebih Bayar: ${taxResult.overpaymentFormatted}</strong>`;
        } else {
            decemberElement.innerHTML = `<strong>${taxResult.decemberTaxFormatted}</strong>`;
        }

        // Bracket table
        const bracketTbody = document.querySelector('#bracketTable tbody');
        if (bracketTbody) {
            if (taxResult.taxBrackets.length === 0) {
                bracketTbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center">Tidak ada PKP (Penghasilan di bawah PTKP)</td>
                    </tr>
                `;
            } else {
                bracketTbody.innerHTML = taxResult.taxBrackets.map(b => `
                    <tr>
                        <td>${formatCurrency(b.from)} - ${formatCurrency(b.to)}</td>
                        <td>${b.rateFormatted}</td>
                        <td>${formatCurrency(b.pkpInLayer)}</td>
                        <td>${formatCurrency(b.tax)}</td>
                    </tr>
                `).join('');
            }
            document.getElementById('bracketTotalPPh21').textContent = taxResult.annualTaxFormatted;
        }
    },

    // Render ASTEK accumulation
    renderASTEK(emp, taxResult) {
        document.getElementById('astekTotalJanNov').textContent = taxResult.totalComponentsJanNovFormatted;
        document.getElementById('astekDecember').textContent = taxResult.decemberComponentFormatted;
        document.getElementById('astekTotalYear').textContent = taxResult.totalPremiAsuransiFormatted;

        // ASTEK table
        const astekTbody = document.querySelector('#astekTable tbody');
        if (!astekTbody) return;

        const months = [
            { key: 'january', label: 'Januari' },
            { key: 'february', label: 'Februari' },
            { key: 'march', label: 'Maret' },
            { key: 'april', label: 'April' },
            { key: 'may', label: 'Mei' },
            { key: 'june', label: 'Juni' },
            { key: 'july', label: 'Juli' },
            { key: 'august', label: 'Agustus' },
            { key: 'september', label: 'September' },
            { key: 'october', label: 'Oktober' },
            { key: 'november', label: 'November' },
            { key: 'december', label: 'Desember' }
        ];

        let totalJHT = 0, totalJP = 0, totalJKK = 0, totalJKM = 0, totalKes = 0, totalIuran = 0;

        astekTbody.innerHTML = months.map(m => {
            const income = emp.monthlyIncome?.[m.key] || 0;
            if (income === 0) {
                return `
                    <tr>
                        <td>${m.label}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>
                `;
            }

            const astek = calculateASTEKBREAKDOWN(income);
            totalJHT += astek.jhtEmployee;
            totalJP += astek.jpEmployee;
            totalJKK += astek.jkkEmployer;
            totalJKM += astek.jkmEmployer;
            totalKes += astek.kesEmployee;
            totalIuran += astek.totalEmployee;

            return `
                <tr>
                    <td>${m.label}</td>
                    <td>${formatCurrency(astek.jhtEmployee)}</td>
                    <td>${formatCurrency(astek.jpEmployee)}</td>
                    <td>${formatCurrency(astek.jkkEmployer)}</td>
                    <td>${formatCurrency(astek.jkmEmployer)}</td>
                    <td>${formatCurrency(astek.kesEmployee)}</td>
                    <td><strong>${formatCurrency(astek.totalEmployee)}</strong></td>
                </tr>
            `;
        }).join('');

        document.getElementById('totalJHT').textContent = formatCurrency(totalJHT);
        document.getElementById('totalJP').textContent = formatCurrency(totalJP);
        document.getElementById('totalJKK').textContent = formatCurrency(totalJKK);
        document.getElementById('totalJKM').textContent = formatCurrency(totalJKM);
        document.getElementById('totalKes').textContent = formatCurrency(totalKes);
        document.getElementById('totalIuran').innerHTML = `<strong>${formatCurrency(totalIuran)}</strong>`;
    }
};

// ============================================
// EVENT HANDLERS
// ============================================

function initEventHandlers() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabId = `tab-${btn.dataset.tab}`;
            document.getElementById(tabId)?.classList.add('active');
        });
    });

    // Add employee button
    document.getElementById('btnAddEmployee')?.addEventListener('click', () => {
        AppState.currentEmployeeId = null;
        document.getElementById('employeeForm').reset();
        document.getElementById('btnDeleteEmployee').style.display = 'none';
        UI.renderEmployeeList();

        // Switch to employee tab
        document.querySelector('[data-tab="employee"]').click();
    });

    // Save employee button
    document.getElementById('btnSaveEmployee')?.addEventListener('click', () => {
        const name = document.getElementById('empName').value.trim();
        if (!name) {
            alert('Nama karyawan wajib diisi!');
            return;
        }
        UI.saveEmployeeFromForm();
    });

    // Delete employee button
    document.getElementById('btnDeleteEmployee')?.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin menghapus data karyawan ini?')) {
            AppState.deleteEmployee(AppState.currentEmployeeId);
            UI.renderEmployeeList();
            document.getElementById('employeeForm').reset();
            document.getElementById('btnDeleteEmployee').style.display = 'none';
        }
    });

    // Calculate monthly button
    document.getElementById('btnCalculateMonthly')?.addEventListener('click', () => {
        UI.saveMonthlyIncome();
    });

    // Load sample data button
    document.getElementById('btnLoadSample')?.addEventListener('click', () => {
        if (confirm('Ini akan menimpa data yang ada. Lanjutkan?')) {
            AppState.reset();
            SAMPLE_DATA.forEach(data => {
                AppState.addEmployee(data);
            });
            if (AppState.employees.length > 0) {
                AppState.currentEmployeeId = AppState.employees[0].id;
            }
            UI.renderEmployeeList();
            UI.loadEmployeeToForm();
            UI.renderAllTaxCalculations();
        }
    });

    // Export button
    document.getElementById('btnExport')?.addEventListener('click', () => {
        if (AppState.employees.length === 0) {
            alert('Tidak ada data untuk diexport!');
            return;
        }

        const dataStr = JSON.stringify(AppState.employees, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulasi_pajak_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Reset button
    document.getElementById('btnReset')?.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin menghapus SEMUA data?')) {
            AppState.reset();
            UI.renderEmployeeList();
            document.getElementById('employeeForm').reset();
            document.getElementById('btnDeleteEmployee').style.display = 'none';
        }
    });

    // Status change - update TER badge
    document.getElementById('empStatus')?.addEventListener('change', (e) => {
        const terCategory = getTERCategory(e.target.value);
        document.getElementById('terCategoryBadge').textContent = terCategory.replace('_', ' ');
    });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load saved data
    AppState.loadFromStorage();

    // Initialize UI
    UI.renderEmployeeList();

    // If no employees, load sample data automatically
    if (AppState.employees.length === 0) {
        SAMPLE_DATA.forEach(data => {
            AppState.addEmployee(data);
        });
        if (AppState.employees.length > 0) {
            AppState.currentEmployeeId = AppState.employees[0].id;
        }
        UI.renderEmployeeList();
        UI.loadEmployeeToForm();
        UI.renderAllTaxCalculations();
    } else if (AppState.currentEmployeeId) {
        UI.loadEmployeeToForm();
        UI.renderAllTaxCalculations();
    }

    // Setup event handlers
    initEventHandlers();

    console.log('Simulasi Pajak PPh 21 - Loaded successfully');
});