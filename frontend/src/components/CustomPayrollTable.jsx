import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import '../styles/CustomPayrollTable.css';
import { getLockedRawTree, saveLockedManualEdit, saveLockedProfileOverride, saveLockedValueOverrides } from '../services/lockedDivisionService';
import { isProdMode } from '../utils/prodModeUtils';
import { exportPayrollToExcel } from '../utils/exportPayrollToExcel';
import PayrollScrollChapterBar from './PayrollScrollChapterBar';
import PayrollViewModeToolbar from './PayrollViewModeToolbar';
import SelectionStatusBar from './common/SelectionStatusBar';
import TableContextMenu from './common/TableContextMenu';
import LoadingScreen from './common/LoadingScreen';
import { getTablePreferences, DEFAULT_CELL_COLORS } from '../services/tablePreferencesService';
import { usePayrollStream } from '../hooks/usePayrollStream';
import { splitPayrollEdits } from '../utils/payrollEditPayloads';
import { appendSnapshotVersionToSearchParams, buildPayrollSnapshotCacheKey, normalizeSnapshotVersion } from '../utils/payrollSnapshotQuery';
import { resolveEffectiveGangPrefix } from '../utils/payrollRequestScope';
import { resolveJabatanRate } from '../utils/payrollRowAccessors';
import { formatOtherIncomeColumnLabel, getOtherIncomeDetailFields } from '../utils/otherIncomeColumns';
import { buildCanonicalManualAdjustmentName, buildPendingManualColumn } from '../utils/payrollManualAdjustmentNames';
import { PAYROLL_HEADER_GROUPS, getPayrollHeaderGroup, isPayrollGroupToggleable, normalizePayrollHeaderGroup } from '../utils/payrollHeaderGroups';
import { buildPayrollHeaderRows, getPayrollChapterWindowForGroup } from '../utils/payrollHeaderLayout';
import { resolvePayrollClientRuntimePolicy } from '../utils/payrollClientRuntime';
import {
    buildPayrollViewportChapters,
    detectActivePayrollChapter,
    getPayrollViewportWindow,
    getPayrollChapterScrollLeft,
    resolvePayrollDisplayModeState
} from '../utils/payrollViewportChapters';

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

const {
    PAJAK,
    ABSENSI,
    PANEN,
    PENGGAJIAN,
    TUNJANGAN,
    PENDAPATAN_LAINNYA,
    PREMI,
    POTONGAN_UPAH_KOTOR,
    UPAH_KOTOR,
    POTONGAN_UPAH_BERSIH,
    UPAH_BERSIH
} = PAYROLL_HEADER_GROUPS;

const CustomPayrollTable = memo(function CustomPayrollTable({
    token, month, year, division, gangCode, onViewEmployeeDetail, onOpenHrProfile, fontSize = 100,
    onExportReady = null, refreshTrigger = 0,
    selectedEmployees = [], onToggleEmployeeSelection = () => { },
    onSelectAllEmployees = () => { },
    isEditMode = false,
    useHistoryDb = false,
    snapshotVersion = null,
    gangPrefix = null,
    gangLoading = false,  // Pass gangLoading from parent to prevent fetch during gang load
    currentPeriodLoading = false,
    initialData = null,   // Cached raw API response from parent
    onDataLoaded = null,   // Callback to notify parent of loaded data
    onDataReady = null,    // Callback to expose displayRows data to parent
    onTaxExportReady = null, // Callback to expose data getter for Tax Export
    onRowsGetterReady = null, // Callback to expose displayRows getter without copying rows to parent
    onRefresh = null,      // Callback to trigger parent refresh (for saving)
    sortBy = 'emp_code',     // 'name' | 'emp_code' | 'nik'
    sortOrder = 'asc',     // 'asc' | 'desc'
    onSortChange = null
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
    const [resolvedSnapshotVersion, setResolvedSnapshotVersion] = useState(null);
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
    const [isHarvestExpanded, setHarvestExpanded] = useState(true);
    const [isAttendanceExpanded, setAttendanceExpanded] = useState(true);
    const [isPayrollExpanded, setPayrollExpanded] = useState(true);
    const [isAllowanceExpanded, setAllowanceExpanded] = useState(true);
    const [isOtherIncomeExpanded, setOtherIncomeExpanded] = useState(true);
    const [isPremiExpanded, setPremiExpanded] = useState(true);
    const [isDeductionExpanded, setDeductionExpanded] = useState(true); // Default true to show BPJS details

    // Table Preferences (Body Cell Colors - applied to body cells, NOT headers)
    const [cellColors, setCellColors] = useState(DEFAULT_CELL_COLORS);
    const initialDisplayState = useMemo(() => resolvePayrollDisplayModeState(), []);
    const [displayMode, setDisplayMode] = useState(initialDisplayState.mode);
    const [focusLensEnabled, setFocusLensEnabled] = useState(initialDisplayState.focusLens);
    const [activeChapterGroup, setActiveChapterGroup] = useState(null);
    const [isChapterBarVisible, setChapterBarVisible] = useState(true);
    const [chapterViewportWindow, setChapterViewportWindow] = useState({ startRatio: 0, widthRatio: 1 });
    const hasPendingEdits = useMemo(
        () => Object.keys(editedCells).length > 0 || Object.keys(editedKontanCells).length > 0,
        [editedCells, editedKontanCells]
    );

    const tableRef = useRef(null);
    const tableContainerRef = useRef(null);
    const chapterBarHideTimerRef = useRef(null);

    // ================================================================
    // PROGRESSIVE STREAMING (SSE)
    // Replace the old fetch/process approach with SSE streaming
    // ================================================================
    const [streamEnabled, setStreamEnabled] = useState(true); // Always use streaming
    const effectiveGangPrefix = useMemo(
        () => resolveEffectiveGangPrefix(gangCode, gangPrefix),
        [gangCode, gangPrefix]
    );
    const canStartDataFlow = !!token && !!division && !!month && !!year && !currentPeriodLoading;

    // Use SSE streaming for progressive data delivery
    // CRITICAL FIX: Remove gangLoading from enabled condition to allow streaming to start immediately
    // gangLoading was preventing stream from starting on some computers/virtual divisions
    const stream = usePayrollStream({
        token,
        division,
        month,
        year,
        gangPrefix: effectiveGangPrefix,
        gangCode,
        useHistoryDb,
        snapshotVersion,
        refreshTrigger,
        enabled: canStartDataFlow && streamEnabled
    });

    const triggerPayrollRefresh = useCallback(() => {
        if (typeof onRefresh === 'function') {
            onRefresh();
            return;
        }

        if (typeof stream.startStream === 'function') {
            void stream.startStream();
        }
    }, [onRefresh, stream.startStream]);

    // Sync stream grand total to component state
    useEffect(() => {
        if (stream.grandTotal) {
            setGrandTotal(stream.grandTotal);
        }
    }, [stream.grandTotal]);

    useEffect(() => {
        setResolvedSnapshotVersion(stream.meta?.snapshot_version ?? null);
    }, [stream.meta?.snapshot_version]);

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
                dynamic_premi_headers: dynPrem,
                dynamic_potongan_headers: dynPot,
                premi_title_map: premTitleMap,
                potongan_title_map: potTitleMap,
                meta: {
                    snapshot_version: stream.meta.snapshot_version ?? null,
                    requested_snapshot_version: stream.meta.requested_snapshot_version ?? null,
                    available_snapshot_versions: stream.meta.available_snapshot_versions || [],
                    is_history_snapshot: stream.meta.is_history_snapshot ?? false
                }
            });
        }
    }, [stream.meta, onDataLoaded]);

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
        if (!stream.gangs || stream.gangs.length === 0) {
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

            // Add gang header
            processedRows.push({ type: 'gang_header', gang_code: gCode, id: `HEADER_${gCode}` });

            // Add employees with numbering
            employees.forEach(emp => {
                if (!emp) return;
                const employeeNo = globalNo++;
                processedRows.push({
                    ...emp,
                    no: employeeNo,
                    type: 'employee',
                    id: emp.new_nik || emp.nik || `EMP_${employeeNo}`
                });
            });

            // Add gang total
            const gangTotal = gangData.gang_totals || {};
            gangTotal.type = 'gang_total';
            gangTotal.id = `TOTAL_${gCode}`;
            gangTotal.gang_code = gCode;
            gangTotal.nama = `TOTAL GANG ${gCode}`;
            gangTotal.emp_code = `${employees.length} Kary.`;
            processedRows.push(gangTotal);
        });

        return processedRows;
    }, [stream.gangs]);

    // Determine active dynamic fields from streamed rows
    // Use meta headers as source of truth, not employee data values
    // This ensures columns appear even when values are 0/null
    const streamActiveFields = useMemo(() => {
        // Primary source: meta headers from backend
        const dynPot = stream.meta?.dynamic_potongan_headers || [];
        const dynPrem = stream.meta?.dynamic_premi_headers || [];
        const defaults = {
            activePremi: [...new Set(dynPrem)],
            activePot: [...new Set(dynPot)],
            activePendapatan: []
        };

        if (!stream.isComplete) {
            return defaults;
        }

        const employeeRows = streamRows.filter(r => r.type === 'employee');
        if (employeeRows.length === 0) return defaults;

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
    }, [streamRows, stream.meta, stream.isComplete]);

    // Update active field states when stream data changes
    useEffect(() => {
        if (streamRows.length > 0) {
            setActivePremiFields(streamActiveFields.activePremi);
            setActivePotFields(streamActiveFields.activePot);
            setActivePendapatanFields(streamActiveFields.activePendapatan);
            setSelection([]);
            setDataReady(true);
            return;
        }

        // When stream resolves with no rows, mark as ready so empty-state can render.
        // Without this, the UI can keep showing stale rows from the previous period.
        if (stream.isComplete) {
            setActivePremiFields(prev => (prev.length > 0 ? [] : prev));
            setActivePotFields(prev => (prev.length > 0 ? [] : prev));
            setActivePendapatanFields(prev => (prev.length > 0 ? [] : prev));
            setSelection(prev => (prev.length > 0 ? [] : prev));
            setDataReady(true);
        }
    }, [streamRows, streamActiveFields, stream.isComplete]);

    // Fallback: if stream errors and we have no data, fall back to old fetch
    useEffect(() => {
        if (stream.error && !stream.gangs?.length && streamEnabled) {
            console.warn('[CustomPayrollTable] Stream failed, falling back to legacy fetch');
            setStreamEnabled(false);
            setError(null); // Clear stream error
        }
    }, [stream.error, stream.gangs, streamEnabled]);

    // Update rows when streaming or legacy fetch is active
    useEffect(() => {
        const runtimePolicy = resolvePayrollClientRuntimePolicy({
            dataReady: true,
            hasRows: streamRows.length > 0,
            usesStream: Boolean(stream.gangs?.length),
            streamComplete: stream.isComplete,
            hasPendingEdits,
            employeeCount: streamRows.length
        });

        if (!runtimePolicy.shouldMirrorStreamRows) {
            // Critical: if stream completed but returned no gangs, clear stale rows
            // from previous scope (e.g. month changed to period with no seeded data).
            if (!hasPendingEdits && stream.isComplete && streamRows.length === 0) {
                if (rows.length > 0) {
                    setRows([]);
                }
                setGrandTotal(null);
            }
            return;
        }

        // Always mirror the latest streamed payload once policy allows it.
        // Period changes can keep row identities stable while numeric values change.
        setRows(streamRows);
    }, [hasPendingEdits, rows, stream.gangs, stream.isComplete, streamRows]);

    // Use displayRows as the single source of truth for rendering
    // It merges stream data with edit overlays when needed
    // STRATEGI: Sorting employees WITHIN each gang, bukan global
    // Ini menjaga struktur: header gang → employees (sorted) → total gang
    const displayRows = useMemo(() => {
        let resultRows;

        if (stream.gangs && stream.gangs.length > 0 && rows.length > 0) {
            // Merge stream rows with any pending edits
            if (Object.keys(editedCells).length > 0 || Object.keys(editedKontanCells).length > 0) {
                resultRows = rows.map(row => {
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
            } else {
                resultRows = rows;
            }
        } else if (stream.gangs && stream.gangs.length > 0) {
            resultRows = streamRows;
        } else {
            resultRows = rows;
        }

        // Cek apakah streaming masih berjalan
        const isStreaming = !stream.isComplete || (stream.progress && stream.progress.stage !== 'complete');
        
        // Jika masih streaming ATAU tidak ada sorting, return as-is
        if (isStreaming || !sortBy) {
            return resultRows;
        }

        // Setelah streaming selesai DAN ada sorting aktif:
        // Sort employees WITHIN each gang group
        // Struktur data: [{type: 'header'}, {type: 'employee'} x N, {type: 'total'}, ...]
        // Kita perlu sort employees di antara header dan total untuk setiap gang
        
        const sortedRows = [];
        let currentGangEmployees = [];
        let inEmployeeSection = false;

        for (let i = 0; i < resultRows.length; i++) {
            const row = resultRows[i];
            
            if (row.type === 'employee') {
                // Kumpulkan semua employees
                currentGangEmployees.push(row);
                inEmployeeSection = true;
            } else {
                // Bukan employee row (header/total/separator)
                // Jika sebelumnya ada employee section, sort dan masukkan
                if (currentGangEmployees.length > 0) {
                    currentGangEmployees.sort((a, b) => {
                        let valA, valB;

                        if (sortBy === 'name') {
                            valA = (a.emp_name || '').toLowerCase();
                            valB = (b.emp_name || '').toLowerCase();
                        } else if (sortBy === 'emp_code') {
                            valA = (a.emp_code || '').toLowerCase();
                            valB = (b.emp_code || '').toLowerCase();
                        } else if (sortBy === 'nik') {
                            valA = (a.nik || '').toLowerCase();
                            valB = (b.nik || '').toLowerCase();
                        } else {
                            return 0;
                        }

                        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                        return 0;
                    });
                    sortedRows.push(...currentGangEmployees);
                    currentGangEmployees = [];
                }
                sortedRows.push(row);
                inEmployeeSection = false;
            }
        }

        // Jika ada employee section tersisa di akhir
        if (currentGangEmployees.length > 0) {
            currentGangEmployees.sort((a, b) => {
                let valA, valB;

                if (sortBy === 'name') {
                    valA = (a.emp_name || '').toLowerCase();
                    valB = (b.emp_name || '').toLowerCase();
                } else if (sortBy === 'emp_code') {
                    valA = (a.emp_code || '').toLowerCase();
                    valB = (b.emp_code || '').toLowerCase();
                } else if (sortBy === 'nik') {
                    valA = (a.nik || '').toLowerCase();
                    valB = (b.nik || '').toLowerCase();
                } else {
                    return 0;
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
            sortedRows.push(...currentGangEmployees);
        }

        return sortedRows;
    }, [stream.gangs, streamRows, rows, editedCells, editedKontanCells, stream.isComplete, stream.progress, sortBy, sortOrder]);

    const employeeRows = useMemo(
        () => displayRows.filter(row => row.type === 'employee'),
        [displayRows]
    );

    /**
     * OPTIMIZATION: Cache displayed data in localStorage for instant retrieval in Print Page
     * This allows the Print Page to skip the expensive batch-checkroll API call.
     */
    useEffect(() => {
        const runtimePolicy = resolvePayrollClientRuntimePolicy({
            dataReady,
            hasRows: displayRows.length > 0,
            usesStream: Boolean(stream.gangs?.length),
            streamComplete: stream.isComplete,
            hasPendingEdits,
            employeeCount: employeeRows.length
        });
        if (!runtimePolicy.shouldPersistCache) return;

        // Extract only employee rows (ignore headers/totals)
        const employeeDataMap = {};
        employeeRows.forEach(row => {
            const key = (row.emp_code || row.nik || '').toUpperCase();
            if (key) {
                employeeDataMap[key] = row;
            }
        });

        if (Object.keys(employeeDataMap).length > 0) {
            const storageKey = buildPayrollSnapshotCacheKey({
                division,
                month,
                year,
                useHistory: useHistoryDb,
                snapshotVersion: normalizeSnapshotVersion(snapshotVersion) ?? resolvedSnapshotVersion
            });
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    data: employeeDataMap,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('[CustomPayrollTable] Failed to save payroll cache to localStorage (possibly quota exceeded)');
            }
        }
    }, [dataReady, displayRows.length, division, employeeRows, hasPendingEdits, month, resolvedSnapshotVersion, snapshotVersion, stream.gangs, stream.isComplete, useHistoryDb, year]);

    // Toggle handlers
    const toggleGroup = useCallback((group) => {
        const canonicalGroup = normalizePayrollHeaderGroup(group) || group;
        if (canonicalGroup === PAJAK) setIsTaxExpanded(prev => !prev);
    }, []);

    const getGroupExpandedState = useCallback((group) => {
        const canonicalGroup = normalizePayrollHeaderGroup(group);
        if (canonicalGroup === PAJAK) return isTaxExpanded;
        return null;
    }, [isTaxExpanded]);

    // Load preferences on mount
    useEffect(() => {
        const prefs = getTablePreferences();
        if (prefs.preferences?.cellColors) {
            setCellColors(prefs.preferences.cellColors);
        }
    }, []);

    // Sync employee codes when displayRows change (for select-all checkbox state only)
    useEffect(() => {
        if (stream.gangs?.length && !stream.isComplete) return;

        const empCodeList = employeeRows
            .map(r => r.emp_code || r.nik)
            .filter(code => code);
        setAllEmployeeNiks(empCodeList);
        // NOTE: Don't call onSelectAllEmployees here - let user manually select employees
    }, [employeeRows, stream.gangs, stream.isComplete]);

    // Expose displayRows data to parent via callback
    useEffect(() => {
        const runtimePolicy = resolvePayrollClientRuntimePolicy({
            dataReady,
            hasRows: displayRows.length > 0,
            usesStream: Boolean(stream.gangs?.length),
            streamComplete: stream.isComplete,
            hasPendingEdits,
            employeeCount: employeeRows.length
        });

        if (onDataReady && runtimePolicy.shouldPublishToParent && employeeRows.length > 0) {
            onDataReady(employeeRows);
        }
    }, [dataReady, displayRows.length, employeeRows, hasPendingEdits, onDataReady, stream.gangs, stream.isComplete]);

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
        axios.get('tunjangan/rates?category=JABATAN')
            .then(res => {
                if (res.data.success) setTunjanganRates(res.data.data);
            })
            .catch(console.error);
    }, []);

    const handleAddColumn = (groupLabel) => {
        const firstEmp = displayRows.find(r => r.type === 'employee');
        const rawName = window.prompt(`Masukkan nama kolom baru untuk ${groupLabel}:\n(Contoh: PINJAMAN, BPJS, INSENTIF)`);
        const pendingColumn = buildPendingManualColumn({
            groupLabel,
            rawName,
            division,
            firstEmployee: firstEmp
        });

        if (!pendingColumn) return;

        setDynamicHeaders(prev => ({
            ...prev,
            [pendingColumn.activeFieldBucket]: {
                ...prev[pendingColumn.activeFieldBucket],
                [pendingColumn.adjustmentName]: pendingColumn.fieldName
            }
        }));

        if (pendingColumn.activeFieldBucket === 'premi') {
            setActivePremiFields(prev => [...new Set([...prev, pendingColumn.fieldName])]);
        } else {
            setActivePotFields(prev => [...new Set([...prev, pendingColumn.fieldName])]);
        }

        setAddedColumns(prev => [...prev, pendingColumn.payload]);
    };

    // Handle Manual Cell Edit
    const handleCellEdit = (row, field, value, originalValue, type, name) => {
        const empCode = row.emp_code || row.nik;
        const key = `${empCode}-${field}`;
        const numValue = value === '' ? 0 : parseFloat(value);

        if (isNaN(numValue)) return;

        setEditedCells(prev => ({
            ...prev,
            [key]: {
                emp_code: empCode,
                nik: row.nik,
                field,
                value: numValue,
                originalValue,
                gang_code: row.gang_code,
                type,
                name
            }
        }));

        // Optimistically update the UI
        setRows(prevRows => prevRows.map(row => {
            if ((row.emp_code || row.nik) === empCode) {
                return { ...row, [field]: numValue };
            }
            return row;
        }));
    };

    const handleProfileEdit = (row, field, value) => {
        const empCode = row.emp_code || row.nik;
        const key = `${empCode}-${field}`;
        const nextValue = field === 'is_spsi_member' ? !!value : value;

        setEditedCells(prev => ({
            ...prev,
            [key]: {
                emp_code: empCode,
                nik: row.nik,
                field,
                value: nextValue,
                originalValue: row[field] ?? null,
                gang_code: row.gang_code,
                employee_status: row.employee_status || row.hr_emp_type || null,
                type: 'PROFILE_OVERRIDE',
                name: field
            }
        }));

        setRows(prevRows => prevRows.map(currentRow => {
            if ((currentRow.emp_code || currentRow.nik) === empCode) {
                return { ...currentRow, [field]: nextValue };
            }
            return currentRow;
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
            triggerPayrollRefresh();
            return;
        }

        setIsSavingEdits(true);
        try {
            let successCount = 0;

            // Separate MASTER_TAX edits from normal numeric edits
            const masterTaxEdits = editsArray.filter(e => e.type === 'MASTER_TAX');
            const normalEdits = editsArray.filter(e => e.type !== 'MASTER_TAX');
            const { profileItems, valueItems } = splitPayrollEdits({
                month,
                year,
                division,
                edits: normalEdits
            });
            const overlayFields = new Set(['is_spsi_member', 'effective_start_date', 'premi_dynamic', 'pot_koreksi', 'pot_lainnya']);
            const legacyEdits = normalEdits.filter(edit => !overlayFields.has(edit.field));

            // --- Save MASTER_TAX edits (PTKP) via dedicated endpoint ---
            for (const edit of masterTaxEdits) {
                try {
                    const res = await axios.put(`tax-report/ptkp/${encodeURIComponent(edit.nik)}`, {
                        year: year,
                        ptkp_status: edit.value
                    }, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    if (res.data?.success) {
                        successCount++;
                    } else {
                        console.error('PTKP update failed:', resJson?.error);
                    }
                } catch (err) {
                    console.error('Error saving PTKP edit:', err);
                }
            }

            // --- Save overlay profile edits ---
            for (const profile of profileItems) {
                let resOk = false;
                let resJson = null;

                if (isProdMode()) {
                    try {
                        resJson = await saveLockedProfileOverride(token, profile);
                        resOk = true;
                    } catch (err) {
                        console.error('Prod Mode profile override failed:', err);
                    }
                } else {
                    const res = await fetch('/payroll/overrides/profile', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(profile)
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

            // --- Save period-scoped overlay value edits ---
            if (valueItems.length > 0) {
                let resOk = false;
                let resJson = null;

                if (isProdMode()) {
                    try {
                        resJson = await saveLockedValueOverrides(token, { items: valueItems });
                        resOk = true;
                    } catch (err) {
                        console.error('Prod Mode value overrides failed:', err);
                    }
                } else {
                    const res = await fetch('/payroll/overrides/values', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ items: valueItems })
                    });

                    if (res.ok) {
                        resOk = true;
                        resJson = await res.json();
                    }
                }

                if (resOk && resJson?.success) {
                    successCount += valueItems.length;
                }
            }

            // --- Save legacy manual edits ---
            for (const edit of legacyEdits) {
                const payload = {
                    period_month: month,
                    period_year: year,
                    emp_code: edit.emp_code || edit.nik,
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
                triggerPayrollRefresh(); // Reload to get fresh data with recalculated totals
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
                triggerPayrollRefresh();
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
    const processRawData = useCallback(async (data) => {
        if (!data) {
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

            // Step 2: Normalize gang data directly from backend payload (single source of truth)
            setLoadingProgress(prev => ({ ...prev, message: 'Menyusun data gang dari backend...' }));
            const sourceGangs = Array.isArray(data.gangs) ? data.gangs : [];
            const sortedGangs = [...sourceGangs]
                .filter(gang => gang && typeof gang === 'object' && gang.gang_code)
                .map(gang => ({
                    gang_code: gang.gang_code,
                    employees: Array.isArray(gang.employees) ? [...gang.employees] : [],
                    gang_totals: gang.gang_totals || null
                }))
                .sort((a, b) => String(a.gang_code).localeCompare(String(b.gang_code), undefined, { numeric: true, sensitivity: 'base' }))
                .filter(gang => gang.employees.length > 0);

            const totalEmployees = sortedGangs.reduce((sum, gang) => sum + gang.employees.length, 0);

            // Step 3: Progressive rendering - gang by gang
            setLoadingProgress({
                stage: 'rendering',
                message: `Memproses ${sortedGangs.length} gang...`,
                totalGangs: sortedGangs.length,
                processedGangs: 0,
                totalEmployees,
                processedEmployees: 0
            });

            const processedRows = [];
            let globalNo = 1;
            let processedCount = 0;

            // Process gangs in batches to avoid blocking UI
            for (let i = 0; i < sortedGangs.length; i++) {
                const gang = sortedGangs[i];
                const gCode = gang.gang_code;
                const employees = gang.employees;
                
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
                    const employeeNo = globalNo++;
                    processedRows.push({
                        ...emp,
                        no: employeeNo,
                        type: 'employee',
                        id: emp.new_nik || emp.nik || `EMP_${employeeNo}`
                    });
                });

                const gangTotal = {
                    ...(gang.gang_totals || {}),
                    type: 'gang_total',
                    id: `TOTAL_${gCode}`,
                    gang_code: gCode,
                    nama: `TOTAL GANG ${gCode}`,
                    emp_code: `${employees.length} Kary.`
                };
                processedRows.push(gangTotal);

                processedCount += employees.length;

                // Update progress every 2 gangs or if it's the last one
                if (i % 2 === 1 || i === sortedGangs.length - 1) {
                    setLoadingProgress({
                        stage: 'rendering',
                        message: `Memproses gang ${i + 1}/${sortedGangs.length}: ${gCode}`,
                        totalGangs: sortedGangs.length,
                        processedGangs: i + 1,
                        totalEmployees,
                        processedEmployees: processedCount
                    });

                    // Yield to browser to render current rows
                    if (i < sortedGangs.length - 1) {
                        setRows([...processedRows]); // Update rows progressively
                        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms yield
                    }
                }
            }

            // Step 5: Final updates
            setLoadingProgress({
                stage: 'complete',
                message: 'Selesai!',
                totalGangs: sortedGangs.length,
                processedGangs: sortedGangs.length,
                totalEmployees,
                processedEmployees: processedCount
            });

            // Grand total must come from backend payload
            if (data.grand_total && typeof data.grand_total === 'object') {
                setGrandTotal({
                    ...data.grand_total,
                    emp_code: `${processedCount} Karyawan`
                });
            } else {
                console.warn('[CustomPayrollTable] Backend payload missing grand_total');
                setGrandTotal(null);
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
                    token, division, month, year, useHistoryDb,
                    shouldSendGangPrefix ? effectiveGangPrefix : null,
                    snapshotVersion,
                    gangCode
                );
            } else {
                const params = new URLSearchParams({
                    division_code: division,
                    month: String(month),
                    year: String(year),
                    use_history: useHistoryDb ? 'true' : 'false'
                });
                if (effectiveGangPrefix) params.set('gang_prefix', effectiveGangPrefix);
                if (gangCode && gangCode !== 'ALL') params.set('gang_code', gangCode);
                appendSnapshotVersionToSearchParams(params, snapshotVersion);
                const url = `/payroll/report/division-raw-tree?${params.toString()}`;
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
            setResolvedSnapshotVersion(data?.meta?.snapshot_version ?? null);
            processRawData(data);

        } catch (err) {
            if (err.name === 'AbortError') {
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
    }, [division, month, year, gangCode, effectiveGangPrefix, token, useHistoryDb, snapshotVersion, gangLoading, processRawData, onDataLoaded]);

    // --- MAIN DATA EFFECT ---
    // When streaming is enabled: use SSE stream (handled by usePayrollStream hook)
    // When streaming is disabled: fallback to old fetch/process approach
    useEffect(() => {
        if (!canStartDataFlow || gangLoading) return;
        // Streaming is handled by usePayrollStream hook automatically
        // Only call fetchDivisionData when streaming is disabled (fallback mode)
        if (!streamEnabled) {
            fetchDivisionData();
        }
    }, [canStartDataFlow, gangLoading, refreshTrigger, useHistoryDb, snapshotVersion, fetchDivisionData, streamEnabled]);

    // === COLUMN DEFINITIONS (Single Source of Truth) ===
    // Each column knows its header hierarchy: [level0, level1, level2, level3]
    // null means "merge with parent above"
    const columnDefs = useMemo(() => {
        const cols = [
            // Checkbox Column
            {
                field: 'checkbox',
                headers: ['IDENTITAS', null, '✓'],
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
            {
                field: 'no',
                headers: ['IDENTITAS', null, 'NO'],
                w: 35,
                className: 'text-center sticky-col',
                left: 35
            },
            {
                field: 'emp_code',
                headers: ['IDENTITAS', null, 'EMP CODE'],
                w: 75,
                className: 'text-center sticky-col',
                left: 70
            },
            {
                field: 'nama',
                headers: ['IDENTITAS', null, 'NAMA'],
                w: displayMode === 'detail' ? 140 : 160,
                className: 'text-left sticky-col',
                left: 145,
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
            {
                field: 'alamat',
                headers: ['IDENTITAS', null, 'ALAMAT'],
                w: 200,
                className: 'text-left',
                render: (row) => row.alamat || row.res_address || '-'
            },
            {
                field: 'join_date',
                headers: ['IDENTITAS', null, 'TGL MASUK'],
                w: 100,
                className: 'text-center',
                render: (row) => {
                    if (row.type !== 'employee') {
                        const jd = row.join_date || row.tanggal_masuk;
                        if (!jd) return '-';
                        try {
                            const d = new Date(jd);
                            if (isNaN(d.getTime())) return jd;
                            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                        } catch {
                            return jd;
                        }
                    }
                    const jd = row.join_date || row.tanggal_masuk;
                    // Edit mode: use effective_start_date for editing
                    const editKey = `${row.emp_code || row.nik}-effective_start_date`;
                    const isEdited = !!editedCells[editKey];

                    if (isEditMode) {
                        const displayDate = jd ? (() => {
                            try {
                                const d = new Date(jd);
                                if (isNaN(d.getTime())) return '';
                                return d.toISOString().split('T')[0]; // YYYY-MM-DD for input
                            } catch { return ''; }
                        })() : '';
                        return (
                            <input
                                type="date"
                                className={`edit-input ${isEdited ? 'cell-edited' : ''}`}
                                value={editedCells[editKey]?.value ?? displayDate}
                                onChange={(e) => handleProfileEdit(row, 'effective_start_date', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        );
                    }

                    if (!jd) return '-';
                    try {
                        const d = new Date(jd);
                        if (isNaN(d.getTime())) return jd;
                        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    } catch {
                        return jd;
                    }
                }
            },

            // PAJAK [Conditionally Expanded]
            ...(isTaxExpanded ? [
                {
                    field: 'status_ptkp',
                    headers: [PAJAK, null, 'PTKP'],
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
                { field: 'kategori_ter', headers: [PAJAK, null, 'TER'], w: 55, className: 'text-center' },
                // PENDAPATAN LAINNYA TAXABLE (Dynamic) - THR, Bonus, Custom, etc that are taxable (included in penghasilan_bruto)
                ...getOtherIncomeDetailFields(activePendapatanFields).map(field => {
                    const baseType = field.replace('pendapatan_', '');
                    const taxField = `taxable_pendapatan_${baseType}`;
                    const displayName = formatOtherIncomeColumnLabel(field);
                    return {
                        field: taxField,
                        headers: [PAJAK, 'OBJEK', displayName],
                        w: 85,
                        className: 'text-right',
                        render: (row) => {
                            const val = Number(row[taxField] || row[field] || 0);
                            if (val === 0) return '-';
                            return formatNumber(val);
                        }
                    };
                }),
                { field: 'taxable_pendapatan_lainnya', headers: [PAJAK, 'OBJEK', 'TOTAL'], w: 85, className: 'text-right font-bold cell-total-soft', render: (row) => {
                    const val = Number(row.taxable_pendapatan_lainnya || row.pendapatan_lainnya || 0);
                    if (val === 0) return '-';
                    return formatNumber(val);
                }},
                { field: 'penghasilan_bruto', headers: [PAJAK, null, 'BRUTO'], w: 110, className: 'text-right font-bold' },
                {
                    field: 'tarif_pajak_ter',
                    headers: [PAJAK, null, 'TER (%)'],
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
            { field: 'pph21_ter', headers: [PAJAK, null, 'PPH21 TER'], w: 95, className: 'text-right' },

            // ABSENSI
            { field: 'hari_kerja', headers: ['ABSENSI', 'HADIR', 'HK'], w: 40, className: 'text-center' },
            ...[
                { field: 'cuti_tahunan_hari', headers: ['ABSENSI', 'CUTI/OFF', 'TAHUNAN'], w: 45, className: 'text-center' },
                { field: 'cuti_sakit_haid_hari', headers: ['ABSENSI', 'CUTI/OFF', 'SAKIT'], w: 70, className: 'text-center' },
                { field: 'cuti_minggu_hari', headers: ['ABSENSI', 'CUTI/OFF', 'MINGGU'], w: 55, className: 'text-center' },
                { field: 'cuti_nasional_hari', headers: ['ABSENSI', 'CUTI/OFF', 'NASIONAL'], w: 60, className: 'text-center' },
            ],
            { field: 'jumlah_hk', headers: ['ABSENSI', null, 'TOTAL HK'], w: 60, className: 'text-center font-bold cell-total-soft' },
            // ABSENSI > TOTAL JAM [NEW] - Marks employees with shortage hours (kurang jam)
            {
                field: 'total_jam_kerja',
                headers: ['ABSENSI', null, 'TOTAL JAM'],
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
                    const shortageDates = shortageInfo.map(d => d.date.split('-').pop()).join(', ');

                    let tooltipText = `⚠️ KURANG JAM KERJA\n`;
                    tooltipText += `Total Selisih: ${shortageTotalHours.toFixed(1)} jam\n`;
                    tooltipText += `Tanggal: ${shortageDates}\n`;
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
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                border: '2px solid #ef4444',
                                borderRadius: '4px',
                                animation: 'pulse-warning 2s infinite',
                                lineHeight: '1',
                                overflow: 'hidden'
                            }}
                            title={tooltipText}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <span style={{ fontSize: '12px' }}>⚠️</span>
                                <span>{row.total_jam_kerja}</span>
                            </div>
                            <div style={{ fontSize: '8px', color: '#7f1d1d', fontWeight: 'bold', marginTop: '1px' }}>
                                Tgl: {shortageDates}
                            </div>
                            {shortageTotalHours > 0 && (
                                <span style={{ fontSize: '7px', color: '#7f1d1d', opacity: 0.8 }}>
                                    (-{shortageTotalHours.toFixed(1)}j)
                                </span>
                            )}
                        </div>
                    );
                }
            },
        ];

        // PANEN - temporarily disabled in UI, keep header as section placeholder only
        cols.push({
            field: 'panen_section_disabled',
            headers: ['PANEN', null, 'SEMENTARA OFF'],
            w: 100,
            className: 'text-center cell-section-disabled',
            render: () => ''
        });

        // PENGGAJIAN
        const showPayrollDetails = true;
        cols.push({
            field: 'gaji_pokok_aktual',
            headers: [PENGGAJIAN, null, 'GP AKTUAL'],
            w: 95,
            className: 'text-right',
            render: (row) => {
                const val = row.gaji_pokok_aktual || 0;
                if (val === 0) return '-';
                const ideal = row.gaji_pokok_ideal || 0;
                if (row.type === 'employee' && val > ideal) {
                    return (
                        <div
                            title={`⚠️ Gaji Tidak Benar: Aktual (${formatNumber(val)}) melebihi Ideal (${formatNumber(ideal)})`}
                            style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px' }}
                        >
                            <span style={{ fontSize: '11px' }}>⚠️</span>
                            <span>{formatNumber(val)}</span>
                        </div>
                    );
                }
                return formatNumber(val);
            }
        });
        if (showPayrollDetails) {
            cols.push({ field: 'gaji_pokok_ideal', headers: [PENGGAJIAN, null, 'GP IDEAL'], w: 85, className: 'text-right' });
            cols.push({
                field: 'koreksi_hk',
                headers: [PENGGAJIAN, null, 'KOR. HK'],
                w: 85,
                className: 'text-right',
                render: (row) => {
                    const val = row.koreksi_hk;
                    if (val === null || val === undefined || val === 0) return '-';
                    const isKurang = val < 0;
                    const color = isKurang ? '#dc2626' : '#ea580c';
                    let label = isKurang ? 'Kurang Jam' : 'Salah Scan';
                    if (isKurang && row.shortage_details?.length > 0) {
                        const shortageDates = row.shortage_details.map(d => d.date.split('-').pop()).join(', ');
                        label = `KJ: ${shortageDates}`;
                    }
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.1' }}>
                            <span style={{ color, fontWeight: 'bold' }}>{isKurang ? '-' : '+'}{formatNumber(Math.abs(val))}</span>
                            <span style={{ fontSize: '8px', color, opacity: 0.9, whiteSpace: 'nowrap' }}>({label})</span>
                        </div>
                    );
                }
            });
        }

        // JABATAN
        cols.push({
            field: 'jabatan_estate',
            headers: ['IDENTITAS', null, 'JABATAN'],
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

        cols.push({
            field: 'is_spsi_member',
            headers: ['IDENTITAS', null, 'SPSI'],
            w: 78,
            className: 'text-center',
            render: (row) => {
                if (row.type !== 'employee') return row.is_spsi_member ? 'SPSI' : '-';
                const editKey = `${row.emp_code || row.nik}-is_spsi_member`;
                const isEdited = !!editedCells[editKey];

                if (isEditMode) {
                    return (
                        <input
                            type="checkbox"
                            checked={!!row.is_spsi_member}
                            className={isEdited ? 'cell-edited' : ''}
                            onChange={(e) => handleProfileEdit(row, 'is_spsi_member', e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    );
                }

                return row.is_spsi_member ? 'SPSI' : 'Non-SPSI';
            }
        });

        cols.push({
            field: 'masa_kerja_label',
            headers: ['IDENTITAS', null, 'MASA KERJA'],
            w: 95,
            className: 'text-center',
            render: (row) => row.masa_kerja_label || '0 bln'
        });

        // ALAMAT
        // TUNJANGAN
        const showAllowanceRates = true;
        if (showAllowanceRates) {
            cols.push({ field: 'beras_rate', headers: ['TUNJANGAN', 'BERAS', 'RATE'], w: 60, className: 'text-right' });
        }
        cols.push({ field: 'beras_jumlah', headers: ['TUNJANGAN', 'BERAS', 'JUMLAH'], w: 80, className: 'text-right' });

        if (showAllowanceRates) {
            cols.push({ field: 'jabatan_rate', headers: ['TUNJANGAN', 'TUNJ JAB', 'RATE'], w: 60, className: 'text-right', render: (row) => formatNumber(resolveJabatanRate(row)) });
        }
        cols.push({ field: 'jabatan_jumlah', headers: ['TUNJANGAN', 'TUNJ JAB', 'JUMLAH'], w: 80, className: 'text-right', render: (row) => formatNumber(row.jabatan_jumlah) });

        cols.push({ field: 'masa_kerja_tahun', headers: ['TUNJANGAN', 'MASA KERJA', 'LAMA'], w: 45, className: 'text-center' });
        cols.push({ field: 'masa_kerja_jumlah', headers: ['TUNJANGAN', 'MASA KERJA', 'JUMLAH'], w: 80, className: 'text-right' });

        cols.push({ field: 'lembur_jam', headers: ['TUNJANGAN', 'LEMBUR', 'JAM'], w: 45, className: 'text-center' });
        cols.push({ field: 'lembur_jumlah', headers: ['TUNJANGAN', 'LEMBUR', 'JUMLAH'], w: 80, className: 'text-right' });

        cols.push({ field: 'total_tunjangan', headers: ['TUNJANGAN', null, 'TOTAL TUNJ'], w: 95, className: 'text-right font-bold cell-total-soft' });

        // PREMI
        const showPremiDetails = true;
        if (showPremiDetails) {
            cols.push({ field: 'premi_brondol', headers: [PREMI, null, 'BRONDOL'], w: 80, className: 'text-right' });

            Object.entries(dynamicHeaders.premi)
                .filter(([label, field]) => field !== 'brondol' && (activePremiFields.includes(field) || isEditMode))
                .forEach(([label, field]) => {
                    const displayName = label.replace('PREMI ', '');
                    const canonicalName = buildCanonicalManualAdjustmentName('PREMI', label);
                    cols.push({
                        field, headers: [PREMI, null, displayName], w: 90, className: 'text-right',
                        render: (row) => {
                            const val = Number(row[field] || 0);
                            const empCode = row.emp_code || row.nik;
                            const editKey = `${empCode}-${field}`;
                            const isEdited = !!editedCells[editKey];

                            if (isEditMode && row.type === 'employee') {
                                const displayVal = editedCells[editKey]?.value ?? val;
                                return <input type="number" className={`edit-input ${isEdited ? 'cell-edited' : ''}`} value={displayVal === 0 ? '' : displayVal} onChange={(e) => handleCellEdit(row, field, e.target.value, val, 'PREMI', canonicalName)} placeholder="0" onClick={(e) => e.stopPropagation()} />;
                            }

                            if (val === 0) return '-';
                            return formatNumber(val);
                        }
                    });
                });
        }
        cols.push({ field: 'total_premi', headers: [PREMI, null, 'TOTAL PREMI'], w: 95, className: 'text-right font-bold cell-total-soft' });

        // PENDAPATAN LAINNYA
        const activePendapatan = getOtherIncomeDetailFields(activePendapatanFields);
        const deductionOtherIncomeFields = getOtherIncomeDetailFields(activePendapatanFields, { includeKontan: true });
        const showOtherIncomeDetails = true;
        if (showOtherIncomeDetails) {
            for (const field of activePendapatan) {
                const displayName = formatOtherIncomeColumnLabel(field, '(+)');
                cols.push({
                    field,
                    headers: [PENDAPATAN_LAINNYA, null, displayName],
                    w: 90,
                    className: 'text-right font-bold',
                    render: (row) => {
                        const val = Number(row[field] || 0);
                        if (val === 0) return '-';
                        return formatNumber(val);
                    }
                });
            }
        }

        if (showOtherIncomeDetails || isEditMode) {
            cols.push({
            field: 'pendapatan_kontan',
            headers: [PENDAPATAN_LAINNYA, null, 'KONTAN (+)'],
            w: 90,
            className: 'text-right',
            render: (row) => {
                const val = Number(row.pendapatan_kontan || 0);
                const empCode = row.emp_code || row.nik;
                const editKey = `${empCode}-pendapatan_kontan`;
                const cellEdit = editedKontanCells[editKey];
                const displayVal = cellEdit ? cellEdit.value : val;
                const isEdited = !!cellEdit;

                if (isEditMode && row.type === 'employee') {
                    const hasPendingDelete = cellEdit && cellEdit.value === 0;
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input
                                type="number" className={`edit-input ${isEdited ? 'cell-edited' : ''} ${hasPendingDelete ? 'cell-delete' : ''}`}
                                value={displayVal}
                                onChange={(e) => {
                                    const rawVal = e.target.value;
                                    const newVal = rawVal === '' ? 0 : parseFloat(rawVal);
                                    if (isNaN(newVal)) return;
                                    setEditedKontanCells(prev => ({ ...prev, [editKey]: { nik: row.nik, emp_code: row.emp_code, value: newVal, originalValue: val, gang_code: row.gang_code } }));
                                    setRows(prev => prev.map(r => (r.emp_code || r.nik) === empCode ? { ...r, pendapatan_kontan: newVal } : r));
                                }}
                                placeholder="0" onClick={(e) => e.stopPropagation()} style={{ width: '65px' }}
                            />
                            {hasPendingDelete && (
                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Hapus KONTAN?')) { setEditedKontanCells(prev => { const upd = { ...prev }; delete upd[editKey]; return upd; }); setRows(prev => prev.map(r => (r.emp_code || r.nik) === empCode ? { ...r, pendapatan_kontan: val } : r)); } }} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }} title="Batal Hapus">✕</button>
                            )}
                        </div>
                    );
                }
                return val === 0 ? '-' : formatNumber(val);
            }
            });
        }

        cols.push({
            field: 'total_pendapatan_lainnya',
            headers: [PENDAPATAN_LAINNYA, null, 'TOTAL (+)'],
            w: 100,
            className: 'text-right font-bold',
            render: (row) => {
                const val = Number(row.total_pendapatan_lainnya || 0);
                return formatNumber(val);
            }
        });

        // POTONGAN UPAH KOTOR
        const koreksiFields = Object.entries(dynamicHeaders.potongan)
            .filter(([label, field]) => field.toUpperCase().startsWith('KOREKSI') && (activePotFields.includes(field) || isEditMode))
            .sort(([a], [b]) => (a || '').localeCompare(b || ''));

        if (koreksiFields.length === 0 && !isEditMode) {
            cols.push({ field: 'pot_koreksi', headers: [POTONGAN_UPAH_KOTOR, null, 'KOREKSI'], w: 80, className: 'text-right' });
        } else {
            for (const [label, field] of koreksiFields) {
                const displayLabel = label.replace(/^KOREKSI\s*/i, 'KOR. ') || label;
                const canonicalName = buildCanonicalManualAdjustmentName('POTONGAN UPAH KOTOR', label);
                cols.push({
                    field, headers: [POTONGAN_UPAH_KOTOR, null, displayLabel], w: 90, className: 'text-right',
                    render: (row) => {
                        const val = row[field] || 0;
                        if (isEditMode && row.type === 'employee') {
                            const editKey = `${row.nik}-${field}`;
                            const isEdited = !!editedCells[editKey];
                            return <input type="number" className={`edit-input ${isEdited ? 'cell-edited' : ''}`} value={val === 0 ? '' : val} onChange={(e) => handleCellEdit(row, field, e.target.value, val, 'POTONGAN_KOTOR', canonicalName)} placeholder="0" onClick={(e) => e.stopPropagation()} />;
                        }
                        return val === 0 ? '-' : formatNumber(val);
                    }
                });
            }
        }
        cols.push({ field: 'potongan_upah_kotor_total', headers: [POTONGAN_UPAH_KOTOR, null, 'TOT KOR.'], w: 95, className: 'text-right font-bold cell-total-soft' });

        // UPAH KOTOR
        cols.push({
            field: 'jumlah_upah_kotor', headers: [UPAH_KOTOR, null, 'JUMLAH'], w: 110, className: 'text-right font-bold cell-gross-salary',
            render: (row) => {
                const empCode = row.emp_code || row.nik;
                const kontanEdit = editedKontanCells[`${empCode}-pendapatan_kontan`];
                const kontanVal = kontanEdit ? kontanEdit.value : Number(row.pendapatan_kontan || 0);
                const val = Number(row.jumlah_upah_kotor || 0) - Number(row.pendapatan_kontan || 0) + (kontanVal || 0);
                return val === 0 ? '-' : formatNumber(val);
            }
        });

        // POTONGAN UPAH BERSIH - Collapsible
        // Default: Show ONLY Total Potongan
        const showDeductionDetails = true;

        if (showDeductionDetails) {
            // POTONGAN UPAH BERSIH > CARUMAN ASTEK
            cols.push({
                field: 'pot_astek',
                headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'ASTEK', 'PEK.'],
                w: 75,
                className: 'text-right'
            });
            cols.push({
                field: 'pot_astek_maj',
                headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'ASTEK', 'MAJ.'],
                w: 75,
                className: 'text-right'
            });

            // POTONGAN UPAH BERSIH > POTONGAN BPJS > KESEHATAN
            cols.push({
                field: 'pot_bpjs_kesehatan_pekerja',
                headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'BPJS KES', 'PEK.'],
                w: 75,
                className: 'text-right'
            });
            cols.push({
                field: 'pot_bpjs_kesehatan_majikan',
                headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'BPJS KES', 'MAJ.'],
                w: 75,
                className: 'text-right'
            });
            // POTONGAN UPAH BERSIH > POTONGAN BPJS > PENSIUN
            cols.push({
                field: 'pot_bpjs_pensiun_pekerja',
                headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'BPJS PEN', 'PEK.'],
                w: 75,
                className: 'text-right'
            });
            cols.push({
                field: 'pot_bpjs_pensiun_majikan',
                headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'BPJS PEN', 'MAJ.'],
                w: 75,
                className: 'text-right'
            });
            // POTONGAN UPAH BERSIH > POTONGAN BPJS > JUMLAH
            cols.push({ field: 'pot_bpjs_pekerja_total', headers: [POTONGAN_UPAH_BERSIH, 'CARUMAN', 'BPJS', 'TOTAL'], w: 80, className: 'text-right font-bold' });
            // Other deductions
            cols.push({ field: 'pot_spsi', headers: [POTONGAN_UPAH_BERSIH, 'LAINNYA', null, 'SPSI'], w: 80, className: 'text-right' });
            cols.push({ field: 'pot_pph21', headers: [POTONGAN_UPAH_BERSIH, 'LAINNYA', null, 'PPH21 (-)'], w: 80, className: 'text-right' });
            
            // PENDAPATAN LAINNYA sebagai pengurang upah bersih
            for (const field of deductionOtherIncomeFields) {
                cols.push({
                    field: `${field}_pengurang`,
                    headers: [POTONGAN_UPAH_BERSIH, 'LAINNYA', null, formatOtherIncomeColumnLabel(field, '(-)')],
                    w: 90,
                    className: 'text-right',
                    render: (row) => {
                        const val = Number(row[field] || 0);
                        if (val === 0) return '-';
                        return formatNumber(val);
                    }
                });
            }

            cols.push({
                field: 'total_pendapatan_lainnya_pengurang',
                headers: [POTONGAN_UPAH_BERSIH, 'LAINNYA', null, 'PEND. LAIN (-)'],
                w: 90,
                className: 'text-right',
                render: (row) => {
                    const val = Number(row.total_pendapatan_lainnya || 0);
                    if (val === 0) return '-';
                    return formatNumber(val);
                }
            });

            cols.push({
                field: 'premi_pph',
                headers: [POTONGAN_UPAH_BERSIH, 'LAINNYA', null, 'PREMI PPH (+)'],
                w: 90,
                className: 'text-right cell-premi-pph',
                render: (row) => {
                    const val = row.premi_pph || 0;
                    if (val === 0) return '-';
                    return (
                        <span style={{ color: '#059669', fontWeight: 'bold' }}>
                            +{formatNumber(val)}
                        </span>
                    );
                }
            });

            // Dynamic Potongan Bersih
            const potonganBersihFields = Object.entries(dynamicHeaders.potongan)
                .filter(([label, field]) => {
                    const u = (field || '').toUpperCase();
                    return !u.startsWith('KOREKSI') && u !== 'SPSI' && u !== 'PPH21' && u !== 'PREMI_PPH';
                })
                .filter(([label, field]) => activePotFields.includes(field) || isEditMode)
                .sort(([a], [b]) => (a || '').localeCompare(b || ''));

            for (const [label, field] of potonganBersihFields) {
                const displayLabel = (label || '').replace(/^(POTONGAN\s*|POT\s*)/i, '') || label;
                const canonicalName = buildCanonicalManualAdjustmentName('POTONGAN UPAH BERSIH', label);
                cols.push({
                    field,
                    headers: [POTONGAN_UPAH_BERSIH, 'LAINNYA', null, displayLabel],
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
                                    onChange={(e) => handleCellEdit(row, field, e.target.value, val, 'POTONGAN_BERSIH', canonicalName)}
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

        // Total Potongan Bersih
        cols.push({
            field: 'total_potongan_bersih',
            headers: [POTONGAN_UPAH_BERSIH, 'TOTAL', null, 'TOTAL POT'],
            w: 100,
            className: 'text-right font-bold cell-deduction cell-total-soft',
            render: (row) => {
                const empCode = row.emp_code || row.nik;
                const kontanEdit = editedKontanCells[`${empCode}-pendapatan_kontan`];
                const kontanVal = kontanEdit ? kontanEdit.value : Number(row.pendapatan_kontan || 0);
                const val = Number(row.total_potongan_bersih || 0) - Number(row.pendapatan_kontan || 0) + (kontanVal || 0);
                if (val === 0) return '-';
                return formatNumber(val);
            }
        });

        // UPAH BERSIH
        cols.push({
            field: 'upah_bersih',
            headers: [UPAH_BERSIH, null, 'JUMLAH'],
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
            c.group = getPayrollHeaderGroup(c.headers[0]);
        });

        return cols;
    }, [dynamicHeaders, activePremiFields, activePotFields, activePendapatanFields, tunjanganMode, tunjanganRates, isTaxExpanded, isHarvestExpanded, isAttendanceExpanded, isPayrollExpanded, isAllowanceExpanded, isDeductionExpanded, isOtherIncomeExpanded, isPremiExpanded, selectedEmployees, onToggleEmployeeSelection, savingJabatan, isEditMode, editedKontanCells]);

    const chapterSegments = useMemo(() => buildPayrollViewportChapters(columnDefs), [columnDefs]);
    const firstScrollableGroup = useMemo(
        () => chapterSegments.find((chapter) => chapter.group && chapter.group !== PAYROLL_HEADER_GROUPS.IDENTITAS)?.group
            || chapterSegments[0]?.group
            || null,
        [chapterSegments]
    );
    const focusedGroup = activeChapterGroup || firstScrollableGroup;
    const renderColumnDefs = useMemo(() => {
        if (displayMode !== 'simple' || !focusedGroup) return columnDefs;
        return columnDefs.filter((column) => column.left !== undefined || column.group === focusedGroup);
    }, [columnDefs, displayMode, focusedGroup]);
    const getHeaderStyle = useCallback((_label, level = 0) => {
        const rowPalette = ['#0f172a', '#1e293b', '#334155'];
        const bg = rowPalette[Math.min(level, rowPalette.length - 1)];
        return {
            backgroundColor: bg,
            color: '#f8fafc',
            borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
            borderRight: '1px solid rgba(148, 163, 184, 0.15)',
            letterSpacing: level === 0 ? '0.02em' : '0em',
            textTransform: level === 0 ? 'uppercase' : 'none',
            fontWeight: level === 0 ? 700 : (level === 1 ? 600 : 500),
            fontSize: level === 0 ? '11px' : '10px',
            padding: '4px 6px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        };
    }, []);
    const headerRows = useMemo(
        () => buildPayrollHeaderRows({ columnDefs: renderColumnDefs, getHeaderStyle }),
        [renderColumnDefs, getHeaderStyle]
    );

    const syncActiveChapter = useCallback((container = tableContainerRef.current) => {
        if (!chapterSegments.length) {
            setActiveChapterGroup(null);
            setChapterViewportWindow({ startRatio: 0, widthRatio: 1 });
            return;
        }

        if (displayMode === 'simple') {
            const nextGroup = activeChapterGroup || firstScrollableGroup || chapterSegments[0]?.group || null;
            setActiveChapterGroup(nextGroup);
            setChapterViewportWindow(getPayrollChapterWindowForGroup(chapterSegments, nextGroup));
            return;
        }

        if (!container) {
            const nextGroup = chapterSegments[0]?.group ?? null;
            setActiveChapterGroup(nextGroup);
            setChapterViewportWindow(getPayrollChapterWindowForGroup(chapterSegments, nextGroup));
            return;
        }

        const viewport = {
            scrollLeft: container.scrollLeft,
            clientWidth: container.clientWidth
        };

        const nextGroup = detectActivePayrollChapter(chapterSegments, viewport);
        setActiveChapterGroup(nextGroup);
        setChapterViewportWindow(getPayrollViewportWindow(chapterSegments, viewport));
    }, [activeChapterGroup, chapterSegments, displayMode, firstScrollableGroup]);

    const scrollToChapterGroup = useCallback((group) => {
        const container = tableContainerRef.current;
        if (!group) return;

        setActiveChapterGroup(group);
        setChapterViewportWindow(getPayrollChapterWindowForGroup(chapterSegments, group));

        if (displayMode === 'simple') {
            return;
        }

        if (!container) {
            return;
        }

        const left = getPayrollChapterScrollLeft(chapterSegments, group);
        container.scrollTo({ left, behavior: 'smooth' });
        setChapterViewportWindow(getPayrollViewportWindow(chapterSegments, {
            scrollLeft: left,
            clientWidth: container.clientWidth
        }));
    }, [chapterSegments, displayMode]);

    const handleStepChapter = useCallback((direction) => {
        if (!chapterSegments.length) return;
        const currentIndex = Math.max(0, chapterSegments.findIndex((chapter) => chapter.group === focusedGroup));
        const nextIndex = direction === 'left'
            ? Math.max(0, currentIndex - 1)
            : Math.min(chapterSegments.length - 1, currentIndex + 1);

        const targetGroup = chapterSegments[nextIndex]?.group;
        if (targetGroup) {
            scrollToChapterGroup(targetGroup);
        }
    }, [chapterSegments, focusedGroup, scrollToChapterGroup]);

    useEffect(() => {
        syncActiveChapter();
    }, [syncActiveChapter]);

    useEffect(() => {
        if (!activeChapterGroup && firstScrollableGroup) {
            setActiveChapterGroup(firstScrollableGroup);
        }
    }, [activeChapterGroup, firstScrollableGroup]);

    useEffect(() => {
        setSelection([]);
        setSelectionStats(null);
    }, [displayMode, focusedGroup]);

    useEffect(() => {
        const container = tableContainerRef.current;
        if (!container || displayMode === 'simple') return undefined;
        let lastScrollLeft = container.scrollLeft;

        const handleScroll = () => {
            if (container.scrollLeft === lastScrollLeft) return;

            lastScrollLeft = container.scrollLeft;
            setChapterBarVisible(true);
            syncActiveChapter(container);

            // Auto-hide disabled - footer should always stay visible for better UX
            // User can click tabs to navigate without footer disappearing
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (chapterBarHideTimerRef.current) {
                clearTimeout(chapterBarHideTimerRef.current);
            }
        };
    }, [displayMode, syncActiveChapter]);

    // === EXPORT TO EXCEL HANDLER (with ALL columns including conditional ones) ===
    const handleExportToExcel = useCallback(async () => {
        if (displayRows.length === 0) {
            alert('Tidak ada data untuk di-export');
            return null;
        }
        try {
            // Use columnDefs yang ada (sudah mencakup semua kolom yang visible)
            // Export akan menyertakan semua field yang ada di rows data
            // PENTING: Gunakan displayRows yang sudah ter-sortir, bukan rows asli
            const fileName = await exportPayrollToExcel(displayRows, columnDefs, grandTotal, {
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
    }, [displayRows, columnDefs, grandTotal, division, gangCode, month, year]);

    // Expose export function to parent
    useEffect(() => {
        if (onExportReady) {
            // [FIX] Must wrap in arrow function because onExportReady is a useState setter (setExportHandler).
            // Passing a function directly to useState setter causes React to execute it (functional update).
            // We want to STORE the function, not execute it.
            onExportReady(() => handleExportToExcel);
        }
    }, [onExportReady, handleExportToExcel]);

    // Expose table data getter for Tax Export to parent
    useEffect(() => {
        if (onTaxExportReady) {
            onTaxExportReady(() => () => displayRows);
        }
    }, [displayRows, onTaxExportReady]);

    useEffect(() => {
        if (onRowsGetterReady) {
            onRowsGetterReady(() => displayRows);
        }
    }, [displayRows, onRowsGetterReady]);
    // Helper to get body cell inline style from cookie preferences
    const getCellGroupStyle = useCallback((group) => {
        if (!group || !cellColors[group]) return {};
        if (group === PANEN) {
            return {
                backgroundColor: '#f1f5f9',
                color: '#64748b'
            };
        }
        if (group === UPAH_KOTOR) {
            return {
                backgroundColor: '#ecfdf5',
                color: '#166534'
            };
        }
        const colors = cellColors[group];
        return {
            backgroundColor: colors.bg,
            color: colors.text
        };
    }, [cellColors]);

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
            const row = displayRows[r];
            if (!row || row.type === 'gang_header') return;
            const col = renderColumnDefs[c];
            if (col) {
                const val = parseFloat(row[col.field]);
                if (!isNaN(val)) values.push(val);
            }
        });
        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            setSelectionStats({ count: values.length, sum, avg: sum / values.length, min: Math.min(...values), max: Math.max(...values) });
        } else { setSelectionStats(null); }
    }, [selection, displayRows, renderColumnDefs]);

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

    const togglePortalTarget = document.getElementById('column-toggles-portal');
    const togglesElement = togglePortalTarget ? createPortal(
        <>
            <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }}></div>
            <div style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>TAMPILAN TABEL</div>
            <div style={{ padding: '6px 8px 8px' }}>
                <PayrollViewModeToolbar
                    mode={displayMode}
                    focusLens={focusLensEnabled}
                    taxExpanded={isTaxExpanded}
                    onModeChange={setDisplayMode}
                    onFocusLensChange={setFocusLensEnabled}
                    onToggleTax={() => toggleGroup('PAJAK')}
                />
            </div>
            {false && [
                { label: 'Pajak (PPH21)', state: isTaxExpanded, toggle: () => toggleGroup('PAJAK') }
            ].map(item => (
                <button
                    key={item.label}
                    onClick={(e) => { e.stopPropagation(); item.toggle(); }}
                    style={{
                        width: '100%',
                        textAlign: 'left', padding: '0.4rem 0.5rem', borderRadius: '4px', border: 'none',
                        background: item.state ? '#eff6ff' : 'transparent',
                        color: item.state ? '#1e3a8a' : '#475569',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: '0.8rem'
                    }}
                >
                    <span>{item.label}</span>
                    <span>{item.state ? '✅' : '☐'}</span>
                </button>
            ))}
        </>,
        togglePortalTarget
    ) : null;

    return (
        <div
            className={`payroll-table-shell mode-${displayMode} ${focusLensEnabled ? 'focus-lens-on' : 'focus-lens-off'}`}
            onMouseUp={handleMouseUp}
            style={{ 
                height: 'calc(100vh - 120px)', 
                minHeight: '400px',
                '--payroll-bottom-safe-area': '60px',
                '--payroll-grand-total-offset': '50px'
            }}
        >
            {togglesElement}
            <div
                className="payroll-table-container"
                ref={tableContainerRef}
                style={{
                    fontSize: `${11 * scale}px`,
                    '--payroll-bottom-safe-area': '56px',
                    '--payroll-grand-total-offset': '36px'
                }}
            >
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
                    padding: '7px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Top row: icon + message + stats */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid #e5e7eb',
                                    borderTop: '2px solid #3b82f6',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    flexShrink: 0
                                }} />
                                <div>
                                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '12px' }}>
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
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
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
                            height: '4px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '2px',
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
                                borderRadius: '2px'
                            }} />
                        </div>

                        {/* Gang name indicator during streaming */}
                        {effectiveProgress?.stage === 'streaming' && stream.gangs?.length > 0 && (
                            <div style={{
                                marginTop: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>Gang:</span>
                                {stream.gangs.slice(-Math.min(8, stream.gangs.length)).map((g, i) => (
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
                                {stream.gangs.length > 8 && (
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        +{stream.gangs.length - 8} gang lagi...
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
                                        cursor: cell.sortable ? 'pointer' : 'default',
                                        ...cell.headerStyle
                                    }}
                                    data-header-level={cell.level}
                                    data-active-group={cell.headerGroup && focusedGroup ? String(cell.headerGroup === focusedGroup) : undefined}
                                    data-focus-dim={focusLensEnabled && cell.headerGroup && focusedGroup ? String(cell.headerGroup !== focusedGroup) : undefined}
                                    data-field={cell.field}
                                    onClick={() => cell.sortable && onSortChange && onSortChange(cell.field)}
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
                                        <div
                                            className={`flex items-center justify-center gap-1 h-full w-full relative group ${cell.level === 0 && isPayrollGroupToggleable(cell.label) ? 'cursor-pointer hover:bg-white/10 transition-colors select-none' : ''}`}
                                            style={{ textAlign: 'center', lineHeight: '1.2' }}
                                            onClick={(e) => {
                                                if (!(cell.level === 0 && isPayrollGroupToggleable(cell.label))) return;
                                                e.stopPropagation();
                                                toggleGroup(cell.label);
                                            }}
                                            title={cell.level === 0 && isPayrollGroupToggleable(cell.label) ? 'Klik untuk melihat/menyembunyikan detail' : undefined}
                                        >
                                            <div>{formatHeaderLabel(cell.label)}</div>
                                            {cell.level === 0 && isPayrollGroupToggleable(cell.label) && (
                                                <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                                                    {getGroupExpandedState(cell.label) ? '▼' : '▶'}
                                                </span>
                                            )}

                                            {/* Sort Indicators */}
                                            {cell.sortable && (
                                                <span style={{ fontSize: '10px', color: sortBy === cell.field ? '#fff' : 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>
                                                    {sortBy === cell.field ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                                                </span>
                                            )}

                                            {/* Add Columns Button in Edit Mode */}
                                            {isEditMode && cell.topHeader === PREMI && cell.label === 'TOTAL PREMI' && (
                                                <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddColumn(PREMI);
                                                    }}
                                                    style={{ marginLeft: 6, opacity: 0.9, background: '#f59e0b', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Tambah kolom premi baru"
                                                >
                                                    +
                                                </button>
                                            )}
                                            {isEditMode && cell.level === 0 && cell.label === POTONGAN_UPAH_KOTOR && (
                                                <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddColumn(POTONGAN_UPAH_KOTOR);
                                                    }}
                                                    style={{ marginLeft: 6, opacity: 0.9, background: '#f59e0b', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Tambah kolom potongan kotor baru"
                                                >
                                                    +
                                                </button>
                                            )}
                                            {isEditMode && cell.level === 0 && cell.label === POTONGAN_UPAH_BERSIH && (
                                                <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddColumn(POTONGAN_UPAH_BERSIH);
                                                    }}
                                                    style={{ marginLeft: 6, opacity: 0.9, background: '#f59e0b', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    title="Tambah kolom potongan bersih baru"
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
                                    <td colSpan={renderColumnDefs.length}>🏭 GANG: {row.gang_code}</td>
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
                                onDoubleClick={() => {
                                    if (row.type !== 'employee') return
                                    if (!onViewEmployeeDetail) {
                                        console.error('[CustomPayrollTable] onViewEmployeeDetail is not defined')
                                        return
                                    }
                                    onViewEmployeeDetail(row)
                                }}
                            >
                                {renderColumnDefs.map((col, cIdx) => {
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
                                                data-active-group={col.group && focusedGroup ? String(col.group === focusedGroup) : undefined}
                                                data-focus-dim={focusLensEnabled && col.group && focusedGroup ? String(col.group !== focusedGroup) : undefined}
                                                data-field={col.field}
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
                                            data-active-group={col.group && focusedGroup ? String(col.group === focusedGroup) : undefined}
                                            data-focus-dim={focusLensEnabled && col.group && focusedGroup ? String(col.group !== focusedGroup) : undefined}
                                            data-field={col.field}
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
                            {renderColumnDefs.map((col, cIdx) => {
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
                                    <td
                                        key={cIdx}
                                        className={col.className}
                                        style={{ left: col.left, width: col.w }}
                                        data-active-group={col.group && focusedGroup ? String(col.group === focusedGroup) : undefined}
                                        data-focus-dim={focusLensEnabled && col.group && focusedGroup ? String(col.group !== focusedGroup) : undefined}
                                    >
                                        {val ?? '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tfoot>
                )}
            </table>
            {contextMenu && (
                <TableContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={() => setContextMenu(null)} />
            )}
            </div>
            {/* Render Footer OUTSIDE scrollable container so position:fixed works properly */}
            <PayrollScrollChapterBar
                activeGroup={focusedGroup || 'IDENTITAS'}
                allGroups={[...new Set(columnDefs.map(c => c.group).filter(Boolean))]}
                isVisible={isChapterBarVisible}
                onSelectGroup={(group) => {
                    if (!group) return;
                    // Keep current mode; in simple mode this switches focused chapter directly.
                    scrollToChapterGroup(group);
                }}
                recentGangs={stream.gangs?.length > 0 ? stream.gangs : []}
                streamingStage={effectiveProgress?.stage}
                totalGangs={effectiveProgress?.totalGangs || 0}
                processedGangs={effectiveProgress?.processedGangs || 0}
                displayMode={displayMode}
                onToggleDisplayMode={() => setDisplayMode(displayMode === 'simple' ? 'detail' : 'simple')}
            />
            <SelectionStatusBar stats={selectionStats} />
        </div>
    );
});

export default CustomPayrollTable;
