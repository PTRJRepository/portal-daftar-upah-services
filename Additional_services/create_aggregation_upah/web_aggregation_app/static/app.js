/**
 * Aggregation Table Editor - Frontend Application
 */

// ==================== CONFIGURATION ====================
const API_BASE = '';

// Column configuration - defines which columns to show and how to format them
const COLUMNS = [
    { key: 'gang_code', label: 'Gang', editable: false, type: 'text', class: 'gang-code' },
    { key: 'gang_description', label: 'Description', editable: false, type: 'text' },
    { key: 'total_employees', label: 'Emp', editable: true, type: 'int' },
    { key: 'total_hk', label: 'HK', editable: true, type: 'float' },
    { key: 'total_hari_kerja', label: 'Hari', editable: true, type: 'int' },
    { key: 'total_upah_bersih', label: 'Upah Bersih', editable: true, type: 'currency', class: 'currency' },
    { key: 'total_premi', label: 'Tot Premi', editable: true, type: 'currency' },
    { key: 'total_lembur', label: 'Lembur', editable: true, type: 'currency' },
    { key: 'total_ffb_weight', label: 'FFB (Ton)', editable: true, type: 'float' },
    { key: 'total_upah_dasar', label: 'Upah Dasar', editable: true, type: 'currency' },
    { key: 'total_upah_pokok', label: 'Upah Pokok', editable: true, type: 'currency' },
    { key: 'total_gaji_pokok', label: 'Gaji Pokok', editable: true, type: 'currency' },
    { key: 'total_beras', label: 'Beras', editable: true, type: 'currency' },
    { key: 'total_jabatan', label: 'Jabatan', editable: true, type: 'currency' },
    { key: 'total_masa_kerja', label: 'Masa Kerja', editable: true, type: 'currency' },
    { key: 'total_tunjangan', label: 'Tunjangan', editable: true, type: 'currency' },
    { key: 'total_premi_brondol', label: 'P. Brondol', editable: true, type: 'currency' },
    { key: 'total_premi_prunning', label: 'P. Prunning', editable: true, type: 'currency' },
    { key: 'total_potongan', label: 'Potongan', editable: true, type: 'currency' },
    { key: 'total_pph21', label: 'PPh21', editable: true, type: 'currency' },
    { key: 'total_bpjs_pekerja', label: 'BPJS Pkj', editable: true, type: 'currency' },
    { key: 'total_bpjs_majikan', label: 'BPJS Mjk', editable: true, type: 'currency' },
    { key: 'total_spsi', label: 'SPSI', editable: true, type: 'currency' },
    { key: 'total_upah_kotor', label: 'Upah Kotor', editable: true, type: 'currency' },
];

// ==================== STATE ====================
let currentRecords = [];
let currentDivision = '';
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let seederInterval = null;
let selectedRowId = null;

// ==================== DOM ELEMENTS ====================
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    divisionSelect: document.getElementById('divisionSelect'),
    monthSelect: document.getElementById('monthSelect'),
    yearSelect: document.getElementById('yearSelect'),
    loadBtn: document.getElementById('loadBtn'),
    exportBtn: document.getElementById('exportBtn'),
    summaryBtn: document.getElementById('summaryBtn'),
    seederBtn: document.getElementById('seederBtn'),
    tableTitle: document.getElementById('tableTitle'),
    recordCount: document.getElementById('recordCount'),
    emptyState: document.getElementById('emptyState'),
    dataTable: document.getElementById('dataTable'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    summarySection: document.getElementById('summarySection'),
    summaryGrid: document.getElementById('summaryGrid'),
    seederModal: document.getElementById('seederModal'),
    closeSeederModal: document.getElementById('closeSeederModal'),
    seederDivision: document.getElementById('seederDivision'),
    seederMonth: document.getElementById('seederMonth'),
    seederYear: document.getElementById('seederYear'),
    seederProgress: document.getElementById('seederProgress'),
    progressBar: document.getElementById('progressBar'),
    progressInfo: document.getElementById('progressInfo'),
    progressCurrent: document.getElementById('progressCurrent'),
    progressPercent: document.getElementById('progressPercent'),
    seederLog: document.getElementById('seederLog'),
    startSeederBtn: document.getElementById('startSeederBtn'),
    stopSeederBtn: document.getElementById('stopSeederBtn'),
    cancelSeederBtn: document.getElementById('cancelSeederBtn'),
    toastContainer: document.getElementById('toastContainer'),
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Set current month/year
    elements.monthSelect.value = currentMonth;
    elements.yearSelect.value = currentYear;

    // Initialize seeder modal dropdowns
    initSeederModal();

    // Bind events
    bindEvents();

    // Check health and load divisions
    await checkHealth();
    await loadDivisions();
});

function bindEvents() {
    elements.loadBtn.addEventListener('click', loadData);
    elements.exportBtn.addEventListener('click', exportCSV);
    elements.summaryBtn.addEventListener('click', toggleSummary);
    elements.seederBtn.addEventListener('click', openSeederModal);
    elements.closeSeederModal.addEventListener('click', closeSeederModal);
    elements.cancelSeederBtn.addEventListener('click', closeSeederModal);
    elements.startSeederBtn.addEventListener('click', startSeeder);
    elements.stopSeederBtn.addEventListener('click', stopSeeder);

    // Close modal on overlay click
    elements.seederModal.addEventListener('click', (e) => {
        if (e.target === elements.seederModal) closeSeederModal();
    });
}

function initSeederModal() {
    // Populate month/year dropdowns
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    elements.seederMonth.innerHTML = months.map((m, i) =>
        `<option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>${m}</option>`
    ).join('');

    elements.seederYear.innerHTML = [2024, 2025, 2026, 2027].map(y =>
        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
    ).join('');
}

// ==================== API FUNCTIONS ====================
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'API Error');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function checkHealth() {
    try {
        const data = await apiRequest('/api/health');
        if (data.status === 'healthy') {
            setStatus('connected', 'Database Connected');
        } else {
            setStatus('disconnected', 'Database Error');
        }
    } catch (error) {
        setStatus('disconnected', 'Connection Failed');
    }
}

async function loadDivisions() {
    try {
        const data = await apiRequest('/api/divisions');
        const divisions = data.divisions || [];

        elements.divisionSelect.innerHTML = divisions.map(d =>
            `<option value="${d}">${d}</option>`
        ).join('');

        // Also update seeder modal
        elements.seederDivision.innerHTML =
            `<option value="ALL">ALL Divisions</option>` +
            divisions.map(d => `<option value="${d}">${d}</option>`).join('');

        if (divisions.length > 0) {
            currentDivision = divisions[0];
        }
    } catch (error) {
        showToast('Failed to load divisions', 'error');
    }
}

async function loadData() {
    const division = elements.divisionSelect.value;
    const month = parseInt(elements.monthSelect.value);
    const year = parseInt(elements.yearSelect.value);

    if (!division) {
        showToast('Please select a division', 'error');
        return;
    }

    currentDivision = division;
    currentMonth = month;
    currentYear = year;

    elements.loadBtn.disabled = true;
    elements.loadBtn.innerHTML = '<span class="btn-icon">⏳</span> Loading...';

    try {
        const data = await apiRequest(`/api/aggregations?division=${division}&month=${month}&year=${year}`);
        currentRecords = data.records || [];

        renderTable();

        elements.tableTitle.textContent = `${division} - ${getMonthName(month)} ${year}`;
        elements.recordCount.textContent = `${currentRecords.length} records`;
        elements.exportBtn.disabled = currentRecords.length === 0;

        showToast(`Loaded ${currentRecords.length} records`, 'success');
    } catch (error) {
        showToast(`Failed to load data: ${error.message}`, 'error');
    } finally {
        elements.loadBtn.disabled = false;
        elements.loadBtn.innerHTML = '<span class="btn-icon">📥</span> Load Data';
    }
}

async function updateRecord(recordId, field, value) {
    try {
        await apiRequest(`/api/aggregations/${recordId}`, {
            method: 'PUT',
            body: JSON.stringify({ [field]: value })
        });

        // Update local record
        const record = currentRecords.find(r => r.id === recordId);
        if (record) {
            record[field] = value;
        }

        showToast('Saved', 'success');
        return true;
    } catch (error) {
        showToast(`Failed to save: ${error.message}`, 'error');
        return false;
    }
}

// ==================== TABLE RENDERING ====================
function renderTable() {
    if (currentRecords.length === 0) {
        elements.emptyState.style.display = 'block';
        elements.dataTable.style.display = 'none';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.dataTable.style.display = 'table';

    // Render headers
    elements.tableHead.innerHTML = `
        <tr>
            ${COLUMNS.map(col => `<th>${col.label}</th>`).join('')}
        </tr>
    `;

    // Render body
    elements.tableBody.innerHTML = currentRecords.map(record => `
        <tr data-id="${record.id}">
            ${COLUMNS.map(col => {
        const value = record[col.key];
        const formatted = formatValue(value, col.type);
        const editable = col.editable ? 'editable' : '';
        const className = `${col.type === 'currency' || col.type === 'float' || col.type === 'int' ? 'number-cell' : ''} ${col.class || ''} ${editable}`;

        return `<td class="${className}" data-field="${col.key}" data-type="${col.type}" data-value="${value || 0}">${formatted}</td>`;
    }).join('')}
        </tr>
    `).join('');

    // Bind cell click events for editing
    elements.tableBody.querySelectorAll('.editable').forEach(cell => {
        cell.addEventListener('dblclick', handleCellEdit);
    });

    // Bind row click for highlighting
    elements.tableBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', handleRowClick);
    });
}

function handleRowClick(event) {
    const row = event.target.closest('tr');
    if (!row) return;

    // Remove previous selection
    elements.tableBody.querySelectorAll('tr.selected').forEach(r => {
        r.classList.remove('selected');
    });

    // Add selection to clicked row
    row.classList.add('selected');
    selectedRowId = parseInt(row.dataset.id);
}

function handleCellEdit(event) {
    const cell = event.target;
    if (cell.classList.contains('cell-editing')) return;

    const currentValue = cell.dataset.value;
    const field = cell.dataset.field;
    const type = cell.dataset.type;
    const row = cell.closest('tr');
    const recordId = parseInt(row.dataset.id);

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;

    // Replace cell content with input
    cell.classList.add('cell-editing');
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    // Save on blur or enter
    const saveEdit = async () => {
        let newValue = input.value.trim();

        // Parse based on type - handle Indonesian number format
        // Indonesian format: dots as thousand separator, comma as decimal
        // Also handle Excel paste with spaces
        newValue = parseInputNumber(newValue);

        if (type === 'int') {
            newValue = Math.round(newValue) || 0;
        } else if (type === 'float' || type === 'currency') {
            newValue = newValue || 0;
        }

        // Only update if changed
        if (newValue !== parseFloat(currentValue)) {
            const success = await updateRecord(recordId, field, newValue);
            if (success) {
                cell.dataset.value = newValue;
                cell.innerHTML = formatValue(newValue, type);
            } else {
                cell.innerHTML = formatValue(currentValue, type);
            }
        } else {
            cell.innerHTML = formatValue(currentValue, type);
        }

        cell.classList.remove('cell-editing');
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            cell.innerHTML = formatValue(currentValue, type);
            cell.classList.remove('cell-editing');
        }
    });
}

// ==================== SUMMARY ====================
async function toggleSummary() {
    const section = elements.summarySection;

    if (section.style.display === 'none') {
        await loadSummary();
        section.style.display = 'block';
        elements.summaryBtn.innerHTML = '<span class="btn-icon">📊</span> Hide Summary';
    } else {
        section.style.display = 'none';
        elements.summaryBtn.innerHTML = '<span class="btn-icon">📈</span> Summary';
    }
}

async function loadSummary() {
    const month = parseInt(elements.monthSelect.value);
    const year = parseInt(elements.yearSelect.value);

    try {
        const data = await apiRequest(`/api/summary?month=${month}&year=${year}`);
        renderSummary(data);
    } catch (error) {
        showToast(`Failed to load summary: ${error.message}`, 'error');
    }
}

function renderSummary(data) {
    const { summary, grand_total } = data;

    // Summary cards
    const cards = [
        { label: 'Total Divisions', value: summary.length, unit: 'divisions' },
        { label: 'Total Gangs', value: grand_total.gang_count, unit: 'gangs' },
        { label: 'Total Employees', value: grand_total.total_emp, unit: 'employees' },
        { label: 'Total HK', value: formatNumber(grand_total.total_hk, 1), unit: 'hari kerja' },
        { label: 'Total Upah Bersih', value: formatCurrency(grand_total.total_upah), unit: 'Rupiah' },
        { label: 'Total FFB Weight', value: formatNumber(grand_total.total_ffb, 2), unit: 'tons' },
    ];

    elements.summaryGrid.innerHTML = cards.map(card => `
        <div class="summary-card">
            <div class="label">${card.label}</div>
            <div class="value">${card.value}</div>
            <div class="unit">${card.unit}</div>
        </div>
    `).join('');

    // Add division breakdown table
    if (summary.length > 0) {
        elements.summaryGrid.innerHTML += `
            <div style="grid-column: 1 / -1; margin-top: 16px;">
                <table class="data-table" style="display: table;">
                    <thead>
                        <tr>
                            <th>Division</th>
                            <th>Gangs</th>
                            <th>Employees</th>
                            <th>HK</th>
                            <th>Upah Bersih</th>
                            <th>FFB (Ton)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.map(row => `
                            <tr>
                                <td class="gang-code">${row.division_code}</td>
                                <td class="number-cell">${row.gang_count}</td>
                                <td class="number-cell">${row.total_emp}</td>
                                <td class="number-cell">${formatNumber(row.total_hk, 1)}</td>
                                <td class="number-cell currency">${formatCurrency(row.total_upah)}</td>
                                <td class="number-cell">${formatNumber(row.total_ffb || 0, 2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
}

// ==================== EXPORT ====================
function exportCSV() {
    if (currentRecords.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    // Build CSV
    const headers = COLUMNS.map(c => c.label);
    const rows = currentRecords.map(record =>
        COLUMNS.map(col => {
            const val = record[col.key];
            return val !== null && val !== undefined ? val : 0;
        })
    );

    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `aggregation_${currentDivision}_${currentMonth}_${currentYear}.csv`;
    link.click();

    showToast('CSV exported', 'success');
}

// ==================== SEEDER ====================
function openSeederModal() {
    elements.seederModal.classList.add('active');
    resetSeederUI();
}

function closeSeederModal() {
    elements.seederModal.classList.remove('active');
    if (seederInterval) {
        clearInterval(seederInterval);
        seederInterval = null;
    }
}

function resetSeederUI() {
    elements.seederProgress.style.display = 'none';
    elements.progressInfo.style.display = 'none';
    elements.progressBar.style.width = '0%';
    elements.startSeederBtn.style.display = 'inline-flex';
    elements.stopSeederBtn.style.display = 'none';
    elements.startSeederBtn.disabled = false;
    elements.seederLog.innerHTML = '<div class="log-entry info">Ready to seed. Click "Start Seeder" to begin.</div>';
}

async function startSeeder() {
    const division = elements.seederDivision.value;
    const month = parseInt(elements.seederMonth.value);
    const year = parseInt(elements.seederYear.value);

    elements.startSeederBtn.disabled = true;
    elements.startSeederBtn.style.display = 'none';
    elements.stopSeederBtn.style.display = 'inline-flex';
    elements.seederProgress.style.display = 'block';
    elements.progressInfo.style.display = 'flex';
    elements.seederLog.innerHTML = '';

    try {
        await apiRequest('/api/seeder/start', {
            method: 'POST',
            body: JSON.stringify({ division, month, year })
        });

        // Start polling for status
        seederInterval = setInterval(pollSeederStatus, 1000);

    } catch (error) {
        showToast(`Failed to start seeder: ${error.message}`, 'error');
        resetSeederUI();
    }
}

async function pollSeederStatus() {
    try {
        const status = await apiRequest('/api/seeder/status');

        // Update progress
        if (status.total > 0) {
            const percent = Math.round((status.progress / status.total) * 100);
            elements.progressBar.style.width = `${percent}%`;
            elements.progressPercent.textContent = `${percent}%`;
            elements.progressCurrent.textContent = status.current_division
                ? `Processing ${status.current_division}...`
                : 'Processing...';
        }

        // Update logs
        elements.seederLog.innerHTML = status.logs.map(log => {
            let cls = 'info';
            if (log.includes('✅')) cls = 'success';
            if (log.includes('❌')) cls = 'error';
            return `<div class="log-entry ${cls}">${log}</div>`;
        }).join('');
        elements.seederLog.scrollTop = elements.seederLog.scrollHeight;

        // Check if completed
        if (!status.is_running) {
            clearInterval(seederInterval);
            seederInterval = null;

            elements.stopSeederBtn.style.display = 'none';
            elements.startSeederBtn.style.display = 'inline-flex';
            elements.startSeederBtn.disabled = false;

            if (status.completed) {
                showToast('Seeding completed!', 'success');
            } else if (status.error) {
                showToast(`Seeder error: ${status.error}`, 'error');
            }
        }

    } catch (error) {
        console.error('Failed to poll seeder status:', error);
    }
}

async function stopSeeder() {
    try {
        await apiRequest('/api/seeder/stop', { method: 'POST' });
        showToast('Stop signal sent', 'info');
    } catch (error) {
        showToast(`Failed to stop: ${error.message}`, 'error');
    }
}

// ==================== UTILITIES ====================

/**
 * Parse input number handling various formats:
 * - Indonesian format: 1.234.567,89 (dots as thousands, comma as decimal)
 * - Excel copy: 1,234,567.89 or 1.234.567,89
 * - Plain numbers: 1234567.89
 */
function parseInputNumber(value) {
    if (typeof value === 'number') return value;
    if (!value || value === '') return 0;

    let str = String(value).trim();

    // Remove any spaces
    str = str.replace(/\s/g, '');

    // Check if it's Indonesian format (has dots and ends with comma for decimal)
    // e.g., "1.234.567,89" or "1.234,56"
    const hasCommaDecimal = /,\d{1,2}$/.test(str);
    const hasDotThousand = /\.\d{3}/.test(str);

    if (hasCommaDecimal || hasDotThousand) {
        // Indonesian format: remove dots (thousands), replace comma with dot (decimal)
        str = str.replace(/\./g, '').replace(',', '.');
    } else {
        // US/Excel format: remove commas (thousands), keep dot as decimal
        str = str.replace(/,/g, '');
    }

    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

function setStatus(type, text) {
    elements.statusDot.className = `status-dot ${type}`;
    elements.statusText.textContent = text;
}

function formatValue(value, type) {
    if (value === null || value === undefined) value = 0;

    switch (type) {
        case 'currency':
            return formatCurrency(value);
        case 'float':
            return formatNumber(value, 2);
        case 'int':
            return Math.round(value).toLocaleString('id-ID');
        default:
            return value;
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function formatNumber(value, decimals = 2) {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
