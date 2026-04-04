import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import '../styles/CustomPayrollTable.css';
import { getLockedRawTree, saveLockedManualEdit } from '../services/lockedDivisionService';
import { isProdMode } from '../utils/prodModeUtils';
import { PayrollAggregator } from '../utils/PayrollAggregator';
import { exportPayrollToExcel } from '../utils/exportPayrollToExcel';
import SelectionStatusBar from './common/SelectionStatusBar';
import TableContextMenu from './common/TableContextMenu';
import LoadingScreen from './common/LoadingScreen';
import { getTablePreferences, DEFAULT_CELL_COLORS } from '../services/tablePreferencesService';
import { usePayrollStream } from '../hooks/usePayrollStream';

/**
 * Helper: Extract asistensi number from gang code
 * Must be defined at module level to avoid TDZ (Temporal Dead Zone) errors in minified builds
 */
const getAsistensiLocal = (gang_code) => {
    if (!gang_code) return '';
    const gc = String(gang_code).trim().toUpperCase();
    if (gc.startsWith('K2')) return '1';
    const match = gc.match(/\d+/);
    return match ? match[0] : '';
};

/**
 * DAFTAR UPAH (Payroll Register)
 *
 * Daftar Upah adalah tabel yang berisi uraian lengkap tentang gaji karyawan,
 * yang mencakup:
 *
 * 1. IDENTITAS - Data karyawan (NIK, Nama, Jabatan, Gang)
 *
 * 2. ABSENSI - Kehadiran kerja
 *    - Jumlah HK (Hari Kerja)
 *    - Cuti (Tahunan, Sakit/Haid, Minggu, Nasional)
 *
 * 3. PENGGAJIAN - Upah pokok dan dasar
 *    - Upah Dasar, Gaji Pokok
 *
 * 4. TUNJANGAN - Tunjangan karyawan
 *    - Tunjangan Beras, Jabatan, Masa Kerja
 *    - Lembur (jika ada)
 *
 * 5. PENDAPATAN LAINNYA - Income tambahan (THR, Bonus, dll)
 *    - THR (Tunjangan Hari Raya) - dihitung untuk pajak, dipotong dari upah bersih
 *
 * 6. PREMI - Premi kerja
 *    - Premi Brondol, Pruning, dll
 *
 * 7. POTONGAN UPAH KOTOR - Potongan yang mengurangi upah kotor
 *    - Koreksi (jika ada)
 *
 * 8. UPAH KOTOR (Gross) - Total sebelum pajak
 *    = Gaji Pokok + Tunjangan + Premi + Pendapatan Lain - Koreksi
 *    ** Sudah termasuk THR untuk perhitungan PPh21 **
 *
 * 9. POTONGAN UPAH BERSIH - Potongan untuk menghitung upah bersih
 *    - ASTEK (BPJS Ketenagakerjaan)
 *    - BPJS Kesehatan
 *    - SPSI
 *    - PPh21
 *    - dll
 *
 * 10. UPAH BERSIH (Net) - Take-home pay
 *     = Upah Kotor - Total Potongan
 *     ** Sudah dikurangkan THR karena dibayarkan terpisah di bulan Februari **
 *
 * 11. PAJAK - Informasi PPh21
 *     - TER Category, PTKP Status
 *
 * Data diambil dari berbagai tabel database:
 * - HR_EMPLOYEE, HR_GANG (Identitas)
 * - PR_TASKREGLN (Absensi, Lembur)
 * - PR_ADTRANS (Premi, Potongan)
 * - employee_other_incomes (THR, Bonus)
 * - HR_PAYROLL (Konfigurasi Gaji)
 */

const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
};

const formatDecimal = (value) => {
    if (value === null || value === undefined) return '-';
    const n = Number(value);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Format header label to support newlines manually across environments
const formatHeaderLabel = (label) => {
    if (typeof label !== 'string') return label;
    if (!label.includes('\n')) return label;
    return label.split('\n').map((part, i) => (
        <React.Fragment key={i}>
            {i > 0 && <br />}
            {i === 1 ? <span style={{ fontSize: '9px', fontWeight: 'normal', color: '#cbd5e1' }}>{part}</span> : part}
        </React.Fragment>
    ));
};

// Helper function to get header group from label
const getHeaderGroup = (label) => {
    if (!label) return null;
    const upper = label.toUpperCase();
    if (upper === 'IDENTITAS') return 'IDENTITAS';
    if (upper === 'PAJAK') return 'PAJAK';
    if (upper === 'ABSENSI') return 'ABSENSI';
    if (upper === 'PANEN') return 'PANEN';
    if (upper === 'PENGGAJIAN') return 'PENGGAJIAN';
    if (upper === 'TUNJANGAN') return 'TUNJANGAN';
    if (upper === 'PENDAPATAN LAINNYA') return 'PENDAPATAN LAINNYA';
    if (upper === 'PREMI') return 'PREMI';
    if (upper.includes('POTONGAN UPAH KOTOR')) return 'POTONGAN UPAH KOTOR';
    if (upper === 'UPAH KOTOR') return 'UPAH KOTOR';
    if (upper.includes('POTONGAN UPAH BERSIH')) return 'POTONGAN UPAH BERSIH';
    if (upper === 'UPAH BERSIH') return 'UPAH BERSIH';
    return null;
};

export default function CustomPayrollTable({
    token, month, year, division, gangCode, onViewEmployeeDetail, onOpenHrProfile, fontSize = 100,
    onExportReady = null, refreshTrigger = 0,
    selectedEmployees = [], onToggleEmployeeSelection = () => { },
    onSelectAllEmployees = () => { },
    isEditMode = false,
    useHistoryDb = false,
    gangPrefix = null,
    gangLoading = false,  // Pass gangLoading from parent to prevent fetch during gang load
    initialData = null,   // Cached raw API response from parent
    onDataLoaded = null,   // Callback to notify parent of loaded data
    onRefresh = null      // Callback to trigger parent refresh (for saving)
}) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    // Track data readiness - only show table content after confirmed data load
    const [dataReady, setDataReady] = useState(false);
    const [error, setError] = useState('');
    
    // Progressive loading state
    const [loadingProgress, setLoadingProgress] = useState({
        stage: null, // 'fetching' | 'processing' | 'rendering' | 'complete'
        message: '',
        currentGang: null,
        totalGangs: 0,
        processedGangs: 0,
        totalEmployees: 0,
        processedEmployees: 0
    });

    const [dynamicHeaders, setDynamicHeaders] = useState({ premi: {}, potongan: {} });
    const [grandTotal, setGrandTotal] = useState(null);
    const [selection, setSelection] = useState([]); // Changed to array for multi-select
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStats, setSelectionStats] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [highlightedRowId, setHighlightedRowId] = useState(null);
    const [activePremiFields, setActivePremiFields] = useState([]);
    const [activePotFields, setActivePotFields] = useState([]);
    const [activePendapatanFields, setActivePendapatanFields] = useState([]); // dynamically discovered pendapatan_* fields
    const [allEmployeeNiks, setAllEmployeeNiks] = useState([]);

    // Manual Edit State
    const [editedCells, setEditedCells] = useState({}); // { 'nik-field': { value, originalValue, gang_code, type, name } }
    const [addedColumns, setAddedColumns] = useState([]); // Track new columns added in edit mode
    const [isSavingEdits, setIsSavingEdits] = useState(false);

    // Kontan (Other Income) State - Always editable column
    const [editedKontanCells, setEditedKontanCells] = useState({}); // { 'nik-kontan': { value, originalValue, gang_code } }
    const [isSavingKontan, setIsSavingKontan] = useState(false);

    // Tunjangan Mode & Rates
    const [tunjanganMode, setTunjanganMode] = useState('DB'); // 'DB' or 'CALC'
    const [tunjanganRates, setTunjanganRates] = useState({});

    // Tax View Mode
    const [isTaxExpanded, setIsTaxExpanded] = useState(false);

    // State for collapsible column groups
    const [isHarvestExpanded, setHarvestExpanded] = useState(false);
    const [isAttendanceExpanded, setAttendanceExpanded] = useState(false);
    const [isAllowanceExpanded, setAllowanceExpanded] = useState(false);
    const [isOtherIncomeExpanded, setOtherIncomeExpanded] = useState(false);
    const [isDeductionExpanded, setDeductionExpanded] = useState(true); // Default true to show BPJS details

    // Table Preferences (Body Cell Colors - applied to body cells, NOT headers)
    const [cellColors, setCellColors] = useState(DEFAULT_CELL_COLORS);

    const tableRef = useRef(null);

    // ================================================================
    // PROGRESSIVE STREAMING (SSE)
    // Replace the old fetch/process approach with SSE streaming
    // ================================================================
    const [streamEnabled, setStreamEnabled] = useState(true); // Always use streaming

    // Use SSE streaming for progressive data delivery
    // CRITICAL FIX: Remove gangLoading from enabled condition to allow streaming to start immediately
    // gangLoading was preventing stream from starting on some computers/virtual divisions
    const stream = usePayrollStream({
        token,
        division,
        month,
        year,
        gangPrefix,
        gangCode,
        enabled: !!token && !!division && !!month && !!year && streamEnabled
    });

    // Sync stream grand total to component state
    useEffect(() => {
        if (stream.grandTotal) {
            setGrandTotal(stream.grandTotal);
        }
    }, [stream.grandTotal]);

    // Sync stream dynamic headers to component state
    useEffect(() => {
        if (stream.meta) {
            const dynPot = stream.meta.dynamic_potongan_headers || [];
            const dynPrem = stream.meta.dynamic_premi_headers || [];
            const potTitleMap = stream.meta.potongan_title_map || {};
            const premTitleMap = stream.meta.premi_title_map || {};

            const premWithTitles = {};
            dynPrem.forEach(field => {
                const title = premTitleMap[field] || field;
                premWithTitles[title] = field;
            });
            const potWithTitles = {};
            dynPot.forEach(field => {
                const title = potTitleMap[field] || field;
                potWithTitles[title] = field;
            });
            setDynamicHeaders({ premi: premWithTitles, potongan: potWithTitles });

            // Notify parent of data loaded
            onDataLoaded?.({
                gangs: stream.gangs,
                grand_total: stream.grandTotal,
                dynamic_premi_headers: dynPrem,
                dynamic_potongan_headers: dynPot,
                premi_title_map: premTitleMap,
                potongan_title_map: potTitleMap
            });
        }
    }, [stream.meta, stream.gangs, stream.grandTotal, onDataLoaded]);

    // Merge stream progress with existing loadingProgress for the loading bar
    const effectiveProgress = useMemo(() => {
        // If streaming is active and has progress, use stream progress
        if (stream.progress?.stage && stream.progress.stage !== null) {
            return {
                stage: stream.progress.stage, // Use actual stage: 'connecting', 'querying', 'streaming', 'complete', 'error'
                message: stream.progress.message || 'Memproses data...',
                totalGangs: stream.progress.totalGangs || 0,
                processedGangs: stream.progress.processedGangs || 0,
                totalEmployees: stream.progress.totalEmployees || 0,
                processedEmployees: stream.progress.processedEmployees || 0,
                bytesReceived: stream.progress.bytesReceived || 0,
                currentGang: stream.progress.currentGang || null
            };
        }
        return loadingProgress;
    }, [stream.progress, loadingProgress]);

    // Determine if we should show the table (even if streaming is still in progress)
    const shouldShowTable = useMemo(() => {
        // Show table if we have any stream data
        if (stream.gangs && stream.gangs.length > 0) return true;
        // Show table if we have rows from legacy fetch
        if (rows.length > 0 && dataReady) return true;
        // Don't show table if still in early loading phase with no data
        return false;
    }, [stream.gangs, rows, dataReady]);

    const streamRows = useMemo(() => {
        console.log('[CustomPayrollTable] streamRows recomputing: stream.gangs.length =', stream.gangs?.length);
        if (!stream.gangs || stream.gangs.length === 0) {
            console.log('[CustomPayrollTable] streamRows: returning empty, stream.gangs is', stream.gangs);
            return [];
        }

        const processedRows = [];
        let globalNo = 1;

        stream.gangs.forEach(gangData => {
            // Guard against malformed data
            if (!gangData || typeof gangData !== 'object') {
                console.warn('[CustomPayrollTable] Skipping invalid gangData:', gangData);
                return;
            }

            const gCode = gangData.gang_code;
            const employees = Array.isArray(gangData.employees) ? gangData.employees : [];

            // Filter by gangPrefix if specified
            const filteredEmployees = gangPrefix
                ? employees.filter(emp => emp && getAsistensiLocal(emp.gang_code) === gangPrefix)
                : employees;

            // Filter by specific gangCode if specified
            const gangFilteredEmployees = gangCode && gangCode !== 'ALL'
                ? filteredEmployees.filter(emp => emp && emp.gang_code === gangCode)
                : filteredEmployees;

            // Add gang header
            processedRows.push({ type: 'gang_header', gang_code: gCode, id: `HEADER_${gCode}` });

            // Add employees with numbering
            gangFilteredEmployees.forEach(emp => {
                if (!emp) return;
                emp.no = globalNo++;
                emp.type = 'employee';
                emp.id = emp.new_nik || emp.nik || `EMP_${emp.no}`;
                processedRows.push(emp);
            });

            // Add gang total
            const gangTotal = gangData.gang_totals || {};
            gangTotal.type = 'gang_total';
            gangTotal.id = `TOTAL_${gCode}`;
            gangTotal.gang_code = gCode;
            gangTotal.nama = `TOTAL GANG ${gCode}`;
            gangTotal.emp_code = `${gangFilteredEmployees.length} Kary.`;
            processedRows.push(gangTotal);
        });

        return processedRows;
    }, [stream.gangs, gangPrefix, gangCode]);

    // Determine active dynamic fields from streamed rows
    // Use meta headers as source of truth, not employee data values
    // This ensures columns appear even when values are 0/null
    const streamActiveFields = useMemo(() => {
        const employeeRows = streamRows.filter(r => r.type === 'employee');
        if (employeeRows.length === 0) return { activePremi: [], activePot: [], activePendapatan: [] };

        // Primary source: meta headers from backend
        const dynPot = stream.meta?.dynamic_potongan_headers || [];
        const dynPrem = stream.meta?.dynamic_premi_headers || [];

        // Also extract from employee data to catch any fields backend missed
        const allFieldKeys = new Set();
        employeeRows.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key.startsWith('premi_') || key.startsWith('potongan_')) {
                    allFieldKeys.add(key);
                }
            });
        });

        // Merge both sources - prefer meta headers, add any extras from data
        const activePremi = [...new Set([
            ...dynPrem,
            ...Array.from(allFieldKeys).filter(k => k.startsWith('premi_'))
        ])];

        const activePot = [...new Set([
            ...dynPot,
            ...Array.from(allFieldKeys).filter(k => k.startsWith('potongan_'))
        ])];

        const excludedPendapatan = ['pendapatan_tidak_tetap', 'pendapatan_lainnya'];
        const allPendapatanKeys = new Set();
        employeeRows.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key.startsWith('pendapatan_') && !excludedPendapatan.includes(key)) {
                    allPendapatanKeys.add(key);
                }
            });
        });

        return {
            activePremi,
            activePot,
            activePendapatan: Array.from(allPendapatanKeys).sort()
        };
    }, [streamRows, stream.meta]);

    // Update active field states when stream data changes
    useEffect(() => {
        if (streamRows.length > 0) {
            setActivePremiFields(streamActiveFields.activePremi);
            setActivePotFields(streamActiveFields.activePot);
            setActivePendapatanFields(streamActiveFields.activePendapatan);

            const employeeRows = streamRows.filter(r => r.type === 'employee');
            setAllEmployeeNiks(employeeRows.map(r => r.nik).filter(Boolean));
            setSelection([]);
            setDataReady(true);
        }
    }, [streamRows, streamActiveFields]);

    // Fallback: if stream errors and we have no data, fall back to old fetch
    useEffect(() => {
        if (stream.error && !stream.gangs?.length && streamEnabled) {
            console.warn('[CustomPayrollTable] Stream failed, falling back to legacy fetch');
            setStreamEnabled(false);
            setError(null); // Clear stream error
        }
    }, [stream.error]);

    // When streaming is active, keep rows in sync with streamRows for edit mode compatibility
    // But don't overwrite rows if user has made edits (to preserve optimistic updates)
    useEffect(() => {
        const hasEdits = Object.keys(editedCells).length > 0 || Object.keys(editedKontanCells).length > 0;
        if (stream.gangs && stream.gangs.length > 0 && streamRows.length > 0) {
            if (!hasEdits) {
                setRows(streamRows);
            }
        }
    }, [streamRows]);

    // Use displayRows as the single source of truth for rendering
    // It merges stream data with edit overlays when needed
    const displayRows = useMemo(() => {
        if (stream.gangs && stream.gangs.length > 0 && rows.length > 0) {
            // Merge stream rows with any pending edits
            if (Object.keys(editedCells).length > 0 || Object.keys(editedKontanCells).length > 0) {
                return rows.map(row => {
                    if (row.type !== 'employee') return row;
                    const empCode = row.emp_code || row.nik;
                    const editKey = `${empCode}`;
                    const edit = editedCells[editKey];
                    const kontanEdit = editedKontanCells[editKey];
                    if (!edit && !kontanEdit) return row;
                    return {
                        ...row,
                        ...(edit ? { [edit.field]: edit.value } : {}),
                        ...(kontanEdit ? { pendapatan_kontanan: kontanEdit.value } : {})
                    };
                });
            }
            return rows;
        }
        if (stream.gangs && stream.gangs.length > 0) {
            return streamRows;
        }
        return rows;
    }, [stream.gangs, streamRows, rows, editedCells, editedKontanCells]);

    // Toggle handlers
    const toggleGroup = useCallback((group) => {
        if (group === 'PANEN') setHarvestExpanded(prev => !prev);
        if (group === 'ABSENSI') setAttendanceExpanded(prev => !prev);
        if (group === 'TUNJANGAN') setAllowanceExpanded(prev => !prev);
        if (group === 'PENDAPATAN LAINNYA') setOtherIncomeExpanded(prev => !prev);
        if (group === 'POTONGAN_BERSIH') setDeductionExpanded(prev => !prev); // Special key for convenience
        if (group === 'PAJAK') setIsTaxExpanded(prev => !prev);
    }, []);

    // Load preferences on mount
    useEffect(() => {
        const prefs = getTablePreferences();
        if (prefs.preferences?.cellColors) {
            setCellColors(prefs.preferences.cellColors);
        }
    }, []);

    // Sync employee codes when displayRows change (for select-all checkbox state only)
    useEffect(() => {
        const empCodeList = displayRows
            .filter(r => r.type === 'employee')
            .map(r => r.emp_code || r.nik)
            .filter(code => code);
        setAllEmployeeNiks(empCodeList);
        // NOTE: Don't call onSelectAllEmployees here - let user manually select employees
    }, [displayRows]);

    // Handle checkbox toggle
    const handleCheckboxChange = (nik) => {
        onToggleEmployeeSelection?.(nik);
    };

    // Handle select all checkbox
    const handleSelectAll = (e) => {
        if (!onSelectAllEmployees) return;
        if (e.target.checked) {
            // Select all employees
            onSelectAllEmployees(allEmployeeNiks);
        } else {
            // Deselect all - pass empty array directly instead of toggling each one
            onSelectAllEmployees([]);
        }
    };

    useEffect(() => {
        fetch('/tunjangan/rates?category=JABATAN')
            .then(res => res.json())
            .then(json => {
                if (json.success) setTunjanganRates(json.data);
            })
            .catch(console.error);
    }, []);

    const handleAddColumn = (groupLabel) => {
        const name = window.prompt(`Masukkan nama kolom baru untuk ${groupLabel}:\n(Contoh: PINJAMAN, BPJS, INSENTIF)`);
        if (!name || name.trim() === '') return;

        const upperName = name.trim().toUpperCase();
        let prefix = '';
        let category = '';

        if (groupLabel === 'PREMI') {
            prefix = 'premi_';
            category = 'premi';
        } else if (groupLabel === 'POTONGAN UPAH KOTOR') {
            prefix = 'koreksi_';
            category = 'potongan';
        } else if (groupLabel === 'POTONGAN UPAH BERSIH') {
            prefix = 'potongan_';
            category = 'potongan';
        }

        // Clean up title for backend/saving. Only alphanumeric and spaces
        const cleanName = upperName.replace(/[^A-Z0-9\s]/g, '').trim();
        const fieldName = `${prefix}${cleanName.toLowerCase().replace(/\s+/g, '_')}`;

        // Add to dynamic headers map
        setDynamicHeaders(prev => {
            const next = { ...prev };
            // For POTONGAN UPAH KOTOR, ensure it starts with KOREKSI so it goes to the right group
            const title = groupLabel === 'POTONGAN UPAH KOTOR' && !cleanName.startsWith('KOREKSI')
                ? `KOREKSI ${cleanName}`
                : cleanName;

            next[category] = { ...next[category], [title]: fieldName };
            return next;
        });

        // Add to active fields to make it visible
        if (category === 'premi') {
            setActivePremiFields(prev => [...prev, fieldName]);
        } else {
            setActivePotFields(prev => [...prev, fieldName]);
        }

        // Track the added column so we can persist it even if empty
        const firstEmp = displayRows.find(r => r.type === 'employee');
        if (firstEmp) {
            setAddedColumns(prev => [...prev, {
                nik: firstEmp.nik,
                gang_code: firstEmp.gang_code,
                type: category === 'premi' ? 'PREMI' : (groupLabel === 'POTONGAN UPAH KOTOR' ? 'POTONGAN_KOTOR' : 'POTONGAN_BERSIH'),
                name: cleanName
            }]);
        }
    };

    // Handle Manual Cell Edit
    const handleCellEdit = (nik, field, value, originalValue, gang_code, type, name) => {
        const key = `${nik}-${field}`;
        const numValue = value === '' ? 0 : parseFloat(value);

        if (isNaN(numValue)) return;

        setEditedCells(prev => ({
            ...prev,
            [key]: {
                nik,
                field,
                value: numValue,
                originalValue,
                gang_code,
                type,
                name
            }
        }));

        // Optimistically update the UI
        setRows(prevRows => prevRows.map(row => {
            if (row.nik === nik) {
                return { ...row, [field]: numValue };
            }
            return row;
        }));
    };

    // Handle PTKP Master Tax Edit (string-based, not numeric)
    const handlePtkpEdit = (row, newPtkpStatus) => {
        const empCode = row.emp_code || row.nik;
        const key = `${empCode}-status_ptkp`;
        const originalValue = row.status_ptkp;

        if (newPtkpStatus === originalValue) return;

        // Determine new TER category based on PTKP
        const newTer = (['TK/0', 'TK/1', 'K/0'].includes(newPtkpStatus)) ? 'TER A'
            : (newPtkpStatus === 'K/3') ? 'TER C' : 'TER B';

        setEditedCells(prev => ({
            ...prev,
            [key]: {
                nik: empCode,
                field: 'status_ptkp',
                value: newPtkpStatus,
                originalValue,
                gang_code: row.gang_code,
                type: 'MASTER_TAX',
                name: 'PTKP'
            }
        }));

        // Optimistically update PTKP and TER in the UI
        setRows(prevRows => prevRows.map(r => {
            if ((r.emp_code || r.nik) === empCode) {
                return { ...r, status_ptkp: newPtkpStatus, kategori_ter: newTer };
            }
            return r;
        }));
    };

    // Save Manual Edits (excludes kontan - kontan has its own save)
    const handleSaveEdits = async () => {
        const editsArray = Object.values(editedCells);

        // Include new columns that act as empty placeholders
        const pendingColumns = addedColumns.filter(newCol =>
            !editsArray.some(e => e.name === newCol.name && e.type === newCol.type)
        );

        for (const pending of pendingColumns) {
            editsArray.push({
                ...pending,
                value: 0,
                remarks: 'INIT_COLUMN - Kolom ditambahkan tanpa nilai'
            });
        }

        if (editsArray.length === 0) {
            setAddedColumns([]);
            onRefresh?.();
            return;
        }

        setIsSavingEdits(true);
        try {
            let successCount = 0;

            // Separate MASTER_TAX edits from normal numeric edits
            const masterTaxEdits = editsArray.filter(e => e.type === 'MASTER_TAX');
            const normalEdits = editsArray.filter(e => e.type !== 'MASTER_TAX');

            // --- Save MASTER_TAX edits (PTKP) via dedicated endpoint ---
            for (const edit of masterTaxEdits) {
                try {
                    const res = await fetch(`/tax-report/ptkp/${encodeURIComponent(edit.nik)}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            year: year,
                            ptkp_status: edit.value
                        })
                    });
                    const resJson = await res.json();
                    if (res.ok && resJson?.success) {
                        successCount++;
                    } else {
                        console.error('PTKP update failed:', resJson?.error);
                    }
                } catch (err) {
                    console.error('Error saving PTKP edit:', err);
                }
            }

            // --- Save normal numeric edits ---
            for (const edit of normalEdits) {
                const payload = {
                    period_month: month,
                    period_year: year,
                    emp_code: edit.nik,
                    gang_code: edit.gang_code,
                    division_code: division,
                    adjustment_type: edit.type,
                    adjustment_name: edit.name,
                    amount: edit.value,
                    remarks: edit.remarks || `Edited via UI on ${new Date().toLocaleString()}`
                };

                let resOk = false;
                let resJson = null;

                if (isProdMode()) {
                    try {
                        resJson = await saveLockedManualEdit(token, payload);
                        resOk = true;
                    } catch (err) {
                        console.error("Prod Mode specific manual edit failed:", err);
                    }
                } else {
                    const res = await fetch('/payroll/manual-edit', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        resOk = true;
                        resJson = await res.json();
                    }
                }

                if (resOk && resJson?.success) {
                    successCount++;
                }
            }

            if (successCount > 0) {
                alert(`Berhasil menyimpan ${successCount} penyesuaian (kolom/nilai).`);
                setEditedCells({}); // Clear edits after successful save
                setAddedColumns([]);
                onRefresh?.(); // Reload to get fresh data with recalculated totals
            } else {
                alert('Gagal menyimpan perubahan. Silakan coba lagi.');
            }
        } catch (error) {
            console.error('Error saving edits:', error);
            alert('Terjadi kesalahan saat menyimpan perubahan: ' + error.message);
        } finally {
            setIsSavingEdits(false);
        }
    };

    // Save Kontan (Other Income) - separate from main edits
    const handleSaveKontan = async () => {
        const kontanEdits = Object.values(editedKontanCells);
        if (kontanEdits.length === 0) return;

        // Check for delete operations (amount = 0)
        const deleteRows = kontanEdits.filter(k => k.value === 0);
        const saveRows = kontanEdits.filter(k => k.value !== 0);

        if (deleteRows.length > 0) {
            const names = deleteRows.map(k => k.emp_code || k.nik).join(', ');
            const confirmed = window.confirm(
                `HAPUS KONTAN untuk ${deleteRows.length} karyawan?\n\n` +
                `Karyawan: ${names}\n\n` +
                `Nilai 0 berarti data KONTAN akan DIHAPUS dari database.\n` +
                `Tindakan ini TIDAK DAPAT DIBATALKAN!`
            );
            if (!confirmed) return;
        }

        setIsSavingKontan(true);
        try {
            let successCount = 0;
            let deleteCount = 0;
            for (const k of kontanEdits) {
                const payload = {
                    period_month: month,
                    period_year: year,
                    nik: k.nik,                    // Real NIK (KTP)
                    emp_code: k.emp_code,          // Emp code (B0065, etc.)
                    gang_code: k.gang_code,
                    division_code: division,
                    adjustment_type: 'PENDAPATAN_LAINNYA',
                    adjustment_name: 'KONTAN',
                    amount: k.value,
                    remarks: k.value === 0
                        ? `KONTAN DELETED via UI on ${new Date().toLocaleString()}`
                        : `KONTAN edited via UI on ${new Date().toLocaleString()}`
                };
                console.log(`[handleSaveKontan] Saving: nik=${k.nik}, emp_code=${k.emp_code}, gang=${k.gang_code}, amount=${k.value}, period=${month}/${year}`);

                let resOk = false;
                let resJson = null;

                if (isProdMode()) {
                    try {
                        const { saveLockedManualEdit } = await import('../services/lockedDivisionService');
                        if (k.value === 0) {
                            // Use EXPLICIT DELETE endpoint
                            const delPayload = {
                                nik: k.nik,
                                period_month: month,
                                period_year: year,
                                income_type: 'KONTAN'
                            };
                            const delRes = await fetch('/payroll/locked/income-delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify(delPayload)
                            });
                            resJson = await delRes.json();
                            resOk = delRes.ok;
                        } else {
                            resJson = await saveLockedManualEdit(token, payload);
                            resOk = true;
                        }
                    } catch (err) {
                        console.error("Prod Mode kontan save failed:", err);
                    }
                } else {
                    let res;
                    if (k.value === 0) {
                         const delPayload = {
                            nik: k.nik,
                            period_month: month,
                            period_year: year,
                            income_type: 'KONTAN'
                        };
                        res = await fetch('/payroll/locked/income-delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify(delPayload)
                        });
                    } else {
                        res = await fetch('/payroll/manual-edit', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });
                    }
                    if (res.ok) {
                        resOk = true;
                        resJson = await res.json();
                    }
                }

                if (resOk && resJson?.success) {
                    successCount++;
                    if (k.value === 0) deleteCount++;
                }
            }

            if (successCount > 0) {
                console.log(`[handleSaveKontan] SUCCESS: ${successCount} KONTAN values saved, triggering refresh`);
                if (deleteCount > 0) {
                    alert(`Berhasil menghapus ${deleteCount} data KONTAN.\nBerhasil menyimpan ${saveRows.length} nilai KONTAN.`);
                } else {
                    alert(`Berhasil menyimpan ${successCount} nilai KONTAN.`);
                }
                setEditedKontanCells({});
                onRefresh?.();
            } else {
                alert('Gagal menyimpan KONTAN. Silakan coba lagi.');
            }
        } catch (error) {
            console.error('Error saving kontan:', error);
            alert('Terjadi kesalahan saat menyimpan KONTAN: ' + error.message);
        } finally {
            setIsSavingKontan(false);
        }
    };

    // --- DATA FETCHING ---
    const [savingJabatan, setSavingJabatan] = useState({});
    const handleJobTitleChange = async (empCode, newTitle) => {
        // Optimistic update — match by emp_code (the actual key used in employee_estate table)
        setRows(prev => prev.map(r => r.emp_code === empCode ? { ...r, jabatan_estate: newTitle } : r));
        setSavingJabatan(prev => ({ ...prev, [empCode]: 'saving' }));
        try {
            const res = await fetch('/employee-estate/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ empCode, jobTitle: newTitle })
            });
            if (!res.ok) throw new Error('Failed to save');
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            setSavingJabatan(prev => ({ ...prev, [empCode]: 'saved' }));
            setTimeout(() => setSavingJabatan(prev => { const n = { ...prev }; delete n[empCode]; return n; }), 2000);
        } catch (e) {
            console.error(e);
            setSavingJabatan(prev => ({ ...prev, [empCode]: 'error' }));
            alert('Gagal menyimpan jabatan: ' + e.message);
        }
    };

    const handleBulkSave = async () => {
        if (!confirm('Simpan/Seed semua jabatan yang tampil ke database?')) return;
        setLoading(true);
        try {
            const employees = displayRows.filter(r => r.type === 'employee');
            const payload = employees.map(r => ({
                empcode: r.nik,
                employee_name: r.nama,
                gang: r.gang_code,
                divisi_id: division,
                jabatan: r.jabatan_estate || 'Karyawan'
            }));

            const res = await fetch('/employee-estate/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ jobs: payload })
            });

            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();

            if (json.success) {
                alert(`Berhasil menyimpan ${json.count} data jabatan.`);
            } else {
                throw new Error(json.error);
            }
        } catch (e) {
            console.error(e);
            alert('Gagal seed data: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * processRawData: Transform raw API data → display rows with PROGRESSIVE rendering.
     * Shows data gang-by-gang to avoid blocking the UI thread.
     * No caching - direct display with progressive updates.
     */
    const processRawData = useCallback(async (data, currentGangCode, currentGangPrefix) => {
        console.log('[CustomPayrollTable] 📥 processRawData called:', {
            hasData: !!data,
            dataKeys: data ? Object.keys(data) : [],
            gangsCount: data?.gangs?.length,
            employeesCount: data?.gangs?.reduce((sum, g) => sum + (g.employees?.length || 0), 0),
            currentGangCode,
            currentGangPrefix
        });

        if (!data) {
            console.warn('[CustomPayrollTable] ⚠️ processRawData: data is null/undefined');
            setDataReady(true);
            setLoadingProgress({ stage: 'complete', message: '', totalGangs: 0, processedGangs: 0, totalEmployees: 0, processedEmployees: 0 });
            return;
        }

        try {
            // Step 1: Process headers immediately (fast)
            setLoadingProgress({
                stage: 'processing',
                message: 'Memproses header kolom...',
                totalGangs: data.gangs?.length || 0,
                processedGangs: 0,
                totalEmployees: data.gangs?.reduce((sum, g) => sum + (g.employees?.length || 0), 0) || 0,
                processedEmployees: 0
            });

            const dynPot = data.dynamic_potongan_headers || [];
            const dynPrem = data.dynamic_premi_headers || [];
            const potTitleMap = data.potongan_title_map || {};
            const premTitleMap = data.premi_title_map || {};

            const premWithTitles = {};
            dynPrem.forEach(field => {
                const title = premTitleMap[field] || field;
                premWithTitles[title] = field;
            });

            const potWithTitles = {};
            dynPot.forEach(field => {
                const title = potTitleMap[field] || field;
                potWithTitles[title] = field;
            });

            setDynamicHeaders({ premi: premWithTitles, potongan: potWithTitles });

            // Step 2: Flatten data
            setLoadingProgress(prev => ({ ...prev, message: 'Meratakan data karyawan...' }));
            let flatRows = PayrollAggregator.flattenData(data, potWithTitles);

            // --- CLIENT-SIDE FILTERING ---
            if (currentGangPrefix) {
                flatRows = flatRows.filter(r => {
                    const asist = getAsistensiLocal(r.gang_code);
                    return asist === currentGangPrefix;
                });
            }

            if (currentGangCode && currentGangCode !== 'ALL') {
                flatRows = flatRows.filter(r => r.gang_code === currentGangCode);
            }

            // Step 3: Build gang groups
            setLoadingProgress(prev => ({ ...prev, message: 'Mengelompokkan data per gang...' }));
            const gangsMap = {};
            flatRows.forEach(row => {
                const g = row.gang_code;
                if (!gangsMap[g]) gangsMap[g] = [];
                gangsMap[g].push(row);
            });

            const gangKeys = Object.keys(gangsMap).sort();
            const totalEmployees = flatRows.length;
            
            // Build backend gang totals map
            const backendGangTotalsMap = {};
            if (data.gangs) {
                data.gangs.forEach(gang => {
                    if (gang.gang_totals) {
                        backendGangTotalsMap[gang.gang_code] = gang.gang_totals;
                    }
                });
            }

            // Step 4: Progressive rendering - gang by gang
            setLoadingProgress({
                stage: 'rendering',
                message: `Memproses ${gangKeys.length} gang...`,
                totalGangs: gangKeys.length,
                processedGangs: 0,
                totalEmployees,
                processedEmployees: 0
            });

            const processedRows = [];
            let globalNo = 1;
            let processedCount = 0;

            // Process gangs in batches to avoid blocking UI
            for (let i = 0; i < gangKeys.length; i++) {
                const gCode = gangKeys[i];
                const employees = gangsMap[gCode];
                
                // Sort employees
                employees.sort((a, b) => {
                    const codeA = String(a.emp_code || a.nik || '').trim();
                    const codeB = String(b.emp_code || b.nik || '').trim();
                    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                });

                // Add gang header
                processedRows.push({ type: 'gang_header', gang_code: gCode, id: `HEADER_${gCode}` });
                
                // Add employees
                employees.forEach(emp => {
                    emp.no = globalNo++;
                    emp.type = 'employee';
                    emp.id = emp.new_nik || emp.nik || `EMP_${emp.no}`;
                    processedRows.push(emp);
                });

                // Calculate gang total
                let gangTotal = PayrollAggregator.calculateGangTotals(gCode, flatRows);
                if (backendGangTotalsMap[gCode] && !currentGangPrefix && (!currentGangCode || currentGangCode === 'ALL')) {
                    gangTotal = { ...gangTotal, ...backendGangTotalsMap[gCode] };
                }
                gangTotal.type = 'gang_total';
                gangTotal.id = `TOTAL_${gCode}`;
                gangTotal.gang_code = gCode;
                gangTotal.nama = `TOTAL GANG ${gCode}`;
                gangTotal.emp_code = `${employees.length} Kary.`;
                processedRows.push(gangTotal);

                processedCount += employees.length;

                // Update progress every 2 gangs or if it's the last one
                if (i % 2 === 1 || i === gangKeys.length - 1) {
                    setLoadingProgress({
                        stage: 'rendering',
                        message: `Memproses gang ${i + 1}/${gangKeys.length}: ${gCode}`,
                        totalGangs: gangKeys.length,
                        processedGangs: i + 1,
                        totalEmployees,
                        processedEmployees: processedCount
                    });

                    // Yield to browser to render current rows
                    if (i < gangKeys.length - 1) {
                        setRows([...processedRows]); // Update rows progressively
                        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms yield
                    }
                }
            }

            // Step 5: Final updates
            setLoadingProgress({
                stage: 'complete',
                message: 'Selesai!',
                totalGangs: gangKeys.length,
                processedGangs: gangKeys.length,
                totalEmployees,
                processedEmployees: processedCount
            });

            // Calculate grand total
            const frontendGt = PayrollAggregator.calculateGrandTotal(flatRows);
            frontendGt.emp_code = `${flatRows.length} Karyawan`;

            const backendGrandTotal = data.grand_total;
            if (backendGrandTotal && !currentGangPrefix && (!currentGangCode || currentGangCode === 'ALL')) {
                setGrandTotal({ ...frontendGt, ...backendGrandTotal });
            } else {
                setGrandTotal(frontendGt);
            }

            // Set final rows (all processed)
            setRows(processedRows);
            setDataReady(true);

            // Determine active dynamic fields
            const employeeRows = processedRows.filter(r => r.type === 'employee');
            const activePremi = Object.entries(premWithTitles).filter(([, field]) =>
                employeeRows.some(row => {
                    const val = row[field];
                    return val !== null && val !== undefined && val !== 0 && val !== '';
                })
            ).map(([, field]) => field);
            setActivePremiFields(activePremi);

            const activePot = Object.entries(potWithTitles).filter(([, field]) =>
                employeeRows.some(row => {
                    const val = row[field];
                    return val !== null && val !== undefined && val !== 0 && val !== '';
                })
            ).map(([, field]) => field);
            setActivePotFields(activePot);

            // Discover dynamic pendapatan_* fields by scanning rows (not in headers map)
            // EXCLUDE: pendapatan_tidak_tetap (duplikat dari pendapatan_thr + pendapatan_kontan, tidak boleh tampil sebagai kolom)
            // EXCLUDE: pendapatan_lainnya (total, akan ditampilkan terpisah)
            // EXCLUDE: pendapatan_kontan (sudah punya kolom sendiri di UPAH KOTOR)
            const excludedPendapatan = ['pendapatan_tidak_tetap', 'pendapatan_lainnya', 'pendapatan_kontan'];
            const allPendapatanKeys = new Set();
            employeeRows.forEach(row => {
                Object.keys(row).forEach(key => {
                    if (key.startsWith('pendapatan_') && !excludedPendapatan.includes(key)) {
                        allPendapatanKeys.add(key);
                    }
                });
            });
            setActivePendapatanFields(Array.from(allPendapatanKeys).sort());

            setAllEmployeeNiks(employeeRows.map(r => r.nik).filter(Boolean));
            setSelection([]);

            console.log(`[CustomPayrollTable] ✅ Progressive rendering complete: ${gangKeys.length} gangs, ${processedCount} employees`);
        } catch (err) {
            console.error('[CustomPayrollTable] processRawData error:', err);
            setError(err.message);
            setLoadingProgress({ stage: 'complete', message: '', totalGangs: 0, processedGangs: 0, totalEmployees: 0, processedEmployees: 0 });
        }
    }, [division, month, year]);

    /**
     * fetchDivisionData: Fetches data directly from API.
     * No caching - always fresh from server.
     * Race condition: abort previous request when new one starts.
     */
    const abortControllerRef = useRef(null);
    const fetchDivisionData = useCallback(async () => {
        // Abort any in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        console.log('[CustomPayrollTable] 🔄 FETCH START:', { division, month, year, gangCode, gangPrefix });

        setLoading(true);
        setError('');
        setDataReady(false);
        setRows([]);
        setGrandTotal(null);
        setLoadingProgress({
            stage: 'fetching',
            message: 'Mengambil data dari server...',
            totalGangs: 0,
            processedGangs: 0,
            totalEmployees: 0,
            processedEmployees: 0
        });
        try {
            // Always fetch based on current filters. No client-side caching of full division.
            let data;
            if (isProdMode()) {
                // In production, we might still want to filter by gangPrefix if showing ALL gangs
                const shouldSendGangPrefix = !gangCode || gangCode === 'ALL';
                data = await getLockedRawTree(
                    token, division, month, year, false, // NEVER use history db
                    shouldSendGangPrefix ? (gangPrefix || null) : null
                );
            } else {
                const shouldSendGangPrefix = !gangCode || gangCode === 'ALL';
                const prefixParam = shouldSendGangPrefix && gangPrefix ? `&gang_prefix=${gangPrefix}` : '';      
                const historyParam = useHistoryDb ? `&use_history=true` : '';
                const gangCodeParam = gangCode && gangCode !== 'ALL' ? `&gang_code=${gangCode}` : '';
                const url = `/payroll/report/division-raw-tree?division_code=${division}&month=${month}&year=${year}${prefixParam}${historyParam}${gangCodeParam}`;
                console.log('[CustomPayrollTable] 📡 FETCH URL:', url);
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: controller.signal
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[CustomPayrollTable] ❌ HTTP Error:', response.status, errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                data = await response.json();
            }

            // Check if API returned an error
            if (data?.error) {
                throw new Error(data.error);
            }

            // Validate data structure
            if (!data || typeof data !== 'object') {
                console.error('[CustomPayrollTable] ❌ Invalid data structure:', data);
                throw new Error('Invalid data structure dari API atau Sesi kedaluwarsa');
            }

            onDataLoaded?.(data);
            processRawData(data, gangCode, gangPrefix);

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[CustomPayrollTable] ⚠️ Request aborted');
                return; // Silently ignore aborted requests
            }
            console.error('[CustomPayrollTable] ❌ Fetch error:', err);
            setError(err.message);
            setDataReady(true);
            setLoadingProgress({ stage: 'complete', message: '', totalGangs: 0, processedGangs: 0, totalEmployees: 0, processedEmployees: 0 });
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
                // Don't reset loadingProgress here - let it show complete state
            }
        }
    }, [division, month, year, gangCode, gangPrefix, token, useHistoryDb, gangLoading, processRawData, onDataLoaded]);

    // --- MAIN DATA EFFECT ---
    // When streaming is enabled: use SSE stream (handled by usePayrollStream hook)
    // When streaming is disabled: fallback to old fetch/process approach
    useEffect(() => {
        if (!month || !year || !division || !token || gangLoading) return;
        // Streaming is handled by usePayrollStream hook automatically
        // Only call fetchDivisionData when streaming is disabled (fallback mode)
        if (!streamEnabled) {
            fetchDivisionData();
        }
    }, [month, year, division, gangCode, gangPrefix, token, refreshTrigger, useHistoryDb, gangLoading, fetchDivisionData, streamEnabled]);

    // === COLUMN DEFINITIONS (Single Source of Truth) ===
    // Each column knows its header hierarchy: [level0, level1, level2, level3]
    // null means "merge with parent above"
    const columnDefs = useMemo(() => {
        const cols = [
            // Checkbox Column
            {
                field: 'checkbox',
                headers: ['', null, null, '✓'],
                w: 35,
                className: 'text-center sticky-col',
                left: 0,
                render: (row) => {
                    if (row.type !== 'employee') return null;
                    return (
                        <input
                            type="checkbox"
                            checked={Array.isArray(selectedEmployees) && selectedEmployees.includes(row.emp_code || row.nik)}
                            onChange={() => handleCheckboxChange(row.emp_code || row.nik)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                        />
                    );
                }
            },
            // IDENTITAS
            { field: 'no', headers: ['IDENTITAS', null, null, 'NO'], w: 35, className: 'text-center', left: 35 },
            { field: 'emp_code', headers: ['IDENTITAS', null, null, 'EMP CODE'], w: 75, className: 'text-center sticky-col', left: 35 },
            { field: 'nik', headers: ['IDENTITAS', null, null, 'NIK'], w: 55, className: 'text-center sticky-col', left: 110 },
            {
                field: 'nama',
                headers: ['IDENTITAS', null, null, 'NAMA'],
                w: 160,
                className: 'text-left sticky-col',
                left: 165,
                render: (row) => {
                    if (row.type !== 'employee') return row.nama || row.emp_code;
                    const koreksi = row.koreksi_hk || 0;
                    const nama = row.nama || row.emp_code || '-';
                    if (koreksi === 0) return nama;

                    const isKurang = koreksi < 0;
                    const warningColor = isKurang ? '#dc2626' : '#ea580c';
                    const warningBg = isKurang ? '#fef2f2' : '#fff7ed';
                    const warningBorder = isKurang ? '#fecaca' : '#fed7aa';
                    const warningLabel = isKurang ? '⚠️ KURANG JAM' : '🔴 SALAH SCAN';
                    const tooltipText = isKurang
                        ? `⚠️ Pembayaran Tidak Benar\nKoreksi HK: ${formatNumber(koreksi)}\nGP Aktual < GP Ideal`
                        : `🔴 Salah Scan / Jam Lebih\nKoreksi HK: +${formatNumber(koreksi)}\nGP Aktual > GP Ideal`;

                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nama}</span>
                            <span
                                title={tooltipText}
                                style={{
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    color: warningColor,
                                    backgroundColor: warningBg,
                                    border: `1px solid ${warningBorder}`,
                                    borderRadius: '3px',
                                    padding: '1px 3px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: '1.2',
                                    cursor: 'help',
                                    flexShrink: 0
                                }}
                            >
                                {warningLabel}
                            </span>
                        </div>
                    );
                }
            },

            // PAJAK [Conditionally Expanded]
            ...(isTaxExpanded ? [
                {
                    field: 'status_ptkp',
                    headers: ['PAJAK', '', null, 'PTKP'],
                    w: 80,
                    className: 'text-center',
                    render: (row) => {
                        if (isEditMode && row.type === 'employee') {
                            const empCode = row.emp_code || row.nik;
                            const editKey = `${empCode}-status_ptkp`;
                            const isEdited = !!editedCells[editKey];
                            const ptkpOptions = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3'];
                            return (
                                <select
                                    className={`edit-input ${isEdited ? 'cell-edited' : ''}`}
                                    value={row.status_ptkp || 'TK/0'}
                                    onChange={(e) => handlePtkpEdit(row, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: '11px', padding: '1px 2px', width: '100%', cursor: 'pointer' }}
                                >
                                    {ptkpOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            );
                        }
                        return row.status_ptkp || '-';
                    }
                },
                { field: 'kategori_ter', headers: ['PAJAK', '', null, 'TER'], w: 55, className: 'text-center' },
                { field: 'gaji_pokok_ideal', headers: ['PAJAK', '', null, 'GP IDEAL'], w: 85, className: 'text-right' },
                { field: 'gaji_pokok_dibayarkan', headers: ['PAJAK', '', null, 'GP BAYAR'], w: 85, className: 'text-right' },
                { field: 'koreksi_hk', headers: ['PAJAK', '', null, 'KOREKSI HK'], w: 85, className: 'text-right' },
                // Additional Tax Group Columns
                { field: 'astek_084', headers: ['PAJAK', '', null, 'ASTEK 0.84%'], w: 85, className: 'text-right' },
                { field: 'pot_bpjs_kesehatan_majikan', colId: 'pajak_bpjs_kes_maj', headers: ['PAJAK', '', null, 'BPJS KES 4%'], w: 85, className: 'text-right' },
                { field: 'beras_jumlah', colId: 'pajak_beras_jumlah', headers: ['PAJAK', '', null, 'TUNJ BERAS'], w: 85, className: 'text-right' },
                { field: 'jabatan_jumlah', colId: 'pajak_jabatan_jumlah', headers: ['PAJAK', '', null, 'TUNJ JABATAN'], w: 85, className: 'text-right' },
                { field: 'masa_kerja_jumlah', colId: 'pajak_masa_kerja', headers: ['PAJAK', '', null, 'MASA KERJA'], w: 85, className: 'text-right' },
                { field: 'lembur_jumlah', colId: 'pajak_lembur_jumlah', headers: ['PAJAK', '', null, 'LEMBUR'], w: 85, className: 'text-right' },
                { field: 'total_premi', colId: 'pajak_total_premi', headers: ['PAJAK', '', null, 'TOTAL PREMI'], w: 85, className: 'text-right' },
                {
                    field: 'pot_koreksi',
                    colId: 'pajak_pot_koreksi',
                    headers: ['PAJAK', '', null, 'KOREKSI'],
                    w: 85,
                    className: 'text-right',
                    render: (row) => {
                        const val = row.pot_koreksi || 0;
                        if (val === 0) return '-';
                        const colorStyle = val > 0 ? { color: '#dc2626', fontWeight: 'bold' } : {};
                        return (
                            <span style={colorStyle}>
                                {formatNumber(val)}
                            </span>
                        );
                    }
                },
                // PENDAPATAN LAINNYA TAXABLE (Dynamic) - THR, Bonus, Custom, etc that are taxable (included in penghasilan_bruto)
                ...activePendapatanFields.filter(f => f !== 'pendapatan_lainnya').map(field => {
                    const baseType = field.replace('pendapatan_', '');
                    const taxField = `taxable_pendapatan_${baseType}`;
                    const displayName = baseType.toUpperCase();
                    return {
                        field: taxField,
                        headers: ['PAJAK', 'PENDAPATAN LAINNYA', null, displayName],
                        w: 85,
                        className: 'text-right',
                        render: (row) => {
                            const val = Number(row[taxField] || row[field] || 0);
                            if (val === 0) return '-';
                            return formatNumber(val);
                        }
                    };
                }),
                { field: 'taxable_pendapatan_lainnya', headers: ['PAJAK', 'PENDAPATAN LAINNYA', null, 'TOTAL'], w: 85, className: 'text-right font-bold', render: (row) => {
                    const val = Number(row.taxable_pendapatan_lainnya || row.pendapatan_lainnya || 0);
                    if (val === 0) return '-';
                    return formatNumber(val);
                }},
                { field: 'penghasilan_bruto', headers: ['PAJAK', '', null, 'PENGHASILAN BRUTO'], w: 110, className: 'text-right font-bold' },
                {
                    field: 'tarif_pajak_ter',
                    headers: ['PAJAK', '', null, 'TARIF TER (%)'],
                    w: 80,
                    className: 'text-center',
                    render: (row) => {
                        const val = Number(row.tarif_pajak_ter) || 0;
                        if (val === 0) return '0%';
                        return `${val.toFixed(2)}%`;
                    }
                }
            ] : []),

            // PPH21 TER (Always Visible Summary)
            { field: 'pph21_ter', headers: isTaxExpanded ? ['PAJAK', '', null, 'PPH21 TER'] : ['PAJAK', null, null, 'PPH21 TER'], w: 95, className: 'text-right' },

            // Continue with other columns...
            // ABSENSI > KEHADIRAN
            { field: 'hari_kerja', headers: ['ABSENSI', 'KEHADIRAN', null, 'AN'], w: 40, className: 'text-center' },
            // ABSENSI > KETIDAKHADIRAN
            ...(isAttendanceExpanded ? [
                { field: 'cuti_tahunan_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'CUTI'], w: 45, className: 'text-center' },
                { field: 'cuti_sakit_haid_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'SAKIT+HAID'], w: 70, className: 'text-center' },
                { field: 'cuti_minggu_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'MINGGU'], w: 55, className: 'text-center' },
                { field: 'cuti_nasional_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'NASIONAL'], w: 60, className: 'text-center' },
            ] : []),
            // ABSENSI > JUMLAH HK
            { field: 'jumlah_hk', headers: ['ABSENSI', null, null, 'JUMLAH HK'], w: 60, className: 'text-center font-bold' },
            // ABSENSI > TOTAL JAM [NEW] - Marks employees with shortage hours (kurang jam)
            {
                field: 'total_jam_kerja',
                headers: ['ABSENSI', null, null, 'TOTAL JAM'],
                w: 80,
                className: 'text-center',
                render: (row) => {
                    // Check for excess hours first (salah scan)
                    if (row.has_excess && !row.has_shortage) {
                        const excessInfo = row.excess_details || [];
                        const excessCount = excessInfo.length;
                        const excessTotalHours = row.excess_total_hours || 0;

                        let tooltipText = `🔴 SALAH SCAN / JAM LEBIH\n`;
                        tooltipText += `Total Kelebihan: ${excessTotalHours.toFixed(1)} jam\n`;
                        tooltipText += `Jumlah Hari: ${excessCount} hari\n\n`;
                        tooltipText += `Rincian:\n`;
                        excessInfo.forEach((detail, idx) => {
                            tooltipText += `${idx + 1}. ${detail.date} (${detail.day_name})\n`;
                            tooltipText += `   Actual: ${detail.actual_hours} jam, Target: ${detail.target_hours} jam\n`;
                            tooltipText += `   Lebih: +${detail.excess_hours.toFixed(1)} jam\n`;
                        });

                        return (
                            <div
                                style={{
                                    backgroundColor: '#fff7ed',
                                    color: '#9a3412',
                                    fontWeight: 'bold',
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '11px',
                                    border: '2px solid #f97316',
                                    borderRadius: '4px',
                                    gap: '2px'
                                }}
                                title={tooltipText}
                            >
                                <span style={{ fontSize: '14px' }}>🔴</span>
                                <span>{row.total_jam_kerja}</span>
                                {excessTotalHours > 0 && (
                                    <span style={{ fontSize: '9px', color: '#7c2d12' }}>
                                        (+{excessTotalHours.toFixed(1)}j)
                                    </span>
                                )}
                            </div>
                        );
                    }

                    if (!row.has_shortage) {
                        return (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {row.total_jam_kerja}
                            </div>
                        );
                    }

                    // Build tooltip with detailed shortage info
                    const shortageInfo = row.shortage_details || [];
                    const shortageCount = shortageInfo.length;
                    const shortageTotalHours = row.shortage_total_hours || 0;

                    let tooltipText = `⚠️ KURANG JAM KERJA\n`;
                    tooltipText += `Total Selisih: ${shortageTotalHours.toFixed(1)} jam\n`;
                    tooltipText += `Jumlah Hari: ${shortageCount} hari\n\n`;
                    tooltipText += `Rincian:\n`;
                    shortageInfo.forEach((detail, idx) => {
                        tooltipText += `${idx + 1}. ${detail.date} (${detail.day_name})\n`;
                        tooltipText += `   Actual: ${detail.actual_hours} jam, Target: ${detail.target_hours} jam\n`;
                        tooltipText += `   Kurang: ${detail.shortage_hours.toFixed(1)} jam\n`;
                    });

                    return (
                        <div
                            style={{
                                backgroundColor: '#fecaca',
                                color: '#991b1b',
                                fontWeight: 'bold',
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                border: '2px solid #ef4444',
                                borderRadius: '4px',
                                animation: 'pulse-warning 2s infinite',
                                gap: '2px'
                            }}
                            title={tooltipText}
                        >
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <span>{row.total_jam_kerja}</span>
                            {shortageTotalHours > 0 && (
                                <span style={{ fontSize: '9px', color: '#7f1d1d' }}>
                                    (-{shortageTotalHours.toFixed(1)}j)
                                </span>
                            )}
                        </div>
                    );
                }
            },
        ];

        // PANEN (Harvest) - Collapsible
        // Default: Show ONLY Total Janjang
        // Expanded: Show Bunches Breakdown + Loose Fruit
        const showHarvestDetails = isHarvestExpanded;

        cols.push({
            field: 'bunches_total', headers: ['PANEN', 'BUNCHES', null, 'TOTAL JANJANG'], w: 90, className: 'text-right',
            // Add indicator to header if possible, but headers are strings here. Logic handled in header rendering.
            render: (row) => {
                const val = row.bunches_total || 0;
                if (val === 0) return '-';
                return formatNumber(val);
            }
        });

        if (showHarvestDetails) {
            cols.push({
                field: 'bunches_ripe', headers: ['PANEN', 'BUNCHES', null, 'MASAK'], w: 60, className: 'text-right', render: (row) => {
                    const val = row.bunches_ripe || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'bunches_underripe', headers: ['PANEN', 'BUNCHES', null, 'MENGKAL'], w: 60, className: 'text-right', render: (row) => {
                    const val = row.bunches_underripe || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'bunches_unripe', headers: ['PANEN', 'BUNCHES', null, 'MENTAH'], w: 60, className: 'text-right', render: (row) => {
                    const val = row.bunches_unripe || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'bunches_overripe', headers: ['PANEN', 'BUNCHES', null, 'LEWAT MASAK'], w: 75, className: 'text-right', render: (row) => {
                    const val = row.bunches_overripe || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'bunches_rotten', headers: ['PANEN', 'BUNCHES', null, 'BUSUK'], w: 55, className: 'text-right', render: (row) => {
                    const val = row.bunches_rotten || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'bunches_abnormal', headers: ['PANEN', 'BUNCHES', null, 'ABNORMAL'], w: 65, className: 'text-right', render: (row) => {
                    const val = row.bunches_abnormal || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'loose_fruit', headers: ['PANEN', 'BRONDOLAN', null, 'KG/QTY'], w: 70, className: 'text-right', render: (row) => {
                    const val = row.loose_fruit || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
            cols.push({
                field: 'bunches_transactions', headers: ['PANEN', 'BUNCHES', null, 'JML TRX'], w: 65, className: 'text-center', render: (row) => {
                    const val = row.bunches_transactions || 0;
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
        }

        // PENGGAJIAN
        cols.push({ field: 'gaji_pokok_ideal', headers: ['PENGGAJIAN', null, null, 'GP IDEAL'], w: 85, className: 'text-right' });
        cols.push({
            field: 'gaji_pokok_aktual',
            headers: ['PENGGAJIAN', null, null, 'GP AKTUAL'],
            w: 95,
            className: 'text-right',
            render: (row) => {
                const val = row.gaji_pokok_aktual || 0;
                if (val === 0) return '-';

                // Add warning if aktual > ideal for employees
                const ideal = row.gaji_pokok_ideal || 0;
                if (row.type === 'employee' && val > ideal) {
                    return (
                        <div
                            title={`⚠️ Gaji Tidak Benar: Aktual (${formatNumber(val)}) melebihi Ideal (${formatNumber(ideal)})`}
                            style={{
                                color: '#dc2626',
                                fontWeight: 'bold',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span style={{ fontSize: '11px' }}>⚠️</span>
                            <span>{formatNumber(val)}</span>
                        </div>
                    );
                }
                return formatNumber(val);
            }
        });
        cols.push({
            field: 'koreksi_hk',
            headers: ['PENGGAJIAN', null, null, 'KOREKSI HK'],
            w: 85,
            className: 'text-right',
            render: (row) => {
                const val = row.koreksi_hk;
                if (val === null || val === undefined || val === 0) return '-';
                const isKurang = val < 0;
                const color = isKurang ? '#dc2626' : '#ea580c';
                const label = isKurang ? 'Kurang Jam' : 'Salah Scan';
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color, fontWeight: 'bold' }}>
                            {isKurang ? '-' : '+'}{formatNumber(Math.abs(val))}
                        </span>
                        <span style={{ fontSize: '8px', color, opacity: 0.8 }}>
                            ({label})
                        </span>
                    </div>
                );
            }
        });

        // JABATAN [NEW]
        cols.push({
            field: 'jabatan_estate',
            headers: ['IDENTITAS', null, null, 'JABATAN'],
            w: 180,
            className: 'text-left p-0',
            render: (row) => {
                if (row.type !== 'employee') return row.jabatan_estate || '-';
                const status = savingJabatan[row.emp_code];
                const borderColor = status === 'saving' ? '#f59e0b' : status === 'saved' ? '#10b981' : status === 'error' ? '#ef4444' : 'transparent';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '100%', height: '100%' }}>
                        <select
                            value={row.jabatan_estate || ''}
                            onChange={(e) => handleJobTitleChange(row.emp_code, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                                flex: 1, padding: '0 4px', height: '100%', minHeight: '24px',
                                fontSize: '10px', border: `2px solid ${borderColor}`, borderRadius: '3px',
                                backgroundColor: 'transparent', cursor: 'pointer', outline: 'none',
                                transition: 'border-color 0.3s'
                            }}
                        >
                            <option value="">-- Pilih Jabatan --</option>
                            <option value="karyawan panen">Karyawan Panen</option>
                            <option value="karyawan perawatan">Karyawan Perawatan</option>
                            <option value="karyawan">Karyawan</option>
                            <option value="mandor panen">Mandor Panen</option>
                            <option value="mandor perawatan">Mandor Perawatan</option>
                            <option value="kerani buah">Kerani Buah</option>
                            <option value="kerani kantor">Kerani Kantor</option>
                            <option value="operator">Operator</option>
                            <option value="helper">Helper</option>
                        </select>
                        {status === 'saving' && <span style={{ fontSize: '10px' }} title="Menyimpan...">⏳</span>}
                        {status === 'saved' && <span style={{ fontSize: '10px' }} title="Tersimpan!">✅</span>}
                        {status === 'error' && <span style={{ fontSize: '10px' }} title="Gagal simpan!">❌</span>}
                    </div>
                );
            }
        });

        // TUNJANGAN - Simplified
        // Show Rates ONLY if expanded
        const showAllowanceRates = isAllowanceExpanded;

        // TUNJANGAN > BERAS
        if (showAllowanceRates) {
            cols.push({ field: 'beras_rate', headers: ['TUNJANGAN', 'BERAS', null, 'RATE'], w: 60, className: 'text-right' });
        }
        cols.push({ field: 'beras_jumlah', headers: ['TUNJANGAN', 'BERAS', null, 'JUMLAH'], w: 80, className: 'text-right' });

        // TUNJANGAN > JABATAN (This is allowance amount, not title)
        if (showAllowanceRates) {
            cols.push({
                field: 'jabatan_rate',
                headers: ['TUNJANGAN', 'TUNJ. JABATAN', null, 'RATE'],
                w: 60,
                className: 'text-right',
                render: (row) => formatNumber(row.jabatan_rate)
            });
        }
        cols.push({
            field: 'jabatan_jumlah',
            headers: ['TUNJANGAN', 'TUNJ. JABATAN', null, 'JUMLAH'],
            w: 80,
            className: 'text-right',
            render: (row) => formatNumber(row.jabatan_jumlah)
        });

        // TUNJANGAN > MASA KERJA (Always show Lama? or hide? "hanya menampilkan jumlah tanpa rate". Lama is not rate. Keep it for context.)
        cols.push({ field: 'masa_kerja_tahun', headers: ['TUNJANGAN', 'MASA KERJA', null, 'LAMA'], w: 45, className: 'text-center' });
        cols.push({ field: 'masa_kerja_jumlah', headers: ['TUNJANGAN', 'MASA KERJA', null, 'JUMLAH'], w: 80, className: 'text-right' });

        // TUNJANGAN > LEMBUR (Keep Jam + Jumlah)
        cols.push({ field: 'lembur_jam', headers: ['TUNJANGAN', 'LEMBUR', null, 'JAM'], w: 45, className: 'text-center' });
        cols.push({ field: 'lembur_jumlah', headers: ['TUNJANGAN', 'LEMBUR', null, 'JUMLAH'], w: 80, className: 'text-right' });

        // TUNJANGAN > TOTAL (Always show)
        cols.push({ field: 'total_tunjangan', headers: ['TUNJANGAN', null, null, 'TOTAL TUNJANGAN'], w: 95, className: 'text-right font-bold' });

        // PENDAPATAN LAINNYA - THR, Bonus, Custom (Dipindahkan ke section POTONGAN UPAH BERSIH)

        // PREMI - Static BRONDOL column (from separate query, always show if has values)
        // BRONDOL is not in dynamic_premi_headers because it comes from brondol_data query
        cols.push({ field: 'premi_brondol', headers: ['PREMI', null, null, 'BRONDOL'], w: 80, className: 'text-right' });

        // PREMI (dynamic) - only show if has values in current gang
        // Filter out 'brondol' - it's already rendered as a static column above
        Object.entries(dynamicHeaders.premi)
            .filter(([label, field]) => {
                if (field === 'brondol') return false; // Already rendered as static 'premi_brondol' column
                return activePremiFields.includes(field) || isEditMode;
            })
            .forEach(([label, field]) => {
                const displayName = label.replace('PREMI ', '');
                cols.push({
                    field,
                    headers: ['PREMI', null, null, displayName],
                    w: 90,
                    className: 'text-right',
                    render: (row) => {
                        const val = row[field] || 0;
                        // PREMI columns are NOT editable in edit mode - read-only
                        if (val === 0) return '-';
                        return formatNumber(val);
                    }
                });
            });
        cols.push({ field: 'total_premi', headers: ['PREMI', null, null, 'TOTAL PREMI'], w: 95, className: 'text-right font-bold' });

        // PENDAPATAN LAINNYA (Dynamic) - (Tampil sebagai PENAMBAHAN di UPAH KOTOR)
        // EXCLUDE: pendapatan_lainnya (total), pendapatan_kontan (kolom terpisah), pendapatan_tidak_tetap (duplikat)
        const excludedPendapatanCols = ['pendapatan_lainnya', 'pendapatan_kontan', 'pendapatan_tidak_tetap'];
        activePendapatanFields.forEach(field => {
            if (excludedPendapatanCols.includes(field)) return;
            const displayName = field.replace('pendapatan_', '').toUpperCase() + ' (+)';
            cols.push({
                field,
                headers: ['UPAH KOTOR', 'PENDAPATAN LAINNYA', null, displayName],
                w: 85,
                className: 'text-right',
                render: (row) => {
                    const val = Number(row[field] || 0);
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });
        });

        // KONTAN - Other income column (always visible, editable only in edit mode)
        cols.push({
            field: 'pendapatan_kontan',
            headers: ['UPAH KOTOR', 'PENDAPATAN LAINNYA', null, 'KONTAN (+)'],
            w: 90,
            className: 'text-right',
            render: (row) => {
                const val = Number(row.pendapatan_kontan || 0);
                // Prefer real NIK (13+ digit KTP) over emp_code for storage
                const isRealNik = (row.nik || '').length >= 13;
                const realNik = isRealNik ? row.nik : null;
                const empCode = row.emp_code || row.nik;
                const editKey = `${empCode}-pendapatan_kontan`;
                const cellEdit = editedKontanCells[editKey];
                const displayVal = cellEdit ? cellEdit.value : val;
                const isEdited = !!cellEdit;

                // Only editable when edit mode is ON
                if (isEditMode && row.type === 'employee') {
                    // Check if this row has a pending delete (value explicitly set to 0)
                    const hasPendingDelete = cellEdit && cellEdit.value === 0;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input
                                type="number"
                                className={`edit-input ${isEdited ? 'cell-edited' : ''} ${hasPendingDelete ? 'cell-delete' : ''}`}
                                value={displayVal}
                                onChange={(e) => {
                                    const rawVal = e.target.value;
                                    // Allow empty string (treat as 0 = delete)
                                    if (rawVal === '') {
                                        setEditedKontanCells(prev => ({
                                            ...prev,
                                            [editKey]: {
                                                nik: realNik || row.emp_code,
                                                emp_code: row.emp_code,
                                                value: 0,
                                                originalValue: val,
                                                gang_code: row.gang_code
                                            }
                                        }));
                                        setRows(prevRows => prevRows.map(r => {
                                            if ((r.emp_code || r.nik) === empCode) {
                                                return { ...r, pendapatan_kontan: 0 };
                                            }
                                            return r;
                                        }));
                                        return;
                                    }
                                    const numVal = parseFloat(rawVal);
                                    if (isNaN(numVal)) return;
                                    setEditedKontanCells(prev => ({
                                        ...prev,
                                        [editKey]: {
                                            nik: realNik || row.emp_code,
                                            emp_code: row.emp_code,
                                            value: numVal,
                                            originalValue: val,
                                            gang_code: row.gang_code
                                        }
                                    }));
                                    // Optimistically update UI
                                    setRows(prevRows => prevRows.map(r => {
                                        if ((r.emp_code || r.nik) === empCode) {
                                            return { ...r, pendapatan_kontan: numVal };
                                        }
                                        return r;
                                    }));
                                }}
                                placeholder="0"
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '65px' }}
                            />
                            {hasPendingDelete && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const confirmed = window.confirm(
                                            `HAPUS KONTAN untuk ${row.emp_name || empCode}?\n\nCatatan: Nilai 0 akan menghapus data KONTAN dari database.`
                                        );
                                        if (!confirmed) {
                                            // Cancel the delete - restore original value
                                            setEditedKontanCells(prev => {
                                                const updated = { ...prev };
                                                delete updated[editKey];
                                                return updated;
                                            });
                                            setRows(prevRows => prevRows.map(r => {
                                                if ((r.emp_code || r.nik) === empCode) {
                                                    return { ...r, pendapatan_kontan: val };
                                                }
                                                return r;
                                            }));
                                        }
                                    }}
                                    style={{
                                        background: '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        padding: '2px 5px',
                                        width: '18px',
                                        height: '18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="Klik untuk hapus (akan menghapus saat SIMPAN)"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    );
                }
                // Read-only display
                if (val === 0) return '-';
                return formatNumber(val);
            }
        });

        // POTONGAN UPAH KOTOR - KOREKSI columns (all variations)
        // Display each KOREKSI variation as a separate column
        const koreksiFields = Object.entries(dynamicHeaders.potongan)
            .filter(([label, field]) => field.toUpperCase().startsWith('KOREKSI') && (activePotFields.includes(field) || isEditMode)) // Show in edit mode
            .sort(([a], [b]) => (a || '').localeCompare(b || '')); // Sort alphabetically

        // If no KOREKSI variations found but koreksi data exists, show main column
        if (koreksiFields.length === 0 && !isEditMode) {
            cols.push({
                field: 'pot_koreksi',
                headers: ['POTONGAN UPAH KOTOR', null, null, 'KOREKSI'],
                w: 80,
                className: 'text-right'
            });
        } else {
            // Show each KOREKSI variation as separate column
            for (const [label, field] of koreksiFields) {
                // Clean up the label for display
                const displayLabel = label.replace(/^KOREKSI\s*/i, 'KOREKSI ') || label;
                cols.push({
                    field,
                    headers: ['POTONGAN UPAH KOTOR', null, null, displayLabel],
                    w: 90,
                    className: 'text-right',
                    render: (row) => {
                        const val = row[field] || 0;
                        if (isEditMode && row.type === 'employee') {
                            const editKey = `${row.nik}-${field}`;
                            const isEdited = !!editedCells[editKey];
                            return (
                                <input
                                    type="number"
                                    className={`edit-input ${isEdited ? 'cell-edited' : ''}`}
                                    value={val === 0 ? '' : val}
                                    onChange={(e) => handleCellEdit(row.nik, field, e.target.value, val, row.gang_code, 'POTONGAN_KOTOR', displayLabel)}
                                    placeholder="0"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            );
                        }
                        if (val === 0) return '-';
                        return formatNumber(val);
                    }
                });
            }
        }

        // Total Koreksi
        cols.push({ field: 'potongan_upah_kotor_total', headers: ['POTONGAN UPAH KOTOR', null, null, 'TOTAL KOREKSI'], w: 95, className: 'text-right font-bold' });

        // UPAH KOTOR (separate group, not child of POTONGAN UPAH KOTOR) - sync with kontan
        // Backend now includes total_pendapatan_lainnya in jumlah_upah_kotor
        cols.push({
            field: 'jumlah_upah_kotor',
            headers: ['UPAH KOTOR', '', null, 'JUMLAH'],
            w: 110,
            className: 'text-right font-bold',
            render: (row) => {
                const empCode = row.emp_code || row.nik;
                const kontanEdit = editedKontanCells[`${empCode}-pendapatan_kontan`];
                const kontanVal = kontanEdit ? kontanEdit.value : Number(row.pendapatan_kontan || 0);
                const baseKontan = Number(row.pendapatan_kontan || 0);
                // Backend already includes pendapatan_lainnya, just adjust for kontan
                const val = Number(row.jumlah_upah_kotor || 0) - baseKontan + (kontanVal || 0);
                if (val === 0) return '-';
                return formatNumber(val);
            }
        });

        // POTONGAN UPAH BERSIH - Collapsible
        // Default: Show ONLY Total Potongan
        const showDeductionDetails = isDeductionExpanded;

        if (showDeductionDetails) {
            // POTONGAN UPAH BERSIH > CARUMAN ASTEK
            cols.push({
                field: 'pot_astek',
                headers: ['POTONGAN UPAH BERSIH', 'CARUMAN ASTEK', null, 'PEKERJA'],
                w: 75,
                className: 'text-right',
                render: (row) => {
                    const val = row.pot_astek || 0;
                    if (val === 0) return '-';
                    const estimatedBase = val * 50; // 2% of base
                    return (
                        <div title={`Potongan Astek Pekerja (2%)\nEstimasi Dasar Perhitungan: 2% x Rp ${formatNumber(estimatedBase)}`} style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>
                            {formatNumber(val)}
                        </div>
                    );
                }
            });
            cols.push({
                field: 'pot_astek_maj',
                headers: ['POTONGAN UPAH BERSIH', 'CARUMAN ASTEK', null, 'MAJIKAN'],
                w: 75,
                className: 'text-right',
                render: (row) => {
                    const val = row.pot_astek_maj || 0;
                    if (val === 0) return '-';
                    return (
                        <div title="Potongan Astek Majikan (JHT 3.7%, JKK, JKM)" style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>
                            {formatNumber(val)}
                        </div>
                    );
                }
            });

            // POTONGAN UPAH BERSIH > POTONGAN BPJS > KESEHATAN
            cols.push({
                field: 'pot_bpjs_kesehatan_pekerja',
                headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'KESEHATAN', 'PEKERJA'],
                w: 75,
                className: 'text-right',
                render: (row) => {
                    const val = row.pot_bpjs_kesehatan_pekerja || 0;
                    if (val === 0) return '-';
                    const estimatedBase = val * 100; // 1% of base
                    return (
                        <div title={`Potongan BPJS Kesehatan Pekerja (1%)\nEstimasi Dasar Perhitungan: 1% x Rp ${formatNumber(estimatedBase)}`} style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>
                            {formatNumber(val)}
                        </div>
                    );
                }
            });
            cols.push({
                field: 'pot_bpjs_kesehatan_majikan',
                headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'KESEHATAN', 'MAJIKAN'],
                w: 75,
                className: 'text-right',
                render: (row) => {
                    const val = row.pot_bpjs_kesehatan_majikan || 0;
                    if (val === 0) return '-';
                    const estimatedBase = val * 25; // 4% of base
                    return (
                        <div title={`Potongan BPJS Kesehatan Majikan (4%)\nEstimasi Dasar Perhitungan: 4% x Rp ${formatNumber(estimatedBase)}`} style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>
                            {formatNumber(val)}
                        </div>
                    );
                }
            });
            // POTONGAN UPAH BERSIH > POTONGAN BPJS > PENSIUN
            cols.push({
                field: 'pot_bpjs_pensiun_pekerja',
                headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'PENSIUN', 'PEKERJA'],
                w: 75,
                className: 'text-right',
                render: (row) => {
                    const val = row.pot_bpjs_pensiun_pekerja || 0;
                    if (val === 0) return '-';
                    const estimatedBase = val * 100; // 1% of base
                    return (
                        <div title={`Potongan BPJS Pensiun Pekerja (1%)\nEstimasi Dasar Perhitungan: 1% x Rp ${formatNumber(estimatedBase)}`} style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>
                            {formatNumber(val)}
                        </div>
                    );
                }
            });
            cols.push({
                field: 'pot_bpjs_pensiun_majikan',
                headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'PENSIUN', 'MAJIKAN'],
                w: 75,
                className: 'text-right',
                render: (row) => {
                    const val = row.pot_bpjs_pensiun_majikan || 0;
                    if (val === 0) return '-';
                    const estimatedBase = val * 50; // 2% of base
                    return (
                        <div title={`Potongan BPJS Pensiun Majikan (2%)\nEstimasi Dasar Perhitungan: 2% x Rp ${formatNumber(estimatedBase)}`} style={{ cursor: 'help', borderBottom: '1px dotted #9ca3af', display: 'inline-block' }}>
                            {formatNumber(val)}
                        </div>
                    );
                }
            });
            // POTONGAN UPAH BERSIH > POTONGAN BPJS > JUMLAH
            cols.push({ field: 'pot_bpjs_pekerja_total', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', null, 'JUMLAH'], w: 80, className: 'text-right font-bold' });
            // Other deductions (Dipindahkan ke POTONGAN LAINNYA)
            cols.push({ field: 'pot_spsi', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN LAINNYA', null, 'IURAN SPSI'], w: 80, className: 'text-right' });
            cols.push({ field: 'pot_pph21', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN LAINNYA', null, 'POTONGAN PPH21 (-)'], w: 80, className: 'text-right' });

            // [NEW] PREMI PPH - This is an ADDITION (+), not a deduction
            // Display with + sign to indicate it's added to upah_bersih
            cols.push({
                field: 'premi_pph',
                headers: ['POTONGAN UPAH BERSIH', 'POTONGAN LAINNYA', null, 'PREMI PPH (+)'],
                w: 90,
                className: 'text-right cell-premi-pph',
                render: (row) => {
                    const val = row.premi_pph || 0;
                    if (val === 0) return '-';
                    // Show with a + sign and green color to indicate addition
                    return (
                        <span style={{ color: '#059669', fontWeight: 'bold' }}>
                            +{formatNumber(val)}
                        </span>
                    );
                }
            });

            // Dynamic Potongan Bersih - show POTONGAN variations, PREMI_PPH, and PREMI items from TaskDesc
            const potonganBersihFields = Object.entries(dynamicHeaders.potongan)
                .filter(([label, field]) => {
                    const upperLabel = label.toUpperCase();
                    const upperField = (field || '').toUpperCase();

                    // Exclude KOREKSI (shown in POTONGAN UPAH KOTOR)
                    if (upperLabel.startsWith('KOREKSI') || upperField.startsWith('KOREKSI')) return false;

                    // Exclude SPSI (static column already exists)
                    if (upperLabel.includes('SPSI') || upperField === 'SPSI') return false;

                    // Exclude PPH21 (static column already exists)
                    if (upperField === 'PPH21') return false;

                    // Exclude PREMI_PPH (static column already exists with + sign)
                    if (upperField === 'PREMI_PPH') return false;

                    // INCLUDE: POTONGAN X, and other dynamic items
                    return true;
                })
                .filter(([label, field]) => activePotFields.includes(field) || isEditMode)
                .sort(([a], [b]) => (a || '').localeCompare(b || ''));

            for (const [label, field] of potonganBersihFields) {
                // Clean up the label for display
                const displayLabel = (label || '').replace(/^(POTONGAN\s*|POT\s*)/i, '') || label;
                cols.push({
                    field,
                    headers: ['POTONGAN UPAH BERSIH', 'POTONGAN LAINNYA', null, displayLabel],
                    w: 90,
                    className: 'text-right',
                    render: (row) => {
                        const val = row[field] || 0;
                        if (isEditMode && row.type === 'employee') {
                            const editKey = `${row.nik}-${field}`;
                            const isEdited = !!editedCells[editKey];
                            return (
                                <input
                                    type="number"
                                    className={`edit-input ${isEdited ? 'cell-edited' : ''}`}
                                    value={val === 0 ? '' : val}
                                    onChange={(e) => handleCellEdit(row.nik, field, e.target.value, val, row.gang_code, 'POTONGAN_BERSIH', displayLabel)}
                                    placeholder="0"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            );
                        }
                        if (val === 0) return '-';
                        return formatNumber(val);
                    }
                });
            }

        }

        // PENDAPATAN LAINNYA (THR, Bonus, Custom, KONTAN) - shown BEFORE Total Potongan
        // This includes ALL other incomes that are added to gross pay and deducted in total_potongan
        const activePendapatan = activePendapatanFields.filter(f => f !== 'pendapatan_lainnya');
        if (activePendapatan.length > 0 || isEditMode) {
            // Individual income types (THR, Bonus, Custom, KONTAN)
            for (const field of activePendapatan) {
                const baseType = field.replace('pendapatan_', '');
                const displayName = baseType.toUpperCase() + ' (+)';
                cols.push({
                    field,
                    headers: ['PENDAPATAN LAINNYA', null, null, displayName],
                    w: 90,
                    className: 'text-right font-bold',
                    render: (row) => {
                        const val = Number(row[field] || 0);
                        if (val === 0) return '-';
                        return formatNumber(val);
                    }
                });
            }
            // Total Pendapatan Lainnya (summary)
            cols.push({
                field: 'total_pendapatan_lainnya',
                headers: ['PENDAPATAN LAINNYA', null, null, 'TOTAL LAINNYA (+)'],
                w: 100,
                className: 'text-right font-bold',
                render: (row) => {
                    const val = Number(row.total_pendapatan_lainnya || 0);
                    return formatNumber(val);
                }
            });
        }

        // Total Potongan Bersih (Always Shown) - sync with kontan edits
        // Now includes total_pendapatan_lainnya (deduction to balance with UPAH KOTOR)
        // Adjust Level 1 header to preserve colspan merging (use empty string when expanded)
        cols.push({
            field: 'total_potongan_bersih',
            headers: showDeductionDetails ? ['POTONGAN UPAH BERSIH', '', null, 'TOTAL POTONGAN'] : ['POTONGAN UPAH BERSIH', null, null, 'TOTAL POTONGAN'],
            w: 100,
            className: 'text-right font-bold cell-deduction',
            render: (row) => {
                const empCode = row.emp_code || row.nik;
                const kontanEdit = editedKontanCells[`${empCode}-pendapatan_kontan`];
                const kontanVal = kontanEdit ? kontanEdit.value : Number(row.pendapatan_kontan || 0);
                const baseKontan = Number(row.pendapatan_kontan || 0);
                const baseVal = Number(row.total_potongan_bersih || 0);
                const totalPendapatanLainnya = Number(row.total_pendapatan_lainnya || 0);
                // Total Potongan = base + pendapatan_lainnya - kontan adjustment
                const val = baseVal + totalPendapatanLainnya - baseKontan + (kontanVal || 0);
                if (val === 0) return '-';
                return formatNumber(val);
            }
        });

        // TOTAL UPAH (Summary group) - Upah Bersih
        // Note: Kontan adds to both UPAH KOTOR (+) and POTONGAN BERSIH (+) equally,
        // so upah_bersih stays the same. Use base value from backend.
        cols.push({
            field: 'upah_bersih',
            headers: ['UPAH BERSIH', null, null, 'JUMLAH'],
            w: 115,
            className: 'text-right font-bold cell-net-salary',
            render: (row) => {
                const val = Number(row.upah_bersih || 0);
                if (val === 0) return '-';
                return formatNumber(val);
            }
        });

        // Attach group to each column for body cell coloring
        cols.forEach(c => {
            c.group = getHeaderGroup(c.headers[0]);
        });

        return cols;
    }, [dynamicHeaders, activePremiFields, activePotFields, tunjanganMode, tunjanganRates, isTaxExpanded, isHarvestExpanded, isAttendanceExpanded, isAllowanceExpanded, isDeductionExpanded, isOtherIncomeExpanded, selectedEmployees, onToggleEmployeeSelection, savingJabatan, isEditMode, editedKontanCells]);

    // === EXPORT TO EXCEL HANDLER ===
    const handleExportToExcel = useCallback(async () => {
        if (rows.length === 0) {
            alert('Tidak ada data untuk di-export');
            return null;
        }
        try {
            const fileName = await exportPayrollToExcel(rows, columnDefs, grandTotal, {
                division,
                gangCode,
                month,
                year
            });
            return fileName;
        } catch (err) {
            console.error('Export error:', err);
            alert('Gagal export ke Excel: ' + err.message);
            return null;
        }
    }, [rows, columnDefs, grandTotal, division, gangCode, month, year]);

    // Expose export function to parent
    useEffect(() => {
        if (onExportReady) {
            // [FIX] Must wrap in arrow function because onExportReady is a useState setter (setExportHandler).
            // Passing a function directly to useState setter causes React to execute it (functional update).
            // We want to STORE the function, not execute it.
            onExportReady(() => handleExportToExcel);
        }
    }, [onExportReady, handleExportToExcel]);


    // Helper function to get header color style — uniform dark color for ALL headers
    const getHeaderStyle = useCallback(() => {
        return {
            backgroundColor: '#1a365d',
            color: 'white'
        };
    }, []);

    // Helper to get body cell inline style from cookie preferences
    const getCellGroupStyle = useCallback((group) => {
        if (!group || !cellColors[group]) return {};
        const colors = cellColors[group];
        return {
            backgroundColor: colors.bg,
            color: colors.text
        };
    }, [cellColors]);

    const headerRows = useMemo(() => {
        const numRows = 4;
        const numCols = columnDefs.length;

        // Create a grid to track which cells are occupied
        const grid = Array(numRows).fill(null).map(() => Array(numCols).fill(null));

        // Process each column's headers
        columnDefs.forEach((col, colIdx) => {
            const headers = col.headers;
            let rowStart = 0;

            for (let row = 0; row < numRows; row++) {
                const label = headers[row];
                if (label === null) {
                    // This cell should be merged with the one above
                    // Find the cell above that should extend down
                    continue;
                }

                // Find how many rows this cell should span
                let rowSpan = 1;
                for (let r = row + 1; r < numRows; r++) {
                    if (headers[r] === null) rowSpan++;
                    else break;
                }

                // Mark cells as occupied
                for (let r = row; r < row + rowSpan; r++) {
                    grid[r][colIdx] = { label, rowSpan, colSpan: 1, startRow: row, startCol: colIdx };
                }
                break; // Only process the first non-null header for this column at this level
            }

            // Now process remaining levels
            for (let row = 0; row < numRows; row++) {
                if (grid[row][colIdx] !== null) continue;

                const label = headers[row];
                if (label !== null) {
                    let rowSpan = 1;
                    for (let r = row + 1; r < numRows; r++) {
                        if (headers[r] === null) rowSpan++;
                        else break;
                    }
                    for (let r = row; r < row + rowSpan; r++) {
                        grid[r][colIdx] = { label, rowSpan, colSpan: 1, startRow: row, startCol: colIdx };
                    }
                }
            }
        });

        // Merge adjacent cells with same label in same row
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                const cell = grid[row][col];
                if (!cell || cell.merged) continue;

                // Look for adjacent cells with same label that started at same row
                let colspan = 1;
                for (let c = col + 1; c < numCols; c++) {
                    const nextCell = grid[row][c];
                    if (nextCell && nextCell.label === cell.label && nextCell.startRow === cell.startRow && nextCell.rowSpan === cell.rowSpan) {
                        colspan++;
                        nextCell.merged = true;
                    } else {
                        break;
                    }
                }
                cell.colSpan = colspan;
            }
        }

        // Build the header rows
        const result = [];
        for (let row = 0; row < numRows; row++) {
            const rowCells = [];
            for (let col = 0; col < numCols; col++) {
                const cell = grid[row][col];
                if (!cell) continue;
                if (cell.merged) continue;
                if (cell.startRow !== row) continue; // This cell started in a previous row

                // Get header group for color styling
                const headerGroup = getHeaderGroup(cell.label);
                const headerStyle = getHeaderStyle(cell.label, row);

                // Special handling for checkbox column header
                if (columnDefs[col].field === 'checkbox') {
                    rowCells.push({
                        label: 'checkbox',
                        colSpan: cell.colSpan,
                        rowSpan: cell.rowSpan,
                        isSticky: true,
                        left: columnDefs[col].left,
                        isCheckboxHeader: true,
                        headerGroup: null,
                        headerStyle: { backgroundColor: '#1a365d', color: 'white' }
                    });
                } else {
                    rowCells.push({
                        label: cell.label || '',
                        colSpan: cell.colSpan,
                        rowSpan: cell.rowSpan,
                        isSticky: columnDefs[col].left !== undefined,
                        left: columnDefs[col].left,
                        headerGroup,
                        headerStyle,
                        level: row
                    });
                }
            }
            result.push(rowCells);
        }

        return result;
    }, [columnDefs, allEmployeeNiks, getHeaderStyle, selectedEmployees]);

    // Selection Logic - supports Ctrl+Click for multi-select
    const handleMouseDown = (e, rowIndex, colIndex, rowId) => {
        const cellKey = `${rowIndex}-${colIndex}`;

        if (e.ctrlKey || e.metaKey) {
            // Ctrl+Click: Toggle this cell in selection
            setSelection(prev => {
                const exists = prev.some(s => s.r === rowIndex && s.c === colIndex);
                if (exists) {
                    return prev.filter(s => !(s.r === rowIndex && s.c === colIndex));
                } else {
                    return [...prev, { r: rowIndex, c: colIndex }];
                }
            });
        } else {
            // Normal click: Start new selection range
            setIsSelecting(true);
            setSelection([{ r: rowIndex, c: colIndex }]);
            setHighlightedRowId(rowId);
        }
    };

    const handleMouseOver = (rowIndex, colIndex) => {
        if (isSelecting && selection.length > 0) {
            // Extend selection range from first cell to current
            const start = selection[0];
            const newSelection = [];
            const minR = Math.min(start.r, rowIndex), maxR = Math.max(start.r, rowIndex);
            const minC = Math.min(start.c, colIndex), maxC = Math.max(start.c, colIndex);
            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    newSelection.push({ r, c });
                }
            }
            setSelection(newSelection);
        }
    };

    const handleMouseUp = () => { setIsSelecting(false); calculateSelectionStats(); };

    const calculateSelectionStats = useCallback(() => {
        if (!selection || selection.length === 0) { setSelectionStats(null); return; }
        const values = [];
        selection.forEach(({ r, c }) => {
            const row = rows[r];
            if (!row || row.type === 'gang_header') return;
            const col = columnDefs[c];
            if (col) {
                const val = parseFloat(row[col.field]);
                if (!isNaN(val)) values.push(val);
            }
        });
        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            setSelectionStats({ count: values.length, sum, avg: sum / values.length, min: Math.min(...values), max: Math.max(...values) });
        } else { setSelectionStats(null); }
    }, [selection, rows, columnDefs]);

    const isCellSelected = (r, c) => {
        return selection.some(s => s.r === r && s.c === c);
    };

    const handleContextMenu = (e, row) => {
        e.preventDefault();
        if (row.type !== 'employee') return;
        setContextMenu({
            x: e.clientX, y: e.clientY,
            options: [
                { label: '📋 Lihat Detail Activity', action: () => onViewEmployeeDetail?.(row) },
                { label: '👤 Lihat Profil HR (Manajemen)', action: () => onOpenHrProfile?.(row) },
                'separator',
                { label: 'Export Data', action: () => alert('Export not implemented') }
            ]
        });
    };

    if (loading) return (
        <LoadingScreen
            isLoading={true}
            message="Memuat Data Payroll..."
            gangCode={gangCode}
            month={month}
            year={year}
            steps={[
                { name: 'Mengambil data dari server', duration: 2000 },
                { name: 'Memproses data karyawan', duration: 2000 },
                { name: 'Menghitung total gang', duration: 1500 },
                { name: 'Menyiapkan tampilan', duration: 1500 }
            ]}
        />
    );

    // Show main table if we have stream data OR legacy data
    // This allows progressive rendering - table appears as soon as first gang arrives
    if (shouldShowTable) {
        // Continue to render table below
    }
    // Show "Belum Tersedia" ONLY when:
    // 1. Loading is complete (loading = false)
    // 2. Data has been fetched (dataReady = true)
    // 3. But no rows returned (displayRows.length = 0)
    // This means: data was fetched but genuinely empty, not still loading
    else if (!loading && dataReady && displayRows.length === 0) {
        const MONTHS_LABEL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        // Error state with retry button
        if (error) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: '100%', minHeight: '400px', padding: '40px',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '48px', textAlign: 'center',
                        border: '2px solid #fecaca', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                        maxWidth: '600px', width: '100%'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>❌</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#dc2626', margin: '0 0 8px' }}>
                            Gagal Memuat Data
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 20px' }}>
                            {error}
                        </p>
                        <div style={{
                            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px',
                            padding: '12px 16px', fontSize: '0.85rem', color: '#92400e',
                            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                            marginBottom: '20px'
                        }}>
                            <span>💡</span>
                            <span>Tekan tombol <strong>Refresh</strong> atau coba beberapa saat lagi.</span>
                        </div>
                        <button
                            onClick={() => {
                                console.log('[CustomPayrollTable] 🔄 Retry triggered');
                                onRefresh?.();
                            }}
                            style={{
                                padding: '10px 24px', background: '#dc2626', color: 'white',
                                border: 'none', borderRadius: '8px', cursor: 'pointer',
                                fontWeight: '700', fontSize: '0.95rem'
                            }}
                        >
                            🔄 Coba Lagi
                        </button>
                    </div>
                </div>
            );
        }

        // Data not available / not generated state
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', minHeight: '400px', padding: '40px',
                background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
            }}>
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '48px', textAlign: 'center',
                    border: '2px dashed #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    maxWidth: '600px', width: '100%'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📭</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', margin: '0 0 8px' }}>
                        Data Belum Tersedia
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 20px' }}>
                        Data daftar upah untuk <strong>{gangCode === 'ALL' ? 'Semua Gang' : gangCode}</strong>
                        {division && <span> di divisi <strong>{division}</strong></span>}
                        {' '}pada periode <strong>{MONTHS_LABEL[(month || 1) - 1]} {year}</strong> belum tersedia atau belum digenerate.
                    </p>
                    <div style={{
                        background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px',
                        padding: '12px 16px', fontSize: '0.85rem', color: '#92400e',
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                        marginBottom: '20px'
                    }}>
                        <span>💡</span>
                        <span>Pastikan data payroll sudah di-seed untuk periode ini. Coba gunakan tombol <strong>Refresh</strong> atau pilih periode/divisi lain.</span>
                    </div>
                    <button
                        onClick={() => {
                            console.log('[CustomPayrollTable] 🔄 Refresh button clicked');
                            onRefresh?.();
                        }}
                        style={{
                            padding: '10px 24px', background: '#1e3a8a', color: 'white',
                            border: 'none', borderRadius: '8px', cursor: 'pointer',
                            fontWeight: '700', fontSize: '0.95rem'
                        }}
                    >
                        🔄 Refresh / Muat Ulang
                    </button>
                </div>
            </div>
        );
    }

    const scale = fontSize / 100;
    const rowHeight = 28;

    return (
        <div className="payroll-table-container" style={{ fontSize: `${11 * scale}px` }} onMouseUp={handleMouseUp}>
            {/* Loading / Streaming Progress Bar - Sticky Header */}
            {(loading || (effectiveProgress?.stage && effectiveProgress.stage !== 'complete')) && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1001,
                    backgroundColor: '#ffffff',
                    borderBottom: '2px solid #e5e7eb',
                    padding: '12px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Top row: icon + message + stats */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    border: '3px solid #e5e7eb',
                                    borderTop: '3px solid #3b82f6',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                <div>
                                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                                        {effectiveProgress?.stage === 'connecting' ? 'Menghubungi server...' :
                                         effectiveProgress?.stage === 'querying' ? 'Memproses query database...' :
                                         effectiveProgress?.stage === 'streaming' ? 'Streaming data...' :
                                         effectiveProgress?.message || 'Memproses data...'}
                                    </span>
                                    {effectiveProgress?.stage === 'streaming' && streamEnabled && (
                                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                                            ⚡ Streaming aktif
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {effectiveProgress?.totalGangs > 0 && (
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                        {effectiveProgress.processedGangs}/{effectiveProgress.totalGangs} gang
                                        {' • '}
                                        {effectiveProgress.processedEmployees}/{effectiveProgress.totalEmployees} karyawan
                                    </span>
                                )}
                                {effectiveProgress?.bytesReceived > 0 && (
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                                        {formatBytes(effectiveProgress.bytesReceived)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '3px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: effectiveProgress?.totalGangs > 0
                                    ? `${(effectiveProgress.processedGangs / effectiveProgress.totalGangs) * 100}%`
                                    : '100%',
                                backgroundColor: effectiveProgress?.stage === 'querying' ? '#f59e0b' :
                                                effectiveProgress?.stage === 'streaming' ? '#10b981' :
                                                effectiveProgress?.stage === 'connecting' ? '#3b82f6' : '#10b981',
                                transition: 'width 0.3s ease',
                                borderRadius: '3px'
                            }} />
                        </div>

                        {/* Gang name indicator during streaming */}
                        {effectiveProgress?.stage === 'streaming' && stream.gangs?.length > 0 && (
                            <div style={{
                                marginTop: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Gang:</span>
                                {stream.gangs.slice(-Math.min(6, stream.gangs.length)).map((g, i) => (
                                    <span key={g.gang_code} style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569',
                                        fontWeight: 500
                                    }}>
                                        {g.gang_code} ({g.employees?.length || 0})
                                    </span>
                                ))}
                                {stream.gangs.length > 6 && (
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        +{stream.gangs.length - 6} gang lagi...
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Mode Save Banner */}
            {isEditMode && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: '#fffbeb',
                    border: '1px solid #f59e0b',
                    padding: '10px 20px',
                    borderRadius: '0 0 8px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                    color: '#b45309',
                    fontWeight: 600,
                    fontSize: '13px',
                    flexWrap: 'wrap'
                }}>
                    {/* Kontan Save Button - Always visible in edit mode */}
                    <button
                        onClick={handleSaveKontan}
                        disabled={isSavingKontan || Object.keys(editedKontanCells).length === 0}
                        style={{
                            backgroundColor: Object.keys(editedKontanCells).length > 0 ? '#10b981' : '#94a3b8',
                            color: 'white',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: Object.keys(editedKontanCells).length > 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            fontSize: '12px'
                        }}
                        title="Simpan semua nilai KONTAN. Nilai 0 = HAPUS data."
                    >
                        {isSavingKontan ? '💾 Menyimpan...' : (() => {
                            const editCount = Object.keys(editedKontanCells).length;
                            const deleteCount = Object.values(editedKontanCells).filter(k => k.value === 0).length;
                            if (editCount === 0) return '💾 SIMPAN KONTAN';
                            if (deleteCount > 0) return `💾 SIMPAN KONTAN (${editCount} | ${deleteCount} HAPUS)`;
                            return `💾 SIMPAN KONTAN (${editCount})`;
                        })()}
                    </button>

                    {/* Separator */}
                    <div style={{ width: '1px', height: '24px', backgroundColor: '#f59e0b', opacity: 0.5 }} />

                    {/* Other edits save */}
                    {(Object.keys(editedCells).length > 0 || addedColumns.length > 0) && (
                        <>
                            <span>⚠️ {Object.keys(editedCells).length + addedColumns.length} penyesuaian (kolom/nilai) belum disimpan</span>
                            <button
                                onClick={handleSaveEdits}
                                disabled={isSavingEdits}
                                style={{
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {isSavingEdits ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Batal semua perubahan dan penambahan kolom?')) {
                                        setEditedCells({});
                                        setAddedColumns([]);
                                        setEditedKontanCells({});
                                        onRefresh?.();
                                    }
                                }}
                                disabled={isSavingEdits}
                                style={{
                                    backgroundColor: 'transparent',
                                    color: '#b45309',
                                    border: '1px solid #f59e0b',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Batal Semua
                            </button>
                        </>
                    )}

                    {/* When nothing to save */}
                    {Object.keys(editedCells).length === 0 && addedColumns.length === 0 && Object.keys(editedKontanCells).length === 0 && (
                        <span style={{ color: '#10b981' }}>✓ Mode Edit Aktif - Edit nilai di kolom atau klik 💾 SIMPAN KONTAN</span>
                    )}
                </div>
            )}

            <table className="payroll-table" ref={tableRef}>
                <thead>
                    {headerRows.map((hRow, rIdx) => (
                        <tr key={`hr-${rIdx}`}>
                            {hRow.map((cell, cIdx) => (
                                <th
                                    key={`hc-${rIdx}-${cIdx}`}
                                    colSpan={cell.colSpan}
                                    rowSpan={cell.rowSpan}
                                    className={`sticky-header ${cell.isSticky ? 'sticky-corner' : ''} ${cell.headerGroup ? `header-group-${cell.headerGroup.toLowerCase().replace(/\s+/g, '-')}` : ''}`}
                                    style={{
                                        top: rIdx * rowHeight,
                                        left: cell.left,
                                        height: cell.rowSpan * rowHeight,
                                        ...cell.headerStyle
                                    }}
                                >
                                    {cell.label === 'JABATAN' ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <span>JABATAN</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleBulkSave(); }}
                                                className="text-xs bg-gray-200 hover:bg-gray-300 rounded px-1 pb-0.5 border border-gray-400"
                                                title="Simpan semua jabatan ke database"
                                            >
                                                💾
                                            </button>
                                        </div>
                                    ) : ['PAJAK', 'PANEN', 'ABSENSI', 'TUNJANGAN', 'PENDAPATAN LAINNYA', 'POTONGAN UPAH BERSIH'].includes(cell.label) ? (
                                        (() => {
                                            const isExpanded = cell.label === 'PAJAK' ? isTaxExpanded :
                                                cell.label === 'PANEN' ? isHarvestExpanded :
                                                    cell.label === 'ABSENSI' ? isAttendanceExpanded :
                                                        cell.label === 'TUNJANGAN' ? isAllowanceExpanded :
                                                            cell.label === 'PENDAPATAN LAINNYA' ? isOtherIncomeExpanded :
                                                                cell.label === 'POTONGAN UPAH BERSIH' ? isDeductionExpanded : false;

                                            return (
                                                <div 
                                                    className={`header-toggle-container ${isExpanded ? 'is-expanded' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const groupKey = cell.label === 'POTONGAN UPAH BERSIH' ? 'POTONGAN_BERSIH' : cell.label;
                                                        toggleGroup(groupKey);
                                                    }}
                                                    title={isExpanded ? "Klik untuk sembunyikan detail" : "Klik untuk lihat detail"}
                                                >
                                                    <span className="header-label-text">{cell.label}</span>
                                                    
                                                    <span className="header-toggle-icon">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>

                                                    {cell.label === 'PENDAPATAN LAINNYA' && (
                                                        <span className="kontan-badge">KONTAN</span>
                                                    )}

                                                    {isEditMode && cell.label === 'POTONGAN UPAH BERSIH' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAddColumn(cell.label); }}
                                                            className="header-add-btn"
                                                            title={`Tambah kolom ${cell.label} baru`}
                                                        >
                                                            +
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ) : cell.label === '%TOGGLE_JUMLAH%' ? (
                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                            <span>JUMLAH</span>
                                            <div
                                                className={`cursor-pointer select-none text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${tunjanganMode === 'CALC' ? 'bg-green-100 text-green-700 font-bold' : 'bg-transparent text-gray-400 hover:bg-gray-100'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTunjanganMode(prev => prev === 'DB' ? 'CALC' : 'DB');
                                                }}
                                                title="Switch Mode: DB Actual vs Calculated Guidance"
                                            >
                                                {tunjanganMode === 'CALC' ? 'GUIDE' : 'DB'}
                                            </div>
                                        </div>
                                    ) : cell.isCheckboxHeader ? (
                                        <div className="flex items-center justify-center h-full w-full">
                                            <input
                                                type="checkbox"
                                                checked={Array.isArray(selectedEmployees) && Array.isArray(allEmployeeNiks) && allEmployeeNiks.length > 0 && selectedEmployees.length === allEmployeeNiks.length}
                                                ref={input => {
                                                    if (input && Array.isArray(selectedEmployees) && Array.isArray(allEmployeeNiks)) {
                                                        input.indeterminate = selectedEmployees.length > 0 && selectedEmployees.length < allEmployeeNiks.length;
                                                    }
                                                }}
                                                onChange={(e) => handleSelectAll(e)}
                                                className="w-4 h-4 cursor-pointer"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 h-full w-full relative group" style={{ textAlign: 'center', lineHeight: '1.2' }}>
                                            <div>{formatHeaderLabel(cell.label)}</div>
                                            {isEditMode && cell.label === 'POTONGAN UPAH KOTOR' && (
                                                <button onClick={(e) => { e.stopPropagation(); handleAddColumn(cell.label); }}
                                                    style={{ marginLeft: 6, opacity: 0.9, background: '#f59e0b', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title={`Tambah kolom ${cell.label} baru`}
                                                >
                                                    +
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {displayRows.map((row, rIdx) => {
                        if (row.type === 'gang_header') {
                            return (
                                <tr key={row.id} className="gang-header-row">
                                    <td colSpan={columnDefs.length}>🏭 GANG: {row.gang_code}</td>
                                </tr>
                            );
                        }
                        const isHighlight = highlightedRowId === row.id;
                        const rowClass = row.type === 'gang_total' ? 'gang-total-row' : (rIdx % 2 === 0 ? 'row-even' : 'row-odd');

                        return (
                            <tr
                                key={row.id}
                                className={`${rowClass} ${isHighlight ? 'row-highlighted' : ''}`}
                                onClick={() => setHighlightedRowId(row.id)}
                                onContextMenu={(e) => handleContextMenu(e, row)}
                                onDoubleClick={() => row.type === 'employee' && onViewEmployeeDetail?.(row)}
                            >
                                {columnDefs.map((col, cIdx) => {
                                    let displayVal = row[col.field];
                                    const isGangTotal = row.type === 'gang_total';

                                    // For gang total rows: if numeric field is undefined, treat as 0
                                    if (isGangTotal && displayVal === undefined) {
                                        const isNumericColumn = /^(jumlah_|total_|pot_|premi_|lembur_|gaji_|upah_|beras_|jabatan_|masa_|koreksi_|penghasilan_|pph21_|tarif_|astek_|bpjs_|thr_|bonus_|exgratia_|pendapatan_|hari_kerja|kehadiran)/.test(col.field);
                                        if (isNumericColumn) {
                                            displayVal = 0;
                                        }
                                    }

                                    if (typeof displayVal === 'number') {
                                        displayVal = col.field === 'lembur_jam' ? formatDecimal(displayVal) : formatNumber(displayVal);
                                    }
                                    const selected = isCellSelected(rIdx, cIdx);

                                    // Build group class + inline color for body cells
                                    const groupClass = col.group ? `cell-group-${col.group.toLowerCase().replace(/\s+/g, '-')}` : '';
                                    const cellGroupInline = getCellGroupStyle(col.group);

                                    if (col.render) {
                                        return (
                                            <td
                                                key={cIdx}
                                                className={`${col.className} ${selected ? 'cell-selected' : ''} ${groupClass}`}
                                                style={{ left: col.left, width: col.w, minWidth: col.w, ...cellGroupInline }}
                                                onMouseDown={(e) => { handleMouseDown(e, rIdx, cIdx, row.id); }}
                                                onMouseOver={() => handleMouseOver(rIdx, cIdx)}
                                            >
                                                {col.render(row)}
                                            </td>
                                        );
                                    }

                                    return (
                                        <td
                                            key={cIdx}
                                            className={`${col.className} ${selected ? 'cell-selected' : ''} ${groupClass}`}
                                            style={{ left: col.left, width: col.w, minWidth: col.w, ...cellGroupInline }}
                                            onMouseDown={(e) => { handleMouseDown(e, rIdx, cIdx, row.id); }}
                                            onMouseOver={() => handleMouseOver(rIdx, cIdx)}
                                        >
                                            {displayVal ?? '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
                {grandTotal && (
                    <tfoot>
                        <tr className="grand-total-row">
                            {columnDefs.map((col, cIdx) => {
                                let val = grandTotal[col.field];

                                // Special handling for specific columns
                                if (col.field === 'nama') val = 'GRAND TOTAL';
                                else if (col.field === 'no') val = '';
                                else if (col.field === 'emp_code') val = `${displayRows.filter(r => !r.isTotal && !r.isHeader).length} KARYAWAN`;
                                // For numeric columns, always show 0 instead of '-' if value is undefined
                                else if (typeof val === 'number' || val !== undefined) {
                                    // It's a number (could be 0), format it
                                    const numVal = Number(val) || 0;
                                    val = formatNumber(numVal);
                                } else {
                                    // Check if this is a numeric column (based on field name patterns)
                                    const isNumericColumn = /^(jumlah_|total_|pot_|premi_|lembur_|gaji_|upah_|beras_|jabatan_|masa_|koreksi_|penghasilan_|pph21_|tarif_|astek_|bpjs_|thr_|bonus_|exgratia_|pendapatan_|hari_kerja|kehadiran)/.test(col.field);
                                    // For numeric columns, show 0 instead of '-'
                                    val = isNumericColumn ? '0' : '-';
                                }

                                return (
                                    <td key={cIdx} className={col.className} style={{ left: col.left, width: col.w }}>
                                        {val ?? '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tfoot>
                )}
            </table>
            <SelectionStatusBar stats={selectionStats} />
            {contextMenu && (
                <TableContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={() => setContextMenu(null)} />
            )}
        </div>
    );
}

