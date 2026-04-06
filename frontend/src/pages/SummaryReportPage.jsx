/**
 * SummaryReportPage - Display aggregation summary from daftar_upah_aggregation_history
 * Professional Financial Report "Paper View" Style
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Printer, RefreshCw, ArrowLeft, Save, Download } from 'lucide-react';
import { fetchDivisionSummary, fetchAvailablePeriods, fetchDivisionsWithData, fetchVirtualDivisions, validateAggregation, seedAggregation, updateGangCell } from '../services/summaryReportService';
import { generatePDF } from '../utils/pdfGenerator';
import AggregationSeederModal from '../components/AggregationSeederModal';
import PrintSignature from '../components/common/PrintSignature';
import { otherIncomesService } from '../services/otherIncomesService';
import '../styles/wages-summary-professional.css';
import '../styles/print-optimization.css';

// Company information by division
const COMPANY_INFO = {
    IJL: {
        name: 'PT. IMPIAN JAYA LESTARI',
        logo: '/images/ijl-logo.png',
        logoFallback: '/images/rebinmas.webp'
    },
    DEFAULT: {
        name: 'PT. REBINMAS JAYA',
        logo: '/images/rebinmas.webp',
        logoFallback: '/images/rebinmas.webp'
    }
};

// Helper function to get company info based on division
const getCompanyInfo = (division) => {
    return COMPANY_INFO[division] || COMPANY_INFO.DEFAULT;
};

// Helper function to format numbers with Indonesian locale
const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(num));
};

// Editable cell component for inline editing
function EditableCell({ editMode, value, onSave, isCurrency }) {
    const [editing, setEditing] = useState(false);
    const [inputVal, setInputVal] = useState(String(value || 0));
    const inputRef = useRef(null);

    useEffect(() => {
        if (!editing) setInputVal(String(value || 0));
    }, [value, editing]);

    const handleDoubleClick = () => {
        if (editMode) {
            setEditing(true);
            setTimeout(() => inputRef.current?.select(), 50);
        }
    };

    const handleBlur = () => {
        setEditing(false);
        const num = parseFloat(inputVal) || 0;
        if (num !== Number(value)) {
            onSave(num);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setInputVal(String(value || 0));
            setEditing(false);
        }
    };

    if (editMode) {
        return (
            <td
                className={`text-right ${isCurrency && Number(value) > 0 ? 'val-positive' : !Number(value) ? 'val-zero' : ''}`}
                style={{ fontWeight: isCurrency ? 600 : 400, cursor: 'text', backgroundColor: editing ? '#fffbeb' : '#f0f9ff' }}
                onDoubleClick={handleDoubleClick}
            >
                {editing ? (
                    <input
                        ref={inputRef}
                        type="number"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'right',
                            fontSize: 'inherit',
                            fontFamily: 'inherit',
                            color: 'inherit',
                            outline: 'none'
                        }}
                        autoFocus
                    />
                ) : (
                    <span style={{ color: '#1e40af', fontSize: '11px', opacity: 0.7 }}>{formatNumber(value)} ✏️</span>
                )}
            </td>
        );
    }

    return (
        <td className={`text-right ${isCurrency && Number(value) > 0 ? 'val-positive' : !Number(value) ? 'val-zero' : ''}`} style={{ fontWeight: isCurrency ? 600 : 400 }}>
            {formatNumber(value)}
        </td>
    );
}

export default function SummaryReportPage({ onBack, initialDivision, initialMonth, initialYear }) {
    const { token, user } = useAuth();

    // Filters - Use initial props if provided
    const [division, setDivision] = useState(initialDivision || '');
    const [month, setMonth] = useState(initialMonth || 11);  // Default to 11
    const [year, setYear] = useState(initialYear || new Date().getFullYear());
    const [reportMode, setReportMode] = useState('payroll'); // 'payroll' or 'thr'
    const [divisionType, setDivisionType] = useState('all'); // 'all', 'real', or 'virtual'

    // Sync state with props when they change (fix navigation freeze)
    useEffect(() => {
        if (initialDivision !== undefined) setDivision(initialDivision);
        if (initialMonth !== undefined) setMonth(initialMonth);
        if (initialYear !== undefined) setYear(initialYear);
    }, [initialDivision, initialMonth, initialYear]);

    // Get company info for current division
    const companyInfo = useMemo(() => getCompanyInfo(division), [division]);

    // Data
    const [divisions, setDivisions] = useState([]);
    const [virtualDivisions, setVirtualDivisions] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    const [gangDescriptions, setGangDescriptions] = useState({});
    const [grandTotal, setGrandTotal] = useState(null);
    const [filteredHeaders, setFilteredHeaders] = useState([]);
    const [groupFilter, setGroupFilter] = useState(''); // Group / Asistensi filter

    // State
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editedCells, setEditedCells] = useState({}); // { `${gang_code}_${field}`: value }

    // Helper to extract Asistensi (Group)
    // Rule: K2 gangs belong to Group 1 (special estate classification).
    // For all other gangs, extract the first digit found in the gang code.
    const getAsistensi = useCallback((gc, div) => {
        if (!gc) return null;
        const g = gc.trim().toUpperCase();
        // K2 gangs belong to Group 1 (special classification)
        if (g.startsWith('K2')) return '1';
        // Find the first digit in the string for other patterns (e.g., A1H → '1', K1H → '1')
        const match = g.match(/\d/);
        return match ? match[0] : null;
    }, []);

    // Handle inline edit of cell value
    const handleCellEdit = useCallback((gangCode, field, newValue) => {
        const editKey = `${gangCode}_${field}`;
        const numValue = parseFloat(newValue) || 0;
        setEditedCells(prev => ({
            ...prev,
            [editKey]: numValue
        }));
    }, []);

    // Calculate available groups for filter
    const availableGroups = useMemo(() => {
        const groups = new Set();
        summaryData.forEach(row => {
            const asist = getAsistensi(row.gang_code, division);
            if (asist) groups.add(asist);
        });
        return Array.from(groups).sort((a, b) => Number(a) - Number(b));
    }, [summaryData, division, getAsistensi]);

    // Merge summary data with gang descriptions
    const mergedSummaryData = useMemo(() => {
        return summaryData.map(row => {
            // Apply edited values if any
            const editableFields = ['total_upah_bersih', 'total_premi', 'total_lembur', 'total_pph21', 'total_spsi', 'total_employees', 'total_hk'];
            const editedRow = { ...row };
            editableFields.forEach(field => {
                const editKey = `${row.gang_code}_${field}`;
                if (editedCells[editKey] !== undefined) {
                    editedRow[field] = editedCells[editKey];
                }
            });
            return {
                ...editedRow,
                // Use real-time gang description if available, otherwise use stored description, fallback to gang_code
                gang_description: gangDescriptions[row.gang_code] || row.gang_description || row.gang_code
            };
        });
    }, [summaryData, gangDescriptions, editedCells]);

    // Filter summary data by group
    const filteredSummaryData = useMemo(() => {
        if (!groupFilter) return mergedSummaryData;
        return mergedSummaryData.filter(row => getAsistensi(row.gang_code, division) === groupFilter);
    }, [mergedSummaryData, groupFilter, division, getAsistensi]);

    // Recalculate Grand Total based on filtered data (always recalculate to include edited values)
    const filteredGrandTotal = useMemo(() => {
        if (!filteredSummaryData.length) return null;

        const totals = {
            total_employees: 0,
            total_hk: 0,
            total_premi: 0,
            total_lembur: 0,
            total_pph21: 0,
            total_spsi: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_premi_prunning: 0,
            total_upah_bersih: 0,
            dynamic_premi_totals: {}
        };

        filteredSummaryData.forEach(row => {
            totals.total_employees += Number(row.total_employees || 0);
            totals.total_hk += Number(row.total_hk || 0);
            totals.total_premi += Number(row.total_premi || 0);
            totals.total_lembur += Number(row.total_lembur || 0);
            totals.total_pph21 += Number(row.total_pph21 || 0);
            totals.total_spsi += Number(row.total_spsi || 0);
            totals.total_premi_insentif += Number(row.total_premi_insentif || 0);
            totals.total_premi_kinerja += Number(row.total_premi_kinerja || 0);
            totals.total_premi_prunning += Number(row.total_premi_prunning || 0);
            totals.total_upah_bersih += Number(row.total_upah_bersih || 0);

            // Handle dynamic premiums if present
            if (row._dynamic_premi_list) {
                row._dynamic_premi_list.forEach(dp => {
                    const h = dp.header;
                    totals.dynamic_premi_totals[h] = (totals.dynamic_premi_totals[h] || 0) + Number(dp.total || 0);
                });
            }
        });

        return totals;
    }, [filteredSummaryData]);
    const [error, setError] = useState('');
    const [showSeederModal, setShowSeederModal] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [seedingProgress, setSeedingProgress] = useState(null);
    const [validating, setValidating] = useState(false);
    const [validationResult, setValidationResult] = useState(null);
    const [showValidation, setShowValidation] = useState(false);

    // Load gang descriptions (real-time from HR_GANG)
    useEffect(() => {
        async function loadGangDescriptions() {
            if (!token) return;
            try {
                const response = await fetch('/payroll/summary/gang-descriptions', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const result = await response.json();
                if (result.success) {
                    setGangDescriptions(result.descriptions || {});
                }
            } catch (e) {
                console.error('Failed to load gang descriptions:', e);
            }
        }
        loadGangDescriptions();
    }, [token]);


    useEffect(() => {
        async function loadDivisions() {
            if (!token) return;
            try {
                const result = await fetchDivisionsWithData(token);
                setDivisions(result.divisions || []);
            } catch (e) {
                console.error('Failed to load divisions:', e);
            }
        }
        loadDivisions();
    }, [token]);

    // Load virtual divisions
    useEffect(() => {
        async function loadVirtualDivisions() {
            if (!token) return;
            try {
                const result = await fetchVirtualDivisions(token);
                setVirtualDivisions(result.divisions || []);
            } catch (e) {
                console.error('Failed to load virtual divisions:', e);
            }
        }
        loadVirtualDivisions();
    }, [token]);

    // Load available periods when division changes
    useEffect(() => {
        async function loadPeriods() {
            if (!token) return;
            try {
                const result = await fetchAvailablePeriods(token, division || null);
                setPeriods(result.periods || []);
            } catch (e) {
                console.error('Failed to load periods:', e);
            }
        }
        loadPeriods();
    }, [token, division]);

    // Fetch summary data
    const fetchData = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError('');

        try {
            if (reportMode === 'thr') {
                const result = await otherIncomesService.getThrSummary(year, month, division);
                if (result.success !== false) { // the backend returns success: true or error
                    setSummaryData(result.data || []);
                    setGrandTotal(result.grand_total || null);
                    setFilteredHeaders([]); // not needed for THR
                } else {
                    setError('Failed to fetch THR summary data');
                }
            } else {
                const result = await fetchDivisionSummary(token, {
                    division: division || undefined,
                    month: month || undefined,
                    year: year || undefined,
                    includeVirtual: divisionType !== 'real' // 'all' or 'virtual' -> true
                });

                if (result.success) {
                    setSummaryData(result.data || []);
                    setGrandTotal(result.grand_total || null);

                    // [FIX] Remove duplicate headers (especially 'brondol')
                    const rawHeaders = result.filtered_headers || [];
                    const uniqueHeaders = [];
                    const seen = new Set();
                    for (const header of rawHeaders) {
                        const normalized = header.toLowerCase().trim();
                        if (!seen.has(normalized)) {
                            seen.add(normalized);
                            uniqueHeaders.push(header);
                        }
                    }
                    setFilteredHeaders(uniqueHeaders);
                } else {
                    setError('Failed to fetch summary data');
                }
            }
        } catch (e) {
            console.error('Error fetching summary:', e);
            setError(e.message || 'Failed to fetch summary data');
        } finally {
            setLoading(false);
        }
    }, [token, division, month, year, reportMode, divisionType]);

    // Handle saving all edited cells
    const handleSaveEdits = useCallback(async () => {
        if (!token || Object.keys(editedCells).length === 0) return;

        setLoading(true);
        setError('');

        try {
            const editEntries = Object.entries(editedCells);
            const totalEdits = editEntries.length;
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < editEntries.length; i++) {
                const [editKey, value] = editEntries[i];
                
                // Find the first underscore to extract gang_code
                const firstUnderscore = editKey.indexOf('_');
                if (firstUnderscore === -1) {
                    console.error(`Invalid edit key format: ${editKey}`);
                    errorCount++;
                    continue;
                }
                
                const gangCode = editKey.substring(0, firstUnderscore);
                const fullField = editKey.substring(firstUnderscore + 1);

                try {
                    const result = await updateGangCell(token, {
                        month,
                        year,
                        gang_code: gangCode,
                        field: fullField,
                        value
                    });

                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error(`Failed to update ${editKey}:`, result.error);
                    }
                } catch (err) {
                    errorCount++;
                    console.error(`Error updating ${editKey}:`, err);
                }
            }

            if (errorCount === 0) {
                // All edits successful - refresh data and clear edited cells
                setEditedCells({});
                setEditMode(false);
                await fetchData();
            } else {
                setError(`Saved ${successCount}/${totalEdits} edits. ${errorCount} failed.`);
            }
        } catch (e) {
            console.error('Error saving edits:', e);
            setError('Failed to save edits: ' + e.message);
        } finally {
            setLoading(false);
        }
    }, [token, editedCells, month, year, fetchData]);

    // Fetch data when filters change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle Seed All - uses EXACT same data as UI
    const handleSeedAll = async () => {
        if (!token) return;
        if (!window.confirm(`Seed data PERSIS seperti yang tampil di UI untuk ${month}/${year}?`)) return;
        
        setIsSeeding(true);
        setSeedingProgress('🔄 Mengekstrak data dari UI...');
        
        try {
            // Use seed-ui endpoint with EXACT same parameters as current UI view
            const response = await fetch('/payroll/aggregation/seed-ui', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    division: division || 'ALL',
                    month,
                    year,
                    gangCode: null,  // ALL gangs in division
                    gangPrefix: null  // ALL groups
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const gangCount = result.data?.total_gangs || 0;
                const empCount = result.data?.total_employees || 0;
                setSeedingProgress(`✅ Seeding berhasil! ${gangCount} gangs, ${empCount} karyawan`);
                
                // Show breakdown
                if (result.data?.results) {
                    console.log('Seeded gangs:');
                    result.data.results.forEach(r => {
                        console.log(`  ${r.gang_code}: ${r.upah_bersih.toLocaleString('id-ID')}`);
                    });
                }
                
                // Refresh data setelah seeding
                setTimeout(() => {
                    fetchData();
                    setSeedingProgress(null);
                }, 2000);
            } else {
                setSeedingProgress(`❌ Gagal: ${result.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error('UI Seed error:', e);
            setSeedingProgress(`❌ Error: ${e.message}`);
        } finally {
            setIsSeeding(false);
        }
    };

    // Handle Validation
    const handleValidate = async () => {
        setValidating(true);
        setShowValidation(true);
        setValidationResult(null);

        try {
            const result = await validateAggregation(token, {
                month,
                year,
                division: division || undefined
            });

            if (result.success) {
                setValidationResult(result);
            } else {
                setError('Failed to validate aggregation: ' + (result.error || 'Unknown error'));
            }
        } catch (e) {
            console.error('Error validating aggregation:', e);
            setError(e.message || 'Failed to validate aggregation');
        } finally {
            setValidating(false);
        }
    };

    const getMonthName = (m) => {
        const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return months[m] || '';
    };

    const periodLabel = `${getMonthName(month)} ${year}`;
    const printDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    // Use filtered headers from backend
    const dynamicPremiHeaders = filteredHeaders;

    // Helper function to get dynamic premi value from a row
    const getDynamicPremiValue = useCallback((row, headerName) => {
        if (!row._dynamic_premi_list || !Array.isArray(row._dynamic_premi_list)) return 0;
        const item = row._dynamic_premi_list.find(
            p => p.header && p.header.toLowerCase() === headerName.toLowerCase()
        );
        return item ? parseFloat(item.total || 0) : 0;
    }, []);

    // Handle Save PDF
    const handleSavePDF = () => {
        const element = document.getElementById('summary-report-content');
        const filename = `Summary_Report_${division || 'ALL'}_${month}_${year}.pdf`;
        generatePDF(element, filename);
    };

    // Handle Print
    const handlePrint = () => window.print();

    // Handle Export CSV
    const handleExport = () => {
        if (reportMode === 'thr') {
            let header = `Gang,Workers,Total THR\n`;
            let csv = header;

            mergedSummaryData.forEach(row => {
                csv += `"${row.gang_description || row.gang_code}",` +
                    `${row.total_employees || 0},` +
                    `${row.total_thr || 0}\n`;
            });

            if (grandTotal) {
                csv += `"GRAND TOTAL",` +
                    `${grandTotal.total_employees || 0},` +
                    `${grandTotal.total_thr || 0}\n`;
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Summary_THR_${division || 'ALL'}_${month}_${year}.csv`;
            link.click();
            return;
        }

        let header = `Gang,Workers,HK Checkroll,${dynamicPremiHeaders.join(',')},Total Premi,Lembur,PPH 21,SPSI,Total Upah Bersih\n`;
        let csv = header;

        mergedSummaryData.forEach(row => {
            const premis = dynamicPremiHeaders.map(h => getDynamicPremiValue(row, h) || 0).join(',');

            csv += `"${row.gang_description || row.gang_code}",` +
                `${row.total_employees || 0},` +
                `${row.total_hk || 0},` +
                `${premis},` +
                `${row.total_premi || 0},` +
                `${row.total_lembur || 0},` +
                `${row.total_pph21 || 0},` +
                `${row.total_spsi || 0},` +
                `${row.total_upah_bersih || 0}\n`;
        });

        if (grandTotal) {
            // Use dynamic_premi_totals from backend grand total
            const premis = dynamicPremiHeaders.map(h =>
                (grandTotal.dynamic_premi_totals?.[h] || 0)
            ).join(',');
            csv += `"GRAND TOTAL",` +
                `${grandTotal.total_employees},` +
                `${grandTotal.total_hk},` +
                `${premis},` +
                `${grandTotal.total_premi},` +
                `${grandTotal.total_lembur},` +
                `${grandTotal.total_pph21},` +
                `${grandTotal.total_spsi},` +
                `${grandTotal.total_upah_bersih}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Summary_Detail_${division || 'ALL'}_${month}_${year}.csv`;
        link.click();
    };

    return (
        <div className="wsp-container" style={{ padding: '1.5rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {/* Header & Actions */}
            <div className="report-header-web no-print">
                {/* Top: Title + Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <div className="report-header-info" style={{ flex: 1, minWidth: '200px' }}>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>Summary Report Detail</h1>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>{reportMode === 'thr' ? 'Rekapitulasi total pekerja dan pendapatan THR per estate/gang.' : 'Rekapitulasi total pekerja, HK, premi, dan upah bersih per estate/gang.'}</p>
                    </div>
                    <div className="report-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                        <button onClick={handlePrint} className="wsp-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}>
                            <Printer size={16} /> Cetak
                        </button>
                        <button onClick={handleExport} className="wsp-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }} disabled={loading || summaryData.length === 0}>
                            <Download size={16} /> Export
                        </button>
                        <button onClick={() => setShowSeederModal(true)} className="wsp-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                            <RefreshCw size={16} /> Sync
                        </button>
                        <button
                            onClick={() => setEditMode(prev => !prev)}
                            className="wsp-btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem', backgroundColor: editMode ? '#dbeafe' : '#f3f4f6', color: editMode ? '#1e40af' : '#374151', borderColor: editMode ? '#93c5fd' : '#d1d5db' }}
                        >
                            {editMode ? '✓ Selesai' : '✏️ Edit'}
                        </button>
                    </div>
                </div>

                {/* Bottom: Filter Controls */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Mode</label>
                        <select
                            value={reportMode}
                            onChange={e => setReportMode(e.target.value)}
                            className="wsp-btn-secondary"
                            style={{ cursor: 'pointer', outline: 'none', backgroundColor: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', height: '36px', minWidth: '110px' }}
                        >
                            <option value="payroll">Payroll</option>
                            <option value="thr">THR</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Tipe Divisi</label>
                        <select
                            value={divisionType}
                            onChange={e => {
                                setDivisionType(e.target.value);
                                setDivision('');
                                setGroupFilter('');
                            }}
                            className="wsp-btn-secondary"
                            style={{ cursor: 'pointer', outline: 'none', backgroundColor: divisionType === 'virtual' ? '#fef3c7' : divisionType === 'real' ? '#eef2ff' : '#dcfce7', color: divisionType === 'virtual' ? '#92400e' : divisionType === 'real' ? '#4f46e5' : '#166534', borderColor: divisionType === 'virtual' ? '#fde68a' : divisionType === 'real' ? '#c7d2fe' : '#86efac', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px', height: '36px', minWidth: '120px' }}
                        >
                            <option value="all">Semua</option>
                            <option value="real">Utama</option>
                            <option value="virtual">Virtual</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Divisi</label>
                        <select
                            value={division}
                            onChange={e => {
                                setDivision(e.target.value);
                                setGroupFilter('');
                            }}
                            className="report-filter-badge"
                            style={{ cursor: 'pointer', outline: 'none', padding: '6px 12px', borderRadius: '6px', height: '36px', minWidth: '130px', backgroundColor: '#f8fafc', border: '1px solid #d1d5db' }}
                        >
                            <option value="">Semua</option>
                            {(divisionType === 'all' ? [...divisions, ...virtualDivisions] : divisionType === 'virtual' ? virtualDivisions : divisions).map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Group</label>
                        <select
                            value={groupFilter}
                            onChange={e => setGroupFilter(e.target.value)}
                            className="report-filter-badge"
                            style={{ cursor: 'pointer', outline: 'none', padding: '6px 12px', borderRadius: '6px', height: '36px', minWidth: '110px', backgroundColor: groupFilter ? '#e0f2fe' : '#f8fafc', borderColor: groupFilter ? '#7dd3fc' : '#d1d5db', border: '1px solid #d1d5db' }}
                        >
                            <option value="">Semua</option>
                            {availableGroups.map(g => (
                                <option key={g} value={g}>Group {g}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Periode</label>
                        <span className="report-filter-badge" style={{ padding: '6px 12px', borderRadius: '6px', height: '36px', display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #e2e8f0' }}>{getMonthName(month)} {year}</span>
                    </div>

                    {editMode && Object.keys(editedCells).length > 0 && (
                        <button
                            onClick={handleSaveEdits}
                            className="wsp-btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#10b981', color: '#fff', borderColor: '#059669', alignSelf: 'flex-end', height: '36px' }}
                            disabled={loading}
                        >
                            <Save size={16} /> Simpan ({Object.keys(editedCells).length})
                        </button>
                    )}
                </div>
            </div>

            {/* Seeding Progress */}
            {seedingProgress && (
                <div style={{ margin: '0 1rem 1rem', padding: '1rem', backgroundColor: seedingProgress.includes('✅') ? '#d1fae5' : seedingProgress.includes('❌') ? '#fee2e2' : '#fef3c7', border: `1px solid ${seedingProgress.includes('✅') ? '#10b981' : seedingProgress.includes('❌') ? '#ef4444' : '#f59e0b'}`, borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600', color: seedingProgress.includes('✅') ? '#065f46' : seedingProgress.includes('❌') ? '#991b1b' : '#92400e' }}>{seedingProgress}</div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="wsp-loading"><div className="wsp-spinner"></div>Loading...</div>
            ) : error ? (
                <div className="wsp-error">! {error}</div>
            ) : (
                <div className="wsp-document" id="summary-report-content">
                    {/* Standardized Professional Header (3-Column Layout) */}
                    <div className="wsp-report-header">
                        {/* Left Section: Logo */}
                        <div className="wsp-logo-section">
                            <img
                                src={companyInfo.logo}
                                alt={companyInfo.name}
                                className="wsp-logo"
                                onError={(e) => {
                                    if (companyInfo.logoFallback) e.target.src = companyInfo.logoFallback;
                                }}
                            />
                        </div>

                        {/* Center Section: Company & Report Title */}
                        <div className="wsp-title-section">
                            <h1 className="wsp-company-name">{companyInfo.name}</h1>
                            <h2 className="wsp-report-title">
                                {reportMode === 'thr' ? 'SUMMARY REPORT TUNJANGAN HARI RAYA' : 'SUMMARY REPORT DETAIL'}
                            </h2>
                        </div>

                        {/* Right Section: Metadata */}
                        <div className="wsp-meta-section">
                            <div className="wsp-meta-row">
                                <span className="wsp-meta-label">Division:</span>
                                <span className="wsp-meta-value">{division || 'ALL'}</span>
                            </div>
                            <div className="wsp-meta-row">
                                <span className="wsp-meta-label">Period:</span>
                                <span className="wsp-meta-value">{periodLabel}</span>
                            </div>
                            <div className="wsp-meta-row">
                                <span className="wsp-meta-label">Total Geng:</span>
                                <span className="wsp-meta-value">{filteredSummaryData.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    {filteredGrandTotal && (
                        <div className="wsp-kpi-grid">
                            <div className="wsp-kpi-card">
                                <div className="wsp-kpi-label">TOTAL WORKERS</div>
                                <div className="wsp-kpi-value">{formatNumber(filteredGrandTotal?.total_employees || 0)}</div>
                            </div>
                            {reportMode === 'payroll' ? (
                                <>
                                    <div className="wsp-kpi-card">
                                        <div className="wsp-kpi-label">TOTAL HK CHEKROLL</div>
                                        <div className="wsp-kpi-value">{formatNumber(filteredGrandTotal?.total_hk || 0)}</div>
                                    </div>
                                    <div className="wsp-kpi-card secondary">
                                        <div className="wsp-kpi-label">TOTAL PREMI</div>
                                        <div className="wsp-kpi-value">Rp {formatNumber(filteredGrandTotal?.total_premi || 0)}</div>
                                    </div>
                                    <div className="wsp-kpi-card highlight">
                                        <div className="wsp-kpi-label">TOTAL UPAH BERSIH</div>
                                        <div className="wsp-kpi-value">Rp {formatNumber(filteredGrandTotal?.total_upah_bersih || 0)}</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="wsp-kpi-card">
                                        <div className="wsp-kpi-label">PEKERJA FULL (12/12)</div>
                                        <div className="wsp-kpi-value">{formatNumber(filteredGrandTotal?.full_workers || 0)}</div>
                                    </div>
                                    <div className="wsp-kpi-card secondary">
                                        <div className="wsp-kpi-label">PEKERJA PROPORSI</div>
                                        <div className="wsp-kpi-value">{formatNumber(filteredGrandTotal?.prop_workers || 0)}</div>
                                    </div>
                                    <div className="wsp-kpi-card highlight">
                                        <div className="wsp-kpi-label">TOTAL THR</div>
                                        <div className="wsp-kpi-value">Rp {formatNumber(filteredGrandTotal?.total_thr || 0)}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Table */}
                    <div className="wsp-table-wrapper">
                        <table className="wsp-table">
                            <thead>
                                {reportMode === 'payroll' ? (
                                    <>
                                        <tr className="wsp-header-master">
                                            <th rowSpan="2" style={{ minWidth: '300px', width: '300px' }}>ESTATE / GANG</th>
                                            <th colSpan="2">MANPOWER</th>
                                            {/* Simplified PREMI INCOME (Hidden detail breakdown per request) */}
                                            <th style={{ width: '120px' }}>PREMI INCOME</th>
                                            <th rowSpan="2" style={{ width: '120px' }}>LEMBUR</th>
                                            <th colSpan="2">DEDUCTIONS</th>
                                            <th rowSpan="2" style={{ width: '140px' }}>TOTAL UPAH BERSIH</th>
                                        </tr>
                                        <tr className="wsp-header-sub">
                                            {/* Manpower */}
                                            <th style={{ width: '60px' }}>WORKERS</th>
                                            <th style={{ width: '60px' }}>HK</th>

                                            <th style={{ width: '120px', background: '#334155', color: 'white' }}>TOTAL PREMI</th>

                                            {/* Deductions */}
                                            <th style={{ width: '90px' }}>PPH 21</th>
                                            <th style={{ width: '90px' }}>SPSI</th>
                                        </tr>
                                    </>
                                ) : (
                                    <tr className="wsp-header-master" style={{ backgroundColor: '#000', color: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                        <th style={{ minWidth: '300px', width: '300px', textAlign: 'left', border: '1.5pt solid #000', fontWeight: 800 }}>ESTATE / GANG</th>
                                        <th style={{ width: '80px', textAlign: 'right', border: '1.5pt solid #000', fontWeight: 800 }}>WORKERS</th>
                                        <th style={{ width: '80px', textAlign: 'right', border: '1.5pt solid #000', fontWeight: 800 }}>FULL</th>
                                        <th style={{ width: '80px', textAlign: 'right', border: '1.5pt solid #000', fontWeight: 800 }}>PROPORSI</th>
                                        <th style={{ width: '140px', textAlign: 'right', border: '1.5pt solid #000', fontWeight: 800 }}>TUNJ. BERAS</th>
                                        <th style={{ width: '140px', textAlign: 'right', border: '1.5pt solid #000', fontWeight: 800 }}>MASA KERJA</th>
                                        <th style={{ width: '160px', textAlign: 'right', border: '1.5pt solid #000', fontWeight: 800 }}>TOTAL THR</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {filteredSummaryData.length === 0 ? (
                                    <tr><td colSpan="15" className="text-center" style={{ padding: '3rem' }}>No Data Available</td></tr>
                                ) : (
                                    filteredSummaryData.map((row, idx) => (
                                        reportMode === 'payroll' ? (
                                            <tr key={idx}>
                                                <td className="text-left">{row.gang_description || row.gang_code}</td>
                                                <EditableCell editMode={editMode} value={row.total_employees} onSave={(v) => handleCellEdit(row.gang_code, 'total_employees', v)} />
                                                <EditableCell editMode={editMode} value={row.total_hk} onSave={(v) => handleCellEdit(row.gang_code, 'total_hk', v)} />

                                                {/* Total Premi - Simplified view without breakdown */}
                                                <td className={`text-right ${!Number(row.total_premi) && 'val-zero'}`} style={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>
                                                    {formatNumber(row.total_premi)}
                                                </td>

                                                <EditableCell editMode={editMode} value={row.total_lembur} onSave={(v) => handleCellEdit(row.gang_code, 'total_lembur', v)} />
                                                <EditableCell editMode={editMode} value={row.total_pph21} onSave={(v) => handleCellEdit(row.gang_code, 'total_pph21', v)} />
                                                <EditableCell editMode={editMode} value={row.total_spsi} onSave={(v) => handleCellEdit(row.gang_code, 'total_spsi', v)} />

                                                <EditableCell editMode={editMode} value={row.total_upah_bersih} onSave={(v) => handleCellEdit(row.gang_code, 'total_upah_bersih', v)} isCurrency />
                                            </tr>
                                        ) : (
                                            <tr key={idx} style={{ borderBottom: '1pt solid #000', backgroundColor: idx % 2 === 0 ? '#fff' : '#f2f2f2', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                <td className="text-left" style={{ border: '0.5pt solid #000', fontWeight: 600 }}>{row.gang_description || row.gang_code}</td>
                                                <td className={`text-right ${!Number(row.total_employees) && 'val-zero'}`} style={{ border: '0.5pt solid #000' }}>{formatNumber(row.total_employees)}</td>
                                                <td className={`text-right ${!Number(row.full_workers) && 'val-zero'}`} style={{ border: '0.5pt solid #000' }}>{formatNumber(row.full_workers)}</td>
                                                <td className={`text-right ${!Number(row.prop_workers) && 'val-zero'}`} style={{ border: '0.5pt solid #000' }}>{formatNumber(row.prop_workers)}</td>
                                                <td className={`text-right ${!Number(row.total_tunjangan_beras) && 'val-zero'}`} style={{ border: '0.5pt solid #000' }}>{formatNumber(row.total_tunjangan_beras)}</td>
                                                <td className={`text-right ${!Number(row.total_masa_kerja) && 'val-zero'}`} style={{ border: '0.5pt solid #000' }}>{formatNumber(row.total_masa_kerja)}</td>
                                                <td className={`text-right ${!Number(row.total_thr) ? 'val-zero' : 'val-positive'}`} style={{ fontWeight: 700, border: '0.5pt solid #000' }}>
                                                    {formatNumber(row.total_thr)}
                                                </td>
                                            </tr>
                                        )
                                    ))
                                )}
                            </tbody>

                            {filteredGrandTotal && (
                                <tfoot>
                                    {reportMode === 'payroll' ? (
                                        <tr className="wsp-grand-total">
                                            <td>{groupFilter ? `TOTAL GROUP ${groupFilter}` : 'GRAND TOTAL'}</td>
                                            <td className="text-right">{formatNumber(filteredGrandTotal.total_employees)}</td>
                                            <td className="text-right">{formatNumber(filteredGrandTotal.total_hk)}</td>

                                            {/* Total Premi - Grand Total */}
                                            <td className="text-right" style={{ background: '#1e293b', color: 'white', fontWeight: 800 }}>{formatNumber(filteredGrandTotal.total_premi)}</td>

                                            <td className="text-right">{formatNumber(filteredGrandTotal.total_lembur)}</td>
                                            <td className="text-right">{formatNumber(filteredGrandTotal.total_pph21)}</td>
                                            <td className="text-right">{formatNumber(filteredGrandTotal.total_spsi)}</td>

                                            <td className="text-right" style={{ color: '#4ade80' }}>{formatNumber(filteredGrandTotal.total_upah_bersih)}</td>
                                        </tr>
                                    ) : (
                                        <tr className="wsp-grand-total" style={{ backgroundColor: '#000', color: '#fff', fontWeight: 800, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <td style={{ border: '1.5pt solid #000' }}>{groupFilter ? `TOTAL GROUP ${groupFilter}` : 'GRAND TOTAL'}</td>
                                            <td className="text-right" style={{ border: '1.5pt solid #000' }}>{formatNumber(filteredGrandTotal.total_employees)}</td>
                                            <td className="text-right" style={{ border: '1.5pt solid #000' }}>{formatNumber(filteredGrandTotal.full_workers)}</td>
                                            <td className="text-right" style={{ border: '1.5pt solid #000' }}>{formatNumber(filteredGrandTotal.prop_workers)}</td>
                                            <td className="text-right" style={{ border: '1.5pt solid #000' }}>{formatNumber(filteredGrandTotal.total_tunjangan_beras)}</td>
                                            <td className="text-right" style={{ border: '1.5pt solid #000' }}>{formatNumber(filteredGrandTotal.total_masa_kerja)}</td>
                                            <td className="text-right" style={{ border: '1.5pt solid #000' }}>{formatNumber(filteredGrandTotal.total_thr)}</td>
                                        </tr>
                                    )}
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Signature Section */}
                    <div className="print-only">
                        <PrintSignature />
                    </div>

                    {/* Report Footer */}
                    <footer className="wsp-footer" style={{ marginTop: '4rem' }}>
                        <div className="wsp-footer-left">
                            <div>Dicetak: {printDate}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>User: {user?.username}</div>
                        </div>
                        <div className="wsp-footer-right">
                            {companyInfo.name}
                        </div>
                    </footer>
                </div>
            )
            }

            {/* Validation Results Modal */}
            {showValidation && validationResult && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '8px',
                        maxWidth: '800px', maxHeight: '80vh', overflow: 'auto',
                        padding: '20px', margin: '20px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Aggregation Validation Results</h2>
                            <button onClick={() => setShowValidation(false)} style={{
                                background: 'none', border: 'none', fontSize: '24px',
                                cursor: 'pointer', color: '#666'
                            }}>&times;</button>
                        </div>

                        <div style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>
                            Period: {getMonthName(month)} {year} | Division: {division || 'ALL'}
                        </div>

                        {/* Division Summaries */}
                        {validationResult.division_summaries && validationResult.division_summaries.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ marginTop: 0 }}>Division Totals Comparison</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Division</th>
                                            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Stored Aggregation</th>
                                            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Real-Time Payroll</th>
                                            <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Difference</th>
                                            <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validationResult.division_summaries.map((div, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{div.division_code}</td>
                                                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                                                    {formatNumber(div.stored_aggregation_total)}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                                                    {formatNumber(div.real_time_payroll_total)}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', color: Math.abs(div.difference) > 1 ? '#ef4444' : '#10b981' }}>
                                                    {formatNumber(div.difference)}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd' }}>
                                                    {div.is_match ? (
                                                        <span style={{ backgroundColor: '#10b981', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                                            ✓ MATCH
                                                        </span>
                                                    ) : (
                                                        <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                                            ✗ MISMATCH
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Discrepancies */}
                        {validationResult.discrepancies_found > 0 ? (
                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ marginTop: 0, color: '#ef4444' }}>
                                    Discrepancies Found ({validationResult.discrepancies_found})
                                </h3>
                                <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    {validationResult.discrepancies.slice(0, 20).map((disc, idx) => (
                                        <div key={idx} style={{
                                            padding: '10px', borderBottom: '1px solid #ddd',
                                            fontSize: '13px'
                                        }}>
                                            <div><strong>{disc.division_code} - {disc.gang_code}</strong></div>
                                            <div style={{ color: '#666', marginTop: '4px' }}>
                                                Status: <span style={{ color: '#ef4444' }}>{disc.status}</span>
                                            </div>
                                            {disc.field_discrepancies && (
                                                <div style={{ marginTop: '6px', fontSize: '12px' }}>
                                                    {Object.entries(disc.field_discrepancies).map(([field, values]) => (
                                                        <div key={field} style={{ marginLeft: '10px', marginTop: '4px' }}>
                                                            <strong>{field}:</strong> Stored={formatNumber(values.stored)}, Real-Time={formatNumber(values.real_time)}, Diff={formatNumber(values.difference)}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {disc.message && (
                                                <div style={{ marginTop: '4px', color: '#666', fontStyle: 'italic' }}>
                                                    {disc.message}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {validationResult.discrepancies.length > 20 && (
                                        <div style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
                                            ... and {validationResult.discrepancies_found - 20} more discrepancies
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '13px' }}>
                                    <strong>⚠️ Recommendation:</strong> If discrepancies are found, click "Seed Aggregation" to refresh the aggregation data with current payroll data.
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#d1fae5', borderRadius: '4px', textAlign: 'center' }}>
                                <span style={{ fontSize: '18px', marginRight: '10px' }}>✓</span>
                                <strong>All aggregations match real-time payroll data!</strong>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowValidation(false)} style={{
                                padding: '10px 20px', borderRadius: '4px', border: '1px solid #ddd',
                                backgroundColor: 'white', cursor: 'pointer'
                            }}>
                                Close
                            </button>
                            {!validationResult.division_summaries?.every(d => d.is_match) && (
                                <button onClick={() => {
                                    setShowValidation(false);
                                    setShowSeederModal(true);
                                }} style={{
                                    padding: '10px 20px', borderRadius: '4px', border: 'none',
                                    backgroundColor: '#fbbf24', color: '#78350f', cursor: 'pointer', fontWeight: 'bold'
                                }}>
                                    Re-Seed Aggregation
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Aggregation Seeder Modal */}
            <AggregationSeederModal
                isOpen={showSeederModal}
                onClose={() => setShowSeederModal(false)}
                month={month}
                year={year}
                division={division}
                token={token}
            />
        </div >
    );
}
