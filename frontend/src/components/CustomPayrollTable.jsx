import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import '../styles/CustomPayrollTable.css';
import { getLockedRawTree } from '../services/lockedDivisionService';
import { isProdMode } from '../utils/prodModeUtils';
import { PayrollAggregator } from '../utils/PayrollAggregator';
import { exportPayrollToExcel } from '../utils/exportPayrollToExcel';
import SelectionStatusBar from './common/SelectionStatusBar';
import TableContextMenu from './common/TableContextMenu';
import LoadingScreen from './common/LoadingScreen';

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

export default function CustomPayrollTable({
    token, month, year, division, gangCode, onViewEmployeeDetail, fontSize = 100, onExportReady = null
}) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dynamicHeaders, setDynamicHeaders] = useState({ premi: {}, potongan: {} });
    const [grandTotal, setGrandTotal] = useState(null);
    const [selection, setSelection] = useState([]); // Changed to array for multi-select
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStats, setSelectionStats] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [highlightedRowId, setHighlightedRowId] = useState(null);
    const [activePremiFields, setActivePremiFields] = useState([]);
    const [activePotFields, setActivePotFields] = useState([]);

    // Tunjangan Mode & Rates
    const [tunjanganMode, setTunjanganMode] = useState('DB'); // 'DB' or 'CALC'
    const [tunjanganRates, setTunjanganRates] = useState({});

    const tableRef = useRef(null);

    useEffect(() => {
        fetch('/tunjangan/rates?category=JABATAN')
            .then(res => res.json())
            .then(json => {
                if (json.success) setTunjanganRates(json.data);
            })
            .catch(console.error);
    }, []);

    // --- DATA FETCHING ---
    const handleJobTitleChange = async (empCode, newTitle) => {
        // Optimistic update
        setRows(prev => prev.map(r => r.nik === empCode ? { ...r, jabatan_estate: newTitle } : r));
        try {
            const res = await fetch('/employee-estate/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ empCode, jobTitle: newTitle })
            });
            if (!res.ok) throw new Error('Failed to save');
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
        } catch (e) {
            console.error(e);
            alert('Gagal menyimpan jabatan: ' + e.message);
        }
    };

    const handleBulkSave = async () => {
        if (!confirm('Simpan/Seed semua jabatan yang tampil ke database?')) return;
        setLoading(true);
        try {
            const employees = rows.filter(r => r.type === 'employee');
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

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            let data;
            if (isProdMode()) {
                data = await getLockedRawTree(token, division, month, year);
            } else {
                const url = `/payroll/report/division-raw-tree?division_code=${division}&month=${month}&year=${year}`;
                const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) throw new Error(await response.text());
                data = await response.json();
            }
            const dynPot = data.dynamic_potongan_headers || {};
            const dynPrem = data.dynamic_premi_headers || {};
            setDynamicHeaders({ premi: dynPrem, potongan: dynPot });

            let flatRows = PayrollAggregator.flattenData(data, dynPot);

            // Calculate grand total based on FILTERED rows (selected gang only)
            const filteredFlat = gangCode && gangCode !== 'ALL'
                ? flatRows.filter(r => r.gang_code === gangCode)
                : flatRows;
            const gt = PayrollAggregator.calculateGrandTotal(filteredFlat);
            setGrandTotal(gt);

            const gangsMap = {};
            flatRows.forEach(row => {
                const g = row.gang_code;
                if (!gangsMap[g]) gangsMap[g] = [];
                gangsMap[g].push(row);
            });

            const processedRows = [];
            let globalNo = 1;
            let gangKeys = Object.keys(gangsMap).sort();
            if (gangCode && gangCode !== 'ALL') gangKeys = gangKeys.filter(g => g === gangCode);

            gangKeys.forEach(gCode => {
                const employees = gangsMap[gCode];
                processedRows.push({ type: 'gang_header', gang_code: gCode, id: `HEADER_${gCode}` });
                employees.forEach(emp => {
                    emp.no = globalNo++;
                    emp.type = 'employee';
                    emp.id = emp.nik || `EMP_${emp.no}`;
                    processedRows.push(emp);
                });
                const gangTotal = PayrollAggregator.calculateGangTotals(gCode, flatRows);
                gangTotal.type = 'gang_total';
                gangTotal.id = `TOTAL_${gCode}`;
                gangTotal.gang_code = gCode;
                processedRows.push(gangTotal);
            });
            setRows(processedRows);

            // Determine which dynamic premi fields have values in current gang
            const employeeRows = processedRows.filter(r => r.type === 'employee');
            const activePremi = Object.entries(dynPrem).filter(([label, field]) => {
                return employeeRows.some(row => {
                    const val = row[field];
                    return val !== null && val !== undefined && val !== 0 && val !== '';
                });
            }).map(([label, field]) => field);
            setActivePremiFields(activePremi);

            // Determine which dynamic potongan fields have values
            const activePot = Object.entries(dynPot)
                .filter(([k]) => !k.toUpperCase().startsWith('KOREKSI'))
                .filter(([label, field]) => {
                    return employeeRows.some(row => {
                        const val = row[field];
                        return val !== null && val !== undefined && val !== 0 && val !== '';
                    });
                }).map(([label, field]) => field);
            setActivePotFields(activePot);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (month && year && division) loadData();
    }, [month, year, division, gangCode, token]);

    // === COLUMN DEFINITIONS (Single Source of Truth) ===
    // Each column knows its header hierarchy: [level0, level1, level2, level3]
    // null means "merge with parent above"
    const columnDefs = useMemo(() => {
        const cols = [
            // IDENTITAS
            { field: 'no', headers: ['IDENTITAS', null, null, 'NO'], w: 40, className: 'text-center sticky-col', left: 0 },
            { field: 'nama', headers: ['IDENTITAS', null, null, 'NAMA'], w: 170, className: 'text-left sticky-col', left: 40 },
            // ABSENSI > KEHADIRAN
            { field: 'hari_kerja', headers: ['ABSENSI', 'KEHADIRAN', null, 'AN'], w: 40, className: 'text-center cell-absensi' },
            // ABSENSI > KETIDAKHADIRAN
            { field: 'cuti_tahunan_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'CUTI'], w: 45, className: 'text-center cell-absensi' },
            { field: 'cuti_sakit_haid_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'SAKIT+HAID'], w: 70, className: 'text-center cell-absensi' },
            { field: 'cuti_minggu_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'MINGGU'], w: 55, className: 'text-center cell-absensi' },
            { field: 'cuti_nasional_hari', headers: ['ABSENSI', 'KETIDAKHADIRAN', null, 'NASIONAL'], w: 60, className: 'text-center cell-absensi' },
            // ABSENSI > JUMLAH HK
            { field: 'jumlah_hk', headers: ['ABSENSI', null, null, 'JUMLAH HK'], w: 60, className: 'text-center cell-absensi font-bold' },
            // ABSENSI > TOTAL JAM [NEW]
            {
                field: 'total_jam_kerja',
                headers: ['ABSENSI', null, null, 'TOTAL JAM'],
                w: 60,
                className: 'text-center cell-absensi',
                render: (row) => (
                    <div className={`w-full h-full flex items-center justify-center ${row.has_shortage ? 'bg-red-100 text-red-600 font-bold' : ''}`}>
                        {row.total_jam_kerja}
                    </div>
                )
            },
            // PENGGAJIAN
            { field: 'upah_dasar', headers: ['PENGGAJIAN', null, null, 'UPAH DASAR'], w: 85, className: 'text-right' },
            { field: 'upah_pokok', headers: ['PENGGAJIAN', null, null, 'UPAH POKOK'], w: 85, className: 'text-right' },
            { field: 'gaji_pokok', headers: ['PENGGAJIAN', null, null, 'GAJI POKOK'], w: 85, className: 'text-right' },

            // JABATAN [NEW] - HIDDEN TEMPORARILY
            // {
            //     field: 'jabatan_estate',
            //     headers: ['IDENTITAS', null, null, 'JABATAN'],
            //     w: 110,
            //     className: 'text-left p-0', // p-0 to allow select to fill
            //     render: (row) => (
            //         <select
            //             className="w-full h-full border-none bg-transparent text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            //             value={row.jabatan_estate || 'Karyawan'}
            //             onChange={(e) => handleJobTitleChange(row.nik, e.target.value)}
            //             onClick={(e) => e.stopPropagation()}
            //             onMouseDown={(e) => e.stopPropagation()}
            //             style={{ padding: '0 4px', height: '100%' }}
            //         >
            //             <option value="Karyawan">Karyawan</option>
            //             <option value="Mandor">Mandor</option>
            //             <option value="Kerani">Kerani</option>
            //             <option value="Helper">Helper</option>
            //             <option value="Operator">Operator</option>
            //         </select>
            //     )
            // },

            // TUNJANGAN > BERAS
            { field: 'beras_rate', headers: ['TUNJANGAN', 'BERAS', null, 'RATE'], w: 60, className: 'text-right' },
            { field: 'beras_jumlah', headers: ['TUNJANGAN', 'BERAS', null, 'JUMLAH'], w: 80, className: 'text-right' },
            // TUNJANGAN > JABATAN (This is allowance amount, not title)
            // TUNJANGAN > JABATAN (This is allowance amount, not title)
            {
                field: 'jabatan_rate',
                headers: ['TUNJANGAN', 'TUNJ. JABATAN', null, 'RATE'],
                w: 60,
                className: 'text-right',
                render: (row) => formatNumber(row.jabatan_rate)
            },
            {
                field: 'jabatan_jumlah',
                headers: ['TUNJANGAN', 'TUNJ. JABATAN', null, 'JUMLAH'],
                w: 80,
                className: 'text-right',
                render: (row) => formatNumber(row.jabatan_jumlah)
            },
            // TUNJANGAN > MASA KERJA
            { field: 'masa_kerja_tahun', headers: ['TUNJANGAN', 'MASA KERJA', null, 'LAMA'], w: 45, className: 'text-center' },
            { field: 'masa_kerja_jumlah', headers: ['TUNJANGAN', 'MASA KERJA', null, 'JUMLAH'], w: 80, className: 'text-right' },
            // TUNJANGAN > LEMBUR
            { field: 'lembur_jam', headers: ['TUNJANGAN', 'LEMBUR', null, 'JAM'], w: 45, className: 'text-center' },
            { field: 'lembur_jumlah', headers: ['TUNJANGAN', 'LEMBUR', null, 'JUMLAH'], w: 80, className: 'text-right' },
            // TUNJANGAN > TOTAL
            { field: 'total_tunjangan', headers: ['TUNJANGAN', null, null, 'TOTAL TUNJANGAN'], w: 100, className: 'text-right font-bold cell-total-tunjangan' },
        ];

        // PREMI - Static BRONDOL column (from separate query, always show if has values)
        // BRONDOL is not in dynamic_premi_headers because it comes from brondol_data query
        cols.push({ field: 'premi_brondol', headers: ['PREMI', null, null, 'BRONDOL'], w: 80, className: 'text-right cell-premi' });

        // PREMI (dynamic) - only show if has values in current gang
        Object.entries(dynamicHeaders.premi)
            .filter(([label, field]) => activePremiFields.includes(field))
            .forEach(([label, field]) => {
                cols.push({ field, headers: ['PREMI', null, null, label.replace('PREMI ', '')], w: 80, className: 'text-right cell-premi-dynamic' });
            });
        cols.push({ field: 'total_premi', headers: ['PREMI', null, null, 'TOTAL PREMI'], w: 95, className: 'text-right font-bold cell-total-premi' });

        // POTONGAN UPAH KOTOR - KOREKSI column
        // ALWAYS show pot_koreksi column - this field is populated by backend from DocDesc='KOREKSI'
        // The pot_koreksi value comes from the employee data, not from dynamic headers
        cols.push({
            field: 'pot_koreksi',
            headers: ['POTONGAN UPAH KOTOR', null, null, 'KOREKSI'],
            w: 80,
            className: 'text-right',
            // Custom getter for debugging - can remove later
            getValue: (row) => {
                const val = row.pot_koreksi ?? row.potongan_upah_kotor?.koreksi ?? 0;
                if (val > 0) console.log('[CustomTable DEBUG] pot_koreksi for', row.nama, '=', val);
                return val;
            }
        });

        // Total Koreksi
        cols.push({ field: 'potongan_upah_kotor_total', headers: ['POTONGAN UPAH KOTOR', null, null, 'TOTAL KOREKSI'], w: 95, className: 'text-right font-bold' });

        // UPAH KOTOR (separate group, not child of POTONGAN UPAH KOTOR)
        cols.push({ field: 'jumlah_upah_kotor', headers: ['UPAH KOTOR', null, null, 'JUMLAH'], w: 110, className: 'text-right font-bold cell-upah-kotor' });

        // POTONGAN UPAH BERSIH > CARUMAN ASTEK
        cols.push({ field: 'pot_astek', headers: ['POTONGAN UPAH BERSIH', 'CARUMAN ASTEK', null, 'PEKERJA'], w: 75, className: 'text-right' });
        cols.push({ field: 'pot_astek_maj', headers: ['POTONGAN UPAH BERSIH', 'CARUMAN ASTEK', null, 'MAJIKAN'], w: 75, className: 'text-right' });

        // POTONGAN UPAH BERSIH > POTONGAN BPJS > KESEHATAN
        cols.push({ field: 'pot_bpjs_kesehatan_pekerja', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'KESEHATAN', 'PEKERJA'], w: 75, className: 'text-right' });
        cols.push({ field: 'pot_bpjs_kesehatan_majikan', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'KESEHATAN', 'MAJIKAN'], w: 75, className: 'text-right' });
        // POTONGAN UPAH BERSIH > POTONGAN BPJS > PENSIUN
        cols.push({ field: 'pot_bpjs_pensiun_pekerja', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'PENSIUN', 'PEKERJA'], w: 75, className: 'text-right' });
        cols.push({ field: 'pot_bpjs_pensiun_majikan', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', 'PENSIUN', 'MAJIKAN'], w: 75, className: 'text-right' });
        // POTONGAN UPAH BERSIH > POTONGAN BPJS > JUMLAH
        cols.push({ field: 'pot_bpjs_pekerja_total', headers: ['POTONGAN UPAH BERSIH', 'POTONGAN BPJS', null, 'JUMLAH'], w: 80, className: 'text-right font-bold' });
        // Other deductions
        cols.push({ field: 'pot_spsi', headers: ['POTONGAN UPAH BERSIH', null, null, 'IURAN SPSI'], w: 80, className: 'text-right' });
        cols.push({ field: 'pot_pph21', headers: ['POTONGAN UPAH BERSIH', null, null, 'PPH21'], w: 80, className: 'text-right' });

        // Dynamic Potongan Bersih - only show if has values in current gang
        Object.entries(dynamicHeaders.potongan)
            .filter(([k]) => !k.toUpperCase().startsWith('KOREKSI'))
            .filter(([label, field]) => activePotFields.includes(field))
            .forEach(([label, field]) => {
                cols.push({ field, headers: ['POTONGAN UPAH BERSIH', null, null, label.replace(/^(POTONGAN\s*|POT\s*)/i, '')], w: 80, className: 'text-right' });
            });
        cols.push({ field: 'total_potongan_bersih', headers: ['POTONGAN UPAH BERSIH', null, null, 'TOTAL POTONGAN'], w: 100, className: 'text-right font-bold cell-deduction' });

        // TOTAL UPAH (Summary group) - only Upah Bersih since Upah Kotor is now separate
        cols.push({ field: 'upah_bersih', headers: ['UPAH BERSIH', null, null, 'JUMLAH'], w: 115, className: 'text-right font-bold cell-net-salary' });

        return cols;
    }, [dynamicHeaders, activePremiFields, activePotFields, tunjanganMode, tunjanganRates]);

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
            onExportReady(handleExportToExcel);
        }
    }, [onExportReady, handleExportToExcel]);

    // === GENERATE HEADER ROWS FROM COLUMN DEFINITIONS ===
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

                rowCells.push({
                    label: cell.label || '',
                    colSpan: cell.colSpan,
                    rowSpan: cell.rowSpan,
                    isSticky: columnDefs[col].left !== undefined,
                    left: columnDefs[col].left
                });
            }
            result.push(rowCells);
        }

        return result;
    }, [columnDefs]);

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
    if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>;

    const scale = fontSize / 100;
    const rowHeight = 28;

    return (
        <div className="payroll-table-container" style={{ fontSize: `${11 * scale}px` }} onMouseUp={handleMouseUp}>
            <table className="payroll-table" ref={tableRef}>
                <thead>
                    {headerRows.map((hRow, rIdx) => (
                        <tr key={`hr-${rIdx}`}>
                            {hRow.map((cell, cIdx) => (
                                <th
                                    key={`hc-${rIdx}-${cIdx}`}
                                    colSpan={cell.colSpan}
                                    rowSpan={cell.rowSpan}
                                    className={`sticky-header ${cell.isSticky ? 'sticky-corner' : ''}`}
                                    style={{
                                        top: rIdx * rowHeight,
                                        left: cell.left,
                                        height: cell.rowSpan * rowHeight
                                    }}
                                >
                                    {cell.label === 'JABATAN' ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <span>JABATAN</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleBulkSave(); }}
                                                className="text-xs bg-gray-200 hover:bg-gray-300 rounded px-1 pb-0.5 border border-gray-400"
                                                title="Simpan Semua ke Database"
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
                                    ) : cell.label}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {rows.map((row, rIdx) => {
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
                                    if (typeof displayVal === 'number') {
                                        displayVal = col.field === 'lembur_jam' ? formatDecimal(displayVal) : formatNumber(displayVal);
                                    }
                                    const selected = isCellSelected(rIdx, cIdx);

                                    if (col.render) {
                                        return (
                                            <td
                                                key={cIdx}
                                                className={`${col.className} ${selected ? 'cell-selected' : ''}`}
                                                style={{ left: col.left, width: col.w, minWidth: col.w }}
                                                onMouseDown={(e) => { e.preventDefault(); handleMouseDown(e, rIdx, cIdx, row.id); }}
                                                onMouseOver={() => handleMouseOver(rIdx, cIdx)}
                                            >
                                                {col.render(row)}
                                            </td>
                                        );
                                    }

                                    return (
                                        <td
                                            key={cIdx}
                                            className={`${col.className} ${selected ? 'cell-selected' : ''}`}
                                            style={{ left: col.left, width: col.w, minWidth: col.w }}
                                            onMouseDown={(e) => { e.preventDefault(); handleMouseDown(e, rIdx, cIdx, row.id); }}
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
                                if (col.field === 'nama') val = 'GRAND TOTAL';
                                if (col.field === 'no') val = '';
                                if (typeof val === 'number') val = formatNumber(val);
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

