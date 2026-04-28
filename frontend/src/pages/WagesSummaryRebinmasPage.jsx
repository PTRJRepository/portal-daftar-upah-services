/**
 * WagesSummaryRebinmasPage - Professional Wages Summary Report
 * Premium financial statement layout for PT. REBINMAS JAYA
 * No AG-Grid - uses custom HTML/CSS for print-ready output
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAllDivisionsTotals, fetchAvailablePeriods, fetchComparisonSummary, fetchVirtualDivisions, updatePPH21, updateSPSI } from '../services/summaryReportService';
import { fetchWagesRecapAll } from '../services/wagesService';
import { otherIncomesService } from '../services/otherIncomesService';
import { generatePDF } from '../utils/pdfGenerator';
import ImpactReportPage from './ImpactReportPage';
import PrintModeSelector from '../components/common/PrintModeSelector';
import PrintSignature from '../components/common/PrintSignature';
import CompactPeriodScroll from '../components/common/CompactPeriodScroll';
import { initPrintMode } from '../utils/printOptimizer';
import '../styles/wages-summary-professional.css';
import '../styles/wages-summary-print-simple.css';

export default function WagesSummaryRebinmasPage({ onBack, initialMonth, initialYear }) {
    const { token, user } = useAuth();
    const [searchParams] = useSearchParams();

    // Filters - Use selected payroll period when provided
    const [month, setMonth] = useState(initialMonth || null);
    const [year, setYear] = useState(initialYear || null);
    const [divisionType, setDivisionType] = useState('all'); // 'all', 'real', or 'virtual'

    useEffect(() => {
        if (initialMonth) setMonth(initialMonth);
        if (initialYear) setYear(initialYear);
    }, [initialMonth, initialYear]);

    // Data
    const [periods, setPeriods] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    const [grandTotal, setGrandTotal] = useState(null);
    const [groupSubtotals, setGroupSubtotals] = useState({});
    const [kpiTotalsData, setKpiTotalsData] = useState(null);
    const [virtualDivisions, setVirtualDivisions] = useState([]);

    // Comparison State
    const [comparisonMode, setComparisonMode] = useState(searchParams.get('mode') === 'comparison');
    const [comparisonData, setComparisonData] = useState(null);
    const [comparisonGrandTotal, setComparisonGrandTotal] = useState(null);
    const [comparisonPremiBreakdown, setComparisonPremiBreakdown] = useState(null);

    // THR Mode State - Rekap Semua Divisi (tanpa thumbprint)
    const [thrMode, setThrMode] = useState(searchParams.get('mode') === 'thr');
    const [thrData, setThrData] = useState(null);
    const [thrIjlFilter, setThrIjlFilter] = useState('non-ijl'); // 'non-ijl' or 'ijl-only'

    // Sync modes if URL search params change
    useEffect(() => {
        const mode = searchParams.get('mode');
        setComparisonMode(mode === 'comparison');
        setThrMode(mode === 'thr');
    }, [searchParams]);

    // Impact Report State
    const [impactReportMode, setImpactReportMode] = useState(false);

    // Edit Mode State
    const [editMode, setEditMode] = useState(false);
    const [editingValues, setEditingValues] = useState({});
    const [editingPPH21, setEditingPPH21] = useState({});
    const [editingSPSI, setEditingSPSI] = useState({});

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // History DB mode - when ON, queries go to extend_db_ptrj instead of db_ptrj
    const [useHistory, setUseHistory] = useState(false);

    // Load available periods & Initialize print mode
    useEffect(() => {
        async function loadPeriods() {
            if (!token) return;
            try {
                const result = await fetchAvailablePeriods(token);
                setPeriods(result.periods || []);

                if (!initialMonth && !initialYear && result.default_period && result.default_period.month && result.default_period.year) {
                    setMonth(result.default_period.month);
                    setYear(result.default_period.year);
                }
            } catch (e) {
                console.error('Failed to load periods:', e);
            }
        }
        loadPeriods();

        // Initialize print mode for optimized printing
        initPrintMode();
    }, [token, initialMonth, initialYear]);

    // Fetch summary data
    const fetchData = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError('');

        try {
            if (comparisonMode) {
                const result = await fetchComparisonSummary(token, { month, year, useHistory, scope: 'rebinmas' });
                if (result.success) {
                    console.log('[WagesComparison] Comparison data received:', result);
                    console.log('[WagesComparison] Sample division data:', result.divisions?.[0]);
                    setComparisonData(result);
                    setComparisonGrandTotal(result.grand_total || null);
                    setComparisonPremiBreakdown(result.premi_breakdown_current || null);
                } else {
                    setError('Failed to fetch comparison data');
                }
            } else if (thrMode) {
                // THR Mode - Rekap Semua Divisi (tanpa thumbprint)
                // thrIjlFilter: 'non-ijl' = exclude IJL, 'ijl-only' = only IJL
                const excludeIjl = thrIjlFilter === 'non-ijl';
                const ijlOnly = thrIjlFilter === 'ijl-only';
                const result = await otherIncomesService.getThrRecapAll(year, month, excludeIjl, ijlOnly);
                if (result.success !== false) {
                    setThrData(result);
                } else {
                    setError('Failed to fetch THR recap data');
                }
            } else {
                const result = await fetchAllDivisionsTotals(token, { 
                    month, 
                    year, 
                    useHistory,
                    includeVirtual: divisionType !== 'real', // 'all' or 'virtual' -> true
                    scope: 'rebinmas'
                });
                if (result.success) {
                    setSummaryData(result.data || []);
                    setGrandTotal(result.grand_total || null);
                    setGroupSubtotals(result.group_subtotals || {});
                    setKpiTotalsData(result.kpi_totals || null);
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
    }, [token, month, year, comparisonMode, thrMode, thrIjlFilter, useHistory, divisionType]);

    // Handle Thumbprint Change
    const handleThumbprintChange = (divisionKey, value) => {
        setEditingValues(prev => ({
            ...prev,
            [divisionKey]: value
        }));
    };

    // Handle Save Thumbprint
    const handleSaveThumbprint = async (divisionCode, value) => {
        try {
            await import('../services/summaryReportService').then(mod =>
                mod.updateThumbprint(token, {
                    month,
                    year,
                    division: divisionCode,
                    value: parseFloat(value) || 0
                })
            );
            // Refresh data to show updated totals/selisih
            await fetchData();
        } catch (err) {
            console.error('Failed to save thumbprint:', err);
            alert('Failed to save value');
        }
    };

    // Handle PPH21 Change
    const handlePPH21Change = (divisionCode, value) => {
        setEditingPPH21(prev => ({
            ...prev,
            [divisionCode]: value
        }));
    };

    // Handle Save PPH21
    const handleSavePPH21 = async (divisionCode, value) => {
        try {
            await updatePPH21(token, {
                month,
                year,
                division: divisionCode,
                value: parseFloat(value) || 0
            });
            // Refresh data to show updated totals
            await fetchData();
        } catch (err) {
            console.error('Failed to save PPH21:', err);
            alert('Failed to save PPH21 value');
        }
    };

    // Handle SPSI Change
    const handleSPSIChange = (divisionCode, value) => {
        setEditingSPSI(prev => ({
            ...prev,
            [divisionCode]: value
        }));
    };

    // Handle Save SPSI
    const handleSaveSPSI = async (divisionCode, value) => {
        try {
            await updateSPSI(token, {
                month,
                year,
                division: divisionCode,
                value: parseFloat(value) || 0
            });
            // Refresh data to show updated totals
            await fetchData();
        } catch (err) {
            console.error('Failed to save SPSI:', err);
            alert('Failed to save SPSI value');
        }
    };


    // Fetch data when filters change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    // Format number with thousand separators
    const formatNumber = (value, decimals = 0) => {
        if (value === null || value === undefined || value === '') return '-';
        const num = Number(value);
        if (isNaN(num)) return '-';
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    };

    // Get month name
    const getMonthName = (m) => {
        const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return months[m] || '';
    };

    // Period label
    const periodLabel = `${getMonthName(month)} ${year}`;

    // Print date
    const printDate = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Month options
    const monthOptions = [
        { value: 1, label: 'Januari' },
        { value: 2, label: 'Februari' },
        { value: 3, label: 'Maret' },
        { value: 4, label: 'April' },
        { value: 5, label: 'Mei' },
        { value: 6, label: 'Juni' },
        { value: 7, label: 'Juli' },
        { value: 8, label: 'Agustus' },
        { value: 9, label: 'September' },
        { value: 10, label: 'Oktober' },
        { value: 11, label: 'November' },
        { value: 12, label: 'Desember' }
    ];

    // Year options (last 5 years)
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

    // Group data by estate prefix (subtotal comes from backend)
    const groupedData = useMemo(() => {
        // Label mapping for known estate prefixes
        const LABEL_MAP = {
            'P': 'ESTATE PARIT GUNUNG',
            'A': 'ESTATE AIR RUAK',
            'N': 'NURSERY',
            'W': 'WORKSHOP (PG & AR)',
            'K': 'ESTATE DME',
            'I': 'DIVISI INFRASTRUKTUR',
            'M': 'OPERASI MILL',
        };

        const groups = {};

        // Filter regular vs subtotal
        const regularData = summaryData.filter(d =>
            !d.is_subtotal &&
            !d.is_grand_total &&
            !(d.description || '').toLowerCase().includes('total') // Double check to exclude any total rows
        );

        // Group ALL divisions dynamically by first character
        regularData.forEach(div => {
            const desc = div.description || div.division_code || '';
            let prefix = desc.charAt(0).toUpperCase();

            // Special handling for INFRASTRUKTUR if it uses 'INF' code
            if (div.division_code === 'INF' || desc.toUpperCase().includes('INFRA')) prefix = 'I';
            // Special handling for NURSERY if it uses 'NRS' code
            if (div.division_code === 'NRS' || desc.toUpperCase().includes('NURSERY')) prefix = 'N';
            // Special handling for WORKSHOP
            if (div.division_code?.startsWith('WKS') || desc.toUpperCase().includes('WORKSHOP')) prefix = 'W';

            if (!groups[prefix]) {
                groups[prefix] = {
                    key: prefix,
                    label: LABEL_MAP[prefix] || `ESTATE ${prefix}`,
                    divisions: [],
                    subtotal: null
                };
            }
            groups[prefix].divisions.push(div);
        });

        // Subtotals from backend response
        Object.keys(groups).forEach(key => {
            groups[key].subtotal = groupSubtotals?.[key]?.totals || null;
        });

        // Convert to array and sort (P, A, N, W, K first, then others alphabetically)
        const sortOrder = ['P', 'A', 'N', 'W', 'K', 'D', 'I', 'L', 'T', 'S', 'M'];
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const idxA = sortOrder.indexOf(a);
            const idxB = sortOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        // Return as ordered object
        const orderedGroups = {};
        sortedKeys.forEach(k => orderedGroups[k] = groups[k]);
        return orderedGroups;
    }, [summaryData, groupSubtotals]);

    // KPI totals from backend
    const kpiTotals = useMemo(() => {
        return {
            divisions: Number(kpiTotalsData?.gangs ?? kpiTotalsData?.divisions ?? 0),
            workers: Number(kpiTotalsData?.workers ?? grandTotal?.total_employees ?? 0),
            hk: Number(kpiTotalsData?.hk ?? grandTotal?.total_hk ?? 0),
            netPay: Number(kpiTotalsData?.netPay ?? grandTotal?.total_manual ?? 0)
        };
    }, [kpiTotalsData, grandTotal]);

    const calculatedGrandTotal = grandTotal;

    // Render Comparison KPI Cards
    const renderComparisonKPI = () => {
        if (!comparisonData || !comparisonData.kpi_summary) return null;
        const { previous_period, current_period, kpi_summary } = comparisonData;
        const prevLabel = `${getMonthName(previous_period?.month || 11)} ${previous_period?.year || year}`;
        const currLabel = `${getMonthName(current_period?.month || month)} ${current_period?.year || year}`;

        const totalGaji = kpi_summary.estate_gaji || { previous: 0, current: 0 };
        const totalPremi = kpi_summary.total_premi || { previous: 0, current: 0 };
        const totalLembur = kpi_summary.total_lembur || { previous: 0, current: 0 };
        const totalTonase = kpi_summary.tbs_weight || { previous: 0, current: 0 };
        const premiBreakdownCurrent = comparisonPremiBreakdown || {};

        const gajiDiff = totalGaji.current - totalGaji.previous;
        const premiDiff = totalPremi.current - totalPremi.previous;
        const lemburDiff = totalLembur.current - totalLembur.previous;

        // Premi breakdown totals for current month (from backend)
        const totalPruning = Number(premiBreakdownCurrent.total_prunning_current || 0);
        const totalBrondol = Number(premiBreakdownCurrent.total_brondol_current || 0);
        const totalInsentif = Number(premiBreakdownCurrent.total_insentif_current || 0);
        const totalKinerja = Number(premiBreakdownCurrent.total_kinerja_current || 0);

        const tonaseDiff = totalTonase.current - totalTonase.previous;

        return (
            <>
                {/* Main KPI Row */}
                <div className="wsp-kpi-grid comparison-grid">
                    {/* Total Upah Bersih */}
                    <div className="wsp-kpi-card comparison-card">
                        <div className="wsp-kpi-label">Total Upah Bersih (Rebinmas)</div>
                        <div className="wsp-kpi-compare-row">
                            <div className="wsp-kpi-trend-box prev">
                                <div className="trend-label">{prevLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalGaji.previous)}
                                </div>
                            </div>
                            <div className="wsp-kpi-trend-box curr">
                                <div className="trend-label">{currLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalGaji.current)}
                                </div>
                            </div>
                        </div>
                        <div className={`wsp-kpi-diff ${gajiDiff > 0 ? 'pos' : gajiDiff < 0 ? 'neg' : 'neutral'}`}>
                            <span>Variance:</span>
                            <strong>Rp {formatNumber(gajiDiff)} {gajiDiff > 0 ? '▲' : gajiDiff < 0 ? '▼' : ''}</strong>
                        </div>
                    </div>

                    {/* Total Premi */}
                    <div className="wsp-kpi-card comparison-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                        <div className="wsp-kpi-label">Total Premi</div>
                        <div className="wsp-kpi-compare-row">
                            <div className="wsp-kpi-trend-box prev">
                                <div className="trend-label">{prevLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalPremi.previous)}
                                </div>
                            </div>
                            <div className="wsp-kpi-trend-box curr">
                                <div className="trend-label">{currLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalPremi.current)}
                                </div>
                            </div>
                        </div>
                        <div className={`wsp-kpi-diff ${premiDiff > 0 ? 'pos' : premiDiff < 0 ? 'neg' : 'neutral'}`}>
                            <span>Variance:</span>
                            <strong>Rp {formatNumber(premiDiff)} {premiDiff > 0 ? '▲' : premiDiff < 0 ? '▼' : ''}</strong>
                        </div>
                    </div>

                    {/* Total Lembur */}
                    <div className="wsp-kpi-card comparison-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                        <div className="wsp-kpi-label">Total Lembur (OT)</div>
                        <div className="wsp-kpi-compare-row">
                            <div className="wsp-kpi-trend-box prev">
                                <div className="trend-label">{prevLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalLembur.previous)}
                                </div>
                            </div>
                            <div className="wsp-kpi-trend-box curr">
                                <div className="trend-label">{currLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalLembur.current)}
                                </div>
                            </div>
                        </div>
                        <div className={`wsp-kpi-diff ${lemburDiff > 0 ? 'pos' : lemburDiff < 0 ? 'neg' : 'neutral'}`}>
                            <span>Variance:</span>
                            <strong>Rp {formatNumber(lemburDiff)} {lemburDiff > 0 ? '▲' : lemburDiff < 0 ? '▼' : ''}</strong>
                        </div>
                    </div>

                    {/* Total Tonase TBS */}
                    <div className="wsp-kpi-card comparison-card" style={{ borderLeft: '4px solid #10b981' }}>
                        <div className="wsp-kpi-label flex items-center gap-2">
                            <span>🌴</span> Total Tonase TBS
                        </div>
                        <div className="wsp-kpi-compare-row">
                            <div className="wsp-kpi-trend-box prev">
                                <div className="trend-label">{prevLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalTonase.previous, 2)} <span style={{ fontSize: '0.75rem' }}>Ton</span>
                                </div>
                            </div>
                            <div className="wsp-kpi-trend-box curr">
                                <div className="trend-label">{currLabel}</div>
                                <div className="trend-value">
                                    {formatNumber(totalTonase.current, 2)} <span style={{ fontSize: '0.75rem' }}>Ton</span>
                                </div>
                            </div>
                        </div>
                        <div className={`wsp-kpi-diff ${tonaseDiff > 0 ? 'pos' : tonaseDiff < 0 ? 'neg' : 'neutral'}`}>
                            <span>Variance:</span>
                            <strong>{formatNumber(tonaseDiff, 2)} Ton {tonaseDiff > 0 ? '▲' : tonaseDiff < 0 ? '▼' : ''}</strong>
                        </div>
                    </div>
                </div>

                {/* Premi Breakdown Mini Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Pruning</div>
                        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: '#78350f' }}>
                            {formatNumber(totalPruning)}
                        </div>
                    </div>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Brondol</div>
                        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: '#7f1d1d' }}>
                            {formatNumber(totalBrondol)}
                        </div>
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Insentif Panen</div>
                        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: '#14532d' }}>
                            {formatNumber(totalInsentif)}
                        </div>
                    </div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Kinerja</div>
                        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: '#1e3a5f' }}>
                            {formatNumber(totalKinerja)}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    // Render trend arrow helper
    const renderTrendArrow = (curr, prev, type = 'cost') => {
        const diff = (curr || 0) - (prev || 0);
        if (Math.abs(diff) < 0.01) return null; // No significant change

        const isUp = diff > 0;
        let arrowClass = '';

        if (type === 'cost') {
            arrowClass = isUp ? 'trend-up' : 'trend-down'; // Cost: Up=Red, Down=Green
        } else if (type === 'yield') {
            arrowClass = isUp ? 'trend-up-green' : 'trend-down-red'; // Yield: Up=Green, Down=Red
        }

        return (
            <span className={`trend-indicator ${arrowClass}`}>
                {isUp ? '▲' : '▼'}
            </span>
        );
    };

    // Render comparison table
    const renderComparisonTable = () => {
        if (!comparisonData || !comparisonData.divisions) return null;

        const { divisions = [], previous_period, current_period } = comparisonData;
        const prevMonthName = getMonthName(previous_period.month).toUpperCase();
        const currMonthName = getMonthName(current_period.month).toUpperCase();
        const grandTotal = comparisonGrandTotal || {};
        return (
            <div className="wsp-table-wrapper">
                <table className="wsp-table comparison-table">
                    <thead>
                        {/* SCREEN VERSION of Comparison Headers */}
                        <tr className="wsp-header-master no-print">
                            <th rowSpan="2" className="th-sticky-col th-gang-name" style={{ width: '25%' }}>ESTATE / DIVISI</th>
                            <th colSpan="2" className="th-group-manpower">MANPOWER</th>
                            <th colSpan="5" className="th-group-premi">PREMI ({currMonthName})</th>
                            <th colSpan="3" className="th-group-uraian">Lembur dan Potongan</th>
                            <th colSpan="2" className="th-group-prev">REKAP {prevMonthName.substring(0, 3)}</th>
                            <th colSpan="2" className="th-group-curr">REKAP {currMonthName.substring(0, 3)}</th>
                            <th rowSpan="2" className="th-group-diff">SELISIH</th>
                        </tr>
                        <tr className="wsp-header-sub no-print">
                            <th className="th-group-workers">{prevMonthName.substring(0, 3)}</th>
                            <th className="th-group-workers">{currMonthName.substring(0, 3)}</th>
                            <th className="th-group-premi">PRUNING</th>
                            <th className="th-group-premi">BRONDOL</th>
                            <th className="th-group-premi">INSENTIF</th>
                            <th className="th-group-premi">KINERJA</th>
                            <th className="th-group-premi" style={{ fontWeight: 800 }}>TOTAL</th>
                            <th className="th-group-uraian">LEMBUR</th>
                            <th className="th-group-uraian">PPH21</th>
                            <th className="th-group-uraian">SPSI</th>
                            <th className="th-group-prev">GAJI</th>
                            <th className="th-group-prev">TBS (Ton)</th>
                            <th className="th-group-curr">GAJI</th>
                            <th className="th-group-curr">TBS (Ton)</th>
                        </tr>

                        {/* PRINT VERSION of Comparison Headers (Simplified) */}
                        <tr className="wsp-header-master print-only">
                            <th rowSpan="2" className="th-sticky-col th-gang-name" style={{ width: '25%' }}>ESTATE / DIVISI</th>
                            <th colSpan="2" className="th-group-manpower">MANPOWER</th>
                            <th colSpan="1" className="th-group-premi">TOTAL PREMI</th>
                            <th colSpan="3" className="th-group-uraian">Lembur dan Potongan</th>
                            <th colSpan="2" className="th-group-prev">REKAP {prevMonthName.substring(0, 3)}</th>
                            <th colSpan="2" className="th-group-curr">REKAP {currMonthName.substring(0, 3)}</th>
                            <th rowSpan="2" className="th-group-diff">SELISIH</th>
                        </tr>
                        <tr className="wsp-header-sub print-only">
                            <th className="th-group-workers">{prevMonthName.substring(0, 3)}</th>
                            <th className="th-group-workers">{currMonthName.substring(0, 3)}</th>
                            <th className="th-group-premi" style={{ fontWeight: 800 }}>TOTAL</th>
                            <th className="th-group-uraian">LEMBUR</th>
                            <th className="th-group-uraian">PPH21</th>
                            <th className="th-group-uraian">SPSI</th>
                            <th className="th-group-prev">GAJI</th>
                            <th className="th-group-prev">TBS (Ton)</th>
                            <th className="th-group-curr">GAJI</th>
                            <th className="th-group-curr">TBS (Ton)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {divisions.map((row, idx) => {
                            const currGaji = row.current_month?.gaji || 0;
                            const prevGaji = row.previous_month?.gaji || 0;
                            const calculatedSelisih = currGaji - prevGaji;
                            return (
                                <tr key={idx}>
                                    {/* Division: separate code and desc */}
                                    <td className="text-left division-name sticky-col">
                                        <div className="div-code">{row.division_code}</div>
                                        {row.description && row.description !== row.division_code && (
                                            <div className="div-desc">
                                                {row.description}
                                            </div>
                                        )}
                                    </td>

                                    {/* Workers */}
                                    <td className="text-right border-right-group">{formatNumber(row.workers_previous)}</td>
                                    <td className="text-right border-right-section">
                                        {formatNumber(row.workers_current)}
                                        {renderTrendArrow(row.workers_current, row.workers_previous, 'cost')}
                                    </td>

                                    {/* Premi Breakdown - Hide detail in print */}
                                    <td className={`text-right no-print ${(row.total_prunning_current || 0) === 0 ? 'val-zero' : ''}`}>{formatNumber(row.total_prunning_current || 0)}</td>
                                    <td className={`text-right no-print ${(row.total_brondol_current || 0) === 0 ? 'val-zero' : ''}`}>{formatNumber(row.total_brondol_current || 0)}</td>
                                    <td className={`text-right no-print ${(row.total_insentif_current || 0) === 0 ? 'val-zero' : ''}`}>{formatNumber(row.total_insentif_current || 0)}</td>
                                    <td className={`text-right no-print ${(row.total_kinerja_current || 0) === 0 ? 'val-zero' : ''}`}>{formatNumber(row.total_kinerja_current || 0)}</td>
                                    {/* Keep Total Premi in print */}
                                    <td className="text-right border-right-section" style={{ fontWeight: 700 }}>
                                        {formatNumber(row.total_premi_current)}
                                        {renderTrendArrow(row.total_premi_current, row.total_premi_previous, 'cost')}
                                    </td>

                                    {/* Lembur & Deductions */}
                                    <td className="text-right">
                                        {formatNumber(row.total_lembur_current)}
                                        {renderTrendArrow(row.total_lembur_current, row.total_lembur_previous, 'cost')}
                                    </td>
                                    <td className="text-right">{formatNumber(row.total_pph21_current)}</td>
                                    <td className="text-right border-right-section">{formatNumber(row.total_spsi_current)}</td>

                                    {/* Previous Month */}
                                    <td className="text-right">{formatNumber(prevGaji)}</td>
                                    <td className={`text-right border-right-section ${(row.previous_month?.tbs_weight || 0) > 0 ? 'tonase-highlight' : ''}`}>
                                        {formatNumber(row.previous_month?.tbs_weight, 3)}
                                    </td>

                                    {/* Current Month */}
                                    <td className="text-right font-semibold">
                                        {formatNumber(currGaji)}
                                        {renderTrendArrow(currGaji, prevGaji, 'cost')}
                                    </td>
                                    <td className={`text-right border-right-section font-semibold ${(row.current_month?.tbs_weight || 0) > 0 ? 'tonase-highlight' : ''}`}>
                                        {formatNumber(row.current_month?.tbs_weight, 3)}
                                        {renderTrendArrow(row.current_month?.tbs_weight, row.previous_month?.tbs_weight, 'yield')}
                                    </td>

                                    {/* SELISIH - calculated gaji difference */}
                                    <td className={`text-right font-semibold ${calculatedSelisih > 0 ? 'text-diff-neg' : calculatedSelisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
                                        <span style={{ marginRight: '4px' }}>
                                            {calculatedSelisih > 0 ? '▲' : calculatedSelisih < 0 ? '▼' : ''}
                                        </span>
                                        {formatNumber(calculatedSelisih)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="wsp-grand-total">
                            <td className="text-left sticky-col">SUB TOTAL</td>
                            <td className="text-right">{formatNumber(grandTotal.workers_previous)}</td>
                            <td className="text-right">
                                {formatNumber(grandTotal.workers_current)}
                                {renderTrendArrow(grandTotal.workers_current, grandTotal.workers_previous, 'cost')}
                            </td>
                            <td className="text-right no-print">{formatNumber(grandTotal.total_prunning_current)}</td>
                            <td className="text-right no-print">{formatNumber(grandTotal.total_brondol_current)}</td>
                            <td className="text-right no-print">{formatNumber(grandTotal.total_insentif_current)}</td>
                            <td className="text-right no-print">{formatNumber(grandTotal.total_kinerja_current)}</td>
                            <td className="text-right" style={{ fontWeight: 800 }}>
                                {formatNumber(grandTotal.total_premi_current)}
                                {renderTrendArrow(grandTotal.total_premi_current, grandTotal.total_premi_previous, 'cost')}
                            </td>
                            <td className="text-right">
                                {formatNumber(grandTotal.total_lembur_current)}
                                {renderTrendArrow(grandTotal.total_lembur_current, grandTotal.total_lembur_previous, 'cost')}
                            </td>
                            <td className="text-right">{formatNumber(grandTotal.total_pph21_current)}</td>
                            <td className="text-right">{formatNumber(grandTotal.total_spsi_current)}</td>
                            <td className="text-right">{formatNumber(grandTotal.prev_gaji)}</td>
                            <td className={`text-right ${grandTotal.prev_tbs > 0 ? 'tonase-highlight' : ''}`}>{formatNumber(grandTotal.prev_tbs, 3)}</td>
                            <td className="text-right">
                                {formatNumber(grandTotal.curr_gaji)}
                                {renderTrendArrow(grandTotal.curr_gaji, grandTotal.prev_gaji, 'cost')}
                            </td>
                            <td className={`text-right ${grandTotal.curr_tbs > 0 ? 'tonase-highlight' : ''}`}>
                                {formatNumber(grandTotal.curr_tbs, 3)}
                                {renderTrendArrow(grandTotal.curr_tbs, grandTotal.prev_tbs, 'yield')}
                            </td>
                            <td className={`text-right font-bold ${grandTotal.selisih > 0 ? 'text-diff-neg' : grandTotal.selisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
                                <span style={{ marginRight: '4px' }}>
                                    {grandTotal.selisih > 0 ? '▲' : grandTotal.selisih < 0 ? '▼' : ''}
                                </span>
                                {formatNumber(grandTotal.selisih)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        );
    };

    // Handle Save PDF
    const handleSavePDF = () => {
        const element = document.getElementById('wsp-report-content');
        const filename = `Wages_Summary_Rebinmas_${month}_${year}.pdf`;
        generatePDF(element, filename);
    };

    // Handle print
    const handlePrint = () => {
        window.print();
    };

    // Handle export CSV
    const handleExport = () => {
        let csv = 'Division,Workers,HK Cekroll,PPH21,SPSI,Total Premi,Total Lembur,Total Upah Bersih\n';

        summaryData.forEach(row => {
            if (!row.is_grand_total) {
                const totalPremiExcludingSpecial = (row.total_premi_excluding_special || row.total_premi || 0);
                csv += `"${row.description || ''}",${row.total_employees || 0},${row.total_hk || 0},${row.total_pph21 || 0},${row.total_spsi || 0},${totalPremiExcludingSpecial},${row.total_lembur || 0},${row.total_manual || 0}\n`;
            }
        });

        if (grandTotal) {
            const totalPremiExcludingSpecial = (grandTotal.total_premi_excluding_special || grandTotal.total_premi || 0);
            csv += `"GRAND TOTAL",${grandTotal.total_employees || 0},${grandTotal.total_hk || 0},${grandTotal.total_pph21 || 0},${grandTotal.total_spsi || 0},${totalPremiExcludingSpecial},${grandTotal.total_lembur || 0},${grandTotal.total_manual || 0}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Summary_Wages_Rebinmas_${month}_${year}.csv`;
        link.click();
    };

    // Handle THR Excel Export - Detailed Employee List
    const handleThrExport = async () => {
        try {
            // Get divisionCode based on filter
            let divisionCode;
            if (thrIjlFilter === 'ijl-only') {
                divisionCode = 'IJL';
            } else if (thrIjlFilter === 'non-ijl') {
                // For non-IJL, we need to export all non-IJL divisions
                // Use the existing export endpoint with incomeType=THR
            }

            // Use the existing exportExcel function which generates detailed THR list
            await otherIncomesService.exportExcel(year, month, divisionCode, undefined, 'THR');
        } catch (error) {
            console.error('Error exporting THR Excel:', error);
            alert('Failed to export THR Excel. Please try again.');
        }
    };

    // Render estate group
    const renderEstateGroup = (groupKey, group) => {
        if (group.divisions.length === 0) return null;

        return (
            <React.Fragment key={groupKey}>
                {/* Estate Header */}
                <tr className="estate-header">
                    <td colSpan="10">{group.label}</td>
                </tr>

                {/* Division Rows */}
                {group.divisions.map((div, idx) => (
                    <tr key={`${groupKey}-${idx}`}>
                        <td className="text-left division-name sticky-col">
                            <div className="div-code">{div.division_code}</div>
                            {div.description && div.description !== div.division_code && (
                                <div className="div-desc" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>
                                    {div.description}
                                </div>
                            )}
                        </td>
                        <td className={`text-right ${Number(div.total_employees) === 0 ? 'val-zero' : ''}`}>
                            {formatNumber(div.total_employees)}
                        </td>
                        <td className={`text-right border-right-section ${Number(div.total_hk) === 0 ? 'val-zero' : ''}`}>
                            {formatNumber(div.total_hk)}
                        </td>
                        <td className={`text-right ${Number(div.total_pph21) === 0 ? 'val-zero' : ''}`}>
                            {editMode ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <input
                                        type="number"
                                        className="wsp-input-edit"
                                        value={editingPPH21[div.division_code] !== undefined ? editingPPH21[div.division_code] : (div.original_pph21 ?? div.total_pph21)}
                                        onChange={(e) => handlePPH21Change(div.division_code, e.target.value)}
                                        style={{ width: '100%', textAlign: 'right', padding: '2px 4px', border: '1px solid #3b82f6', borderRadius: '4px', backgroundColor: '#ffffff', color: '#0f172a' }}
                                    />
                                    <button
                                        onClick={() => handleSavePPH21(div.division_code, editingPPH21[div.division_code])}
                                        className="wsp-btn-sm"
                                        style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        disabled={editingPPH21[div.division_code] === undefined}
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                formatNumber(div.total_pph21)
                            )}
                        </td>
                        <td className={`text-right border-right-section ${Number(div.total_spsi) === 0 ? 'val-zero' : ''}`}>
                            {editMode ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <input
                                        type="number"
                                        className="wsp-input-edit"
                                        value={editingSPSI[div.division_code] !== undefined ? editingSPSI[div.division_code] : (div.original_spsi ?? div.total_spsi)}
                                        onChange={(e) => handleSPSIChange(div.division_code, e.target.value)}
                                        style={{ width: '100%', textAlign: 'right', padding: '2px 4px', border: '1px solid #3b82f6', borderRadius: '4px', backgroundColor: '#ffffff', color: '#0f172a' }}
                                    />
                                    <button
                                        onClick={() => handleSaveSPSI(div.division_code, editingSPSI[div.division_code])}
                                        className="wsp-btn-sm"
                                        style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        disabled={editingSPSI[div.division_code] === undefined}
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                formatNumber(div.total_spsi)
                            )}
                        </td>
                        {/* Premi Column - Full Total Premi (same as Daftar Upah) */}
                        <td className={`text-right ${Number(div.total_premi_excluding_special) === 0 ? 'val-zero' : ''}`}>
                            {formatNumber(div.total_premi_excluding_special)}
                        </td>
                        {/* Lembur */}
                        <td className={`text-right ${Number(div.total_lembur) === 0 ? 'val-zero' : ''}`}>
                            {formatNumber(div.total_lembur)}
                        </td>
                        {/* Portal (Net Pay) */}
                        <td className={`text-right border-right-section ${Number(div.total_manual) === 0 ? 'val-zero' : 'val-positive'}`}>
                            {formatNumber(div.total_manual)}
                        </td>
                        {/* Thumb Print */}
                        <td className={`text-right ${Number(div.thumb_print) === 0 ? 'val-zero' : ''}`}>
                            {editMode ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <input
                                        type="number"
                                        className="wsp-input-edit"
                                        value={editingValues[div.division_code] !== undefined ? editingValues[div.division_code] : div.thumb_print}
                                        onChange={(e) => handleThumbprintChange(div.division_code, e.target.value)}
                                        style={{ width: '100%', textAlign: 'right', padding: '2px 4px', border: '1px solid #3b82f6', borderRadius: '4px', backgroundColor: '#ffffff', color: '#0f172a' }}
                                    />
                                    <button
                                        onClick={() => handleSaveThumbprint(div.division_code, editingValues[div.division_code])}
                                        className="wsp-btn-sm"
                                        style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        disabled={editingValues[div.division_code] === undefined}
                                    >
                                        Save
                                    </button>
                                </div>
                            ) : (
                                formatNumber(div.thumb_print)
                            )}
                        </td>
                        {/* Selisih */}
                        <td className={`text-center font-semibold ${div.selisih > 0 ? 'text-diff-neg' : div.selisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
                            {formatNumber(div.selisih)}
                        </td>
                    </tr>
                ))}

                {/* Subtotal Row */}
                {group.subtotal && (
                    <tr className="subtotal">
                        <td className="text-left sticky-col">GRAND TOTAL {group.label.replace('ESTATE ', '')}</td>
                        <td className="text-right">{formatNumber(group.subtotal.total_employees)}</td>
                        <td className="text-right border-right-section">{formatNumber(group.subtotal.total_hk)}</td>
                        <td className="text-right">{formatNumber(group.subtotal.total_pph21)}</td>
                        <td className="text-right border-right-section">{formatNumber(group.subtotal.total_spsi)}</td>
                        <td className="text-right">{formatNumber(group.subtotal.total_premi_excluding_special || group.subtotal.total_premi)}</td>
                        <td className="text-right">{formatNumber(group.subtotal.total_lembur)}</td>
                        <td className="text-right border-right-section">{formatNumber(group.subtotal.total_manual)}</td>
                        <td className="text-right">{formatNumber(group.subtotal.thumb_print || 0)}</td>
                        <td className={`text-center font-semibold ${group.subtotal.selisih > 0 ? 'text-diff-neg' : group.subtotal.selisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
                            {formatNumber(group.subtotal.selisih || 0)}
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="wsp-container" style={{ padding: '1.5rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {/* Action Bar */}
            <div className="report-header-web no-print">
                <div className="report-header-info">
                    <h1>Wages Summary (Rebinmas)</h1>
                    <p>Laporan rincian upah lengkap untuk entitas PT Rebinmas Jaya.</p>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Division Type Selector (All/Real/Virtual) */}
                        <select
                            value={divisionType}
                            onChange={(e) => {
                                setDivisionType(e.target.value);
                            }}
                            className="report-filter-badge"
                            style={{ 
                                cursor: 'pointer', 
                                outline: 'none',
                                backgroundColor: divisionType === 'virtual' ? '#fef3c7' : divisionType === 'real' ? '#eef2ff' : '#dcfce7',
                                color: divisionType === 'virtual' ? '#92400e' : divisionType === 'real' ? '#4f46e5' : '#166534',
                                borderColor: divisionType === 'virtual' ? '#fde68a' : divisionType === 'real' ? '#c7d2fe' : '#86efac',
                                fontWeight: 'bold'
                            }}
                        >
                            <option value="all">Semua Divisi</option>
                            <option value="real">Divisi Utama Saja</option>
                            <option value="virtual">Divisi Virtual Saja</option>
                        </select>

                        {/* ── Period Slider (Highlighted & Prominent) ─────────────── */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                            border: '2px solid #60a5fa',
                            borderRadius: '12px',
                            padding: '5px 12px 5px 8px',
                            boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4), 0 0 0 3px rgba(96, 165, 250, 0.18)',
                            transition: 'box-shadow 0.2s'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '10px',
                                fontWeight: '800',
                                color: '#93c5fd',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap'
                            }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                Periode
                            </div>
                            <CompactPeriodScroll
                                month={month}
                                year={year}
                                onChange={(m, y) => { setMonth(m); setYear(y); }}
                                disableControls={loading}
                            />
                        </div>

                        <span className="report-filter-badge" style={{ backgroundColor: thrMode ? '#8b5cf6' : (comparisonMode ? '#10b981' : '#64748b') }}>
                            {thrMode ? 'Mode THR' : (comparisonMode ? 'Mode Perbandingan' : 'Mode Standar')}
                        </span>
                        {thrMode && (
                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                <button
                                    onClick={() => setThrIjlFilter('non-ijl')}
                                    className={`report-filter-badge ${thrIjlFilter === 'non-ijl' ? 'wsp-btn-primary' : ''}`}
                                    style={{ backgroundColor: thrIjlFilter === 'non-ijl' ? '#3b82f6' : '#64748b', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '4px', color: '#fff' }}
                                >
                                    Non-IJL
                                </button>
                                <button
                                    onClick={() => setThrIjlFilter('ijl-only')}
                                    className={`report-filter-badge ${thrIjlFilter === 'ijl-only' ? 'wsp-btn-primary' : ''}`}
                                    style={{ backgroundColor: thrIjlFilter === 'ijl-only' ? '#ef4444' : '#64748b', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '4px', color: '#fff' }}
                                >
                                    IJL Only
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="report-header-actions">
                    <button onClick={handlePrint} className="wsp-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Printer size={18} /> Cetak Report
                    </button>
                    <button
                        onClick={handleExport}
                        className="wsp-btn-secondary"
                        disabled={loading || (!comparisonMode && summaryData.length === 0)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        Export CSV
                    </button>
                    <button
                        onClick={fetchData}
                        className="wsp-btn-secondary"
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <RefreshCw size={18} /> Refresh
                    </button>
                    {thrMode && (
                        <button
                            onClick={handleThrExport}
                            className="wsp-btn-secondary"
                            disabled={!thrData?.divisions?.length}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '0.5rem' }}
                            title="Export THR Summary to Excel"
                        >
                            Export Excel
                        </button>
                    )}
                    <button
                        onClick={() => setThrMode(!thrMode)}
                        className={`wsp-btn ${thrMode ? 'wsp-btn-primary' : ''}`}
                        title="Toggle THR Mode - Rekap Semua Divisi"
                        style={{ marginLeft: '0.5rem', backgroundColor: thrMode ? '#8b5cf6' : '' }}
                        disabled={loading || comparisonMode || impactReportMode}
                    >
                        {thrMode ? 'Back to Summary' : 'THR Mode'}
                    </button>
                    <button
                        onClick={() => setImpactReportMode(!impactReportMode)}
                        className={`wsp-btn ${impactReportMode ? 'wsp-btn-primary' : ''}`}
                        title="Toggle Impact Report Mode"
                        style={{ marginLeft: '0.5rem' }}
                    >
                        {impactReportMode ? 'Back to Summary' : 'Impact Report'}
                    </button>
                    <button
                        onClick={() => setEditMode(!editMode)}
                        className={`wsp-btn ${editMode ? 'wsp-btn-warning' : ''}`}
                        title="Toggle Edit Mode"
                        style={{ marginLeft: '0.5rem', backgroundColor: editMode ? '#f59e0b' : '' }}
                        disabled={comparisonMode || impactReportMode}
                    >
                        {editMode ? 'Exit Edit' : 'Edit Mode'}
                    </button>
                    {/* History DB Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: useHistory ? '#fef3c7' : 'var(--bg-card, #fff)', padding: '0.5rem 1rem', borderRadius: '8px', border: useHistory ? '1px solid #f59e0b' : '1px solid var(--border-color, #e2e8f0)', marginLeft: '0.5rem', transition: 'all 0.2s' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, fontWeight: 500, fontSize: '0.875rem', color: useHistory ? '#92400e' : 'inherit' }} title="Ambil data dari history DB (extend_db_ptrj) — origin DB tidak terbebani">
                            <input
                                type="checkbox"
                                checked={useHistory}
                                onChange={(e) => {
                                    setUseHistory(e.target.checked);
                                    setSummaryData([]);
                                    setGrandTotal(null);
                                    setComparisonData(null);
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                            />
                            Mode History
                        </label>
                    </div>
                </div>
            </div>

            {/* Impact Report Mode - Render Full Page */}
            {impactReportMode ? (
                <ImpactReportPage onBack={() => setImpactReportMode(false)} />
            ) : (
                <>
                    {/* Loading State */}
                    {loading ? (
                        <div className="wsp-loading">
                            <div className="wsp-spinner"></div>
                            <div className="wsp-loading-text">Memuat Financial Report...</div>
                        </div>
                    ) : error ? (
                        <div className="wsp-error">
                            <div className="wsp-error-icon">!</div>
                            <div className="wsp-error-title">Gagal Memuat Data</div>
                            <div className="wsp-error-message">{error}</div>
                            <button onClick={fetchData} className="wsp-btn" style={{ marginTop: '1rem' }}>
                                Coba Lagi
                            </button>
                        </div>
                    ) : (
                        /* Paper Document */
                        <div className="wsp-document" id="wsp-report-content">
                            {/* Letterhead */}
                            <div className="wsp-letterhead">
                                <img src="/images/rebinmas.webp" alt="PT REBINMAS JAYA" className="wsp-logo" />
                                <h1 className="wsp-company-name">
                                    {/* If THR mode and IJL Only filter, show PT IMPIAN JAYA LESTARI */}
                                    {thrMode && thrIjlFilter === 'ijl-only'
                                        ? 'PT. IMPIAN JAYA LESTARI'
                                        : 'PT. REBINMAS JAYA'}
                                </h1>
                                <div className="wsp-report-title wsp-report-title-main" style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '700',
                                    margin: '1rem 0 0.5rem 0',
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}>
                                    {thrMode ? 'REKAPITULASI TUNJANGAN HARI RAYA (THR SUMMARY)' : (comparisonMode ? 'LAPORAN PERBANDINGAN UPAH BULANAN (WAGES COMPARISON)' : 'REKAPITULASI DAFTAR UPAH (WAGES SUMMARY)')}
                                </div>
                                <div className="wsp-report-subtitle" style={{
                                    fontSize: '1rem',
                                    fontWeight: '500',
                                    textAlign: 'center',
                                    color: '#475569',
                                    marginBottom: '0.5rem'
                                }}>
                                    {!thrMode && !comparisonMode && 'WAGES SUMMARY REPORT - PT. REBINMAS JAYA'}
                                    {comparisonMode && 'WAGES COMPARISON REPORT - PT. REBINMAS JAYA'}
                                    {thrMode && thrIjlFilter === 'ijl-only' && 'THR REPORT - PT. IMPIAN JAYA LESTARI'}
                                </div>
                                <div className="wsp-report-period" style={{
                                    fontSize: '0.95rem',
                                    textAlign: 'center',
                                    marginTop: '0.5rem',
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '6px',
                                    display: 'inline-block',
                                    width: 'auto',
                                    marginLeft: 'auto',
                                    marginRight: 'auto'
                                }}>
                                    {thrMode && <span style={{ marginRight: '1rem' }}>Division: <strong style={{ color: '#0f172a' }}>ALL</strong> | </span>}
                                    Periode: <strong style={{ color: '#0f172a' }}>{periodLabel}</strong>
                                </div>
                            </div>

                            {/* KPI Cards */}
                            {thrMode ? (
                                <div className="wsp-kpi-grid">
                                    <div className="wsp-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                                        <div className="wsp-kpi-label">Total Divisi</div>
                                        <div className="wsp-kpi-value">{thrData?.divisions?.length || 0}</div>
                                    </div>
                                    <div className="wsp-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                                        <div className="wsp-kpi-label">Pekerja Full (12/12)</div>
                                        <div className="wsp-kpi-value">{formatNumber(thrData?.grand_total?.full_workers || 0)}</div>
                                    </div>
                                    <div className="wsp-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                                        <div className="wsp-kpi-label">Pekerja Proporsi</div>
                                        <div className="wsp-kpi-value">{formatNumber(thrData?.grand_total?.prop_workers || 0)}</div>
                                    </div>
                                    <div className="wsp-kpi-card highlight" style={{ borderLeft: '4px solid #8b5cf6' }}>
                                        <div className="wsp-kpi-label">Total THR</div>
                                        <div className="wsp-kpi-value">Rp {formatNumber(thrData?.grand_total?.total_thr || 0)}</div>
                                    </div>
                                </div>
                            ) : comparisonMode ? renderComparisonKPI() : (
                                <div className="wsp-kpi-grid">
                                    <div className="wsp-kpi-card">
                                        <div className="wsp-kpi-label">Total Gang</div>
                                        <div className="wsp-kpi-value">{formatNumber(kpiTotals.divisions)}</div>
                                    </div>
                                    <div className="wsp-kpi-card">
                                        <div className="wsp-kpi-label">Total Pekerja</div>
                                        <div className="wsp-kpi-value">{formatNumber(kpiTotals.workers)}</div>
                                    </div>
                                    <div className="wsp-kpi-card">
                                        <div className="wsp-kpi-label">Total HK Checkroll</div>
                                        <div className="wsp-kpi-value">{formatNumber(kpiTotals.hk)}</div>
                                    </div>
                                    <div className="wsp-kpi-card highlight">
                                        <div className="wsp-kpi-label">Total Upah Bersih</div>
                                        <div className="wsp-kpi-value">Rp {formatNumber(kpiTotals.netPay)}</div>
                                    </div>
                                </div>
                            )}

                            {/* Data Table */}
                            {thrMode ? (
                                <div className="wsp-table-wrapper">
                                    <table className="wsp-table">
                                        <thead>
                                            {/* Master Header Level */}
                                            <tr className="wsp-header-master">
                                                <th rowSpan="2" className="th-sticky-col" style={{ minWidth: '300px', width: '300px' }}>ESTATE / DIVISI</th>
                                                <th colSpan="3" className="th-group-manpower">MANPOWER</th>
                                                <th colSpan="2" className="th-group-income">RINCIAN THR</th>
                                                <th rowSpan="2" className="th-group-income">TOTAL THR</th>
                                            </tr>
                                            {/* Sub Header Level */}
                                            <tr className="wsp-header-sub">
                                                <th className="th-group-manpower" style={{ minWidth: '80px' }}>WORKERS</th>
                                                <th className="th-group-manpower" style={{ minWidth: '80px' }}>FULL</th>
                                                <th className="th-group-manpower border-right-section" style={{ minWidth: '80px' }}>PROPORSI</th>

                                                <th className="th-group-income" style={{ minWidth: '140px' }}>TUNJ. BERAS</th>
                                                <th className="th-group-income border-right-section" style={{ minWidth: '140px' }}>MASA KERJA</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {thrData?.divisions?.map((div, idx) => (
                                                <tr key={idx}>
                                                    <td className="text-left">{div.division} {div.division !== div.gang_description ? `(${div.gang_description})` : ''}</td>
                                                    <td className={`text-right ${!Number(div.karyawan_count) && 'val-zero'}`}>{formatNumber(div.karyawan_count)}</td>
                                                    <td className={`text-right ${!Number(div.full_workers) && 'val-zero'}`}>{formatNumber(div.full_workers)}</td>
                                                    <td className={`text-right border-right-section ${!Number(div.prop_workers) && 'val-zero'}`}>{formatNumber(div.prop_workers)}</td>
                                                    <td className={`text-right ${!Number(div.total_tunjangan_beras) && 'val-zero'}`}>
                                                        {formatNumber(div.total_tunjangan_beras)}
                                                    </td>
                                                    <td className={`text-right border-right-section ${!Number(div.total_masa_kerja) && 'val-zero'}`}>
                                                        {formatNumber(div.total_masa_kerja)}
                                                    </td>
                                                    <td className={`text-right ${!Number(div.total_thr) ? 'val-zero' : 'val-positive'}`} style={{ fontWeight: 600 }}>
                                                        {formatNumber(div.total_thr)}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="wsp-grand-total">
                                                <td>GRAND TOTAL</td>
                                                <td className="text-right">{formatNumber(thrData?.grand_total?.total_employees || 0)}</td>
                                                <td className="text-right">{formatNumber(thrData?.grand_total?.full_workers || 0)}</td>
                                                <td className="text-right border-right-section">{formatNumber(thrData?.grand_total?.prop_workers || 0)}</td>
                                                <td className="text-right">
                                                    {formatNumber(thrData?.grand_total?.total_tunjangan_beras || 0)}
                                                </td>
                                                <td className="text-right border-right-section">
                                                    {formatNumber(thrData?.grand_total?.total_masa_kerja || 0)}
                                                </td>
                                                <td className="text-right" style={{ fontWeight: 700, color: '#16a34a' }}>
                                                    {formatNumber(thrData?.grand_total?.total_thr || 0)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            ) : comparisonMode ? renderComparisonTable() : (
                                <div className="wsp-table-wrapper">
                                    <table className="wsp-table">
                                        <thead>
                                            {/* SCREEN VERSION of Summary Headers */}
                                            <tr className="wsp-header-master no-print">
                                                <th rowSpan="2" className="th-sticky-col th-gang-name" style={{ width: '25%' }}>ESTATE / DIVISI</th>
                                                <th colSpan="2" className="th-group-manpower">MANPOWER</th>
                                                <th colSpan="2" className="th-group-deductions">DEDUCTIONS / POTONGAN</th>
                                                <th colSpan="3" className="th-group-income">INCOME / PENDAPATAN</th>
                                                <th colSpan="2" className="th-group-compare">PERBANDINGAN</th>
                                            </tr>
                                            <tr className="wsp-header-sub no-print">
                                                <th className="th-group-manpower">WORKERS</th>
                                                <th className="th-group-manpower border-right-section">HK</th>
                                                <th className="th-group-deductions">PPH 21</th>
                                                <th className="th-group-deductions border-right-section">SPSI</th>
                                                <th className="th-group-income">TOTAL PREMI</th>
                                                <th className="th-group-income">LEMBUR</th>
                                                <th className="th-group-income border-right-section">UPAH BERSIH (Portal)</th>
                                                <th className="th-group-compare">THUMB PRINT</th>
                                                <th className="th-group-compare">SELISIH</th>
                                            </tr>

                                            {/* PRINT VERSION of Summary Headers */}
                                            <tr className="wsp-header-master print-only">
                                                <th rowSpan="2" className="th-sticky-col th-gang-name" style={{ width: '25%' }}>ESTATE / DIVISI</th>
                                                <th colSpan="2" className="th-group-manpower">MANPOWER</th>
                                                <th colSpan="2" className="th-group-deductions">DEDUCTIONS / POTONGAN</th>
                                                <th colSpan="3" className="th-group-income">INCOME / PENDAPATAN</th>
                                                <th colSpan="2" className="th-group-compare">PERBANDINGAN</th>
                                            </tr>
                                            <tr className="wsp-header-sub print-only">
                                                <th className="th-group-manpower">WORKERS</th>
                                                <th className="th-group-manpower border-right-section">HK</th>
                                                <th className="th-group-deductions">PPH 21</th>
                                                <th className="th-group-deductions border-right-section">SPSI</th>
                                                <th className="th-group-income">TOTAL PREMI</th>
                                                <th className="th-group-income">LEMBUR</th>
                                                <th className="th-group-income border-right-section">UPAH BERSIH (Portal)</th>
                                                <th className="th-group-compare">THUMB PRINT</th>
                                                <th className="th-group-compare">SELISIH</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {summaryData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="10" style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                                                        <div>Tidak ada data tersedia untuk periode ini</div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {Object.keys(groupedData).map(key =>
                                                        renderEstateGroup(key, groupedData[key])
                                                    )}
                                                </>
                                            )}
                                        </tbody>
                                        {calculatedGrandTotal && (
                                            <tfoot>
                                                <tr className="wsp-grand-total">
                                                    <td className="text-left sticky-col">GRAND TOTAL</td>
                                                    <td className="text-right">{formatNumber(calculatedGrandTotal.total_employees)}</td>
                                                    <td className="text-right border-right-section">{formatNumber(calculatedGrandTotal.total_hk)}</td>
                                                    <td className="text-right">{formatNumber(calculatedGrandTotal.total_pph21)}</td>
                                                    <td className="text-right border-right-section">{formatNumber(calculatedGrandTotal.total_spsi)}</td>
                                                    <td className="text-right">{formatNumber(calculatedGrandTotal.total_premi_excluding_special || calculatedGrandTotal.total_premi)}</td>
                                                    <td className="text-right">{formatNumber(calculatedGrandTotal.total_lembur)}</td>
                                                    <td className="text-right border-right-section">{formatNumber(calculatedGrandTotal.total_manual)}</td>
                                                    <td className="text-right">{formatNumber(calculatedGrandTotal.thumb_print)}</td>
                                                    <td className={`text-center font-bold ${calculatedGrandTotal.selisih > 0 ? 'text-diff-neg' : calculatedGrandTotal.selisih < 0 ? 'text-diff-pos' : 'text-neutral'}`}>
                                                        {formatNumber(calculatedGrandTotal.selisih)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}

                            {/* Signature / Papan Penanda Tangan - visible on screen AND print */}
                            <div style={{
                                marginTop: '40px',
                                padding: '20px 24px',
                                background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                                border: '2px solid #c7d2fe',
                                borderRadius: '12px',
                                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.08)'
                            }} className="no-print">
                                <div style={{
                                    fontSize: '0.68rem',
                                    fontWeight: '800',
                                    color: '#4f46e5',
                                    letterSpacing: '0.12em',
                                    textTransform: 'uppercase',
                                    textAlign: 'center',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}>
                                    <span style={{ display: 'inline-block', width: '48px', height: '1px', background: '#c7d2fe' }} />
                                    ✍️ Papan Penanda Tangan
                                    <span style={{ display: 'inline-block', width: '48px', height: '1px', background: '#c7d2fe' }} />
                                </div>
                                <PrintSignature />
                            </div>
                            {/* Print-only version */}
                            <div className="print-only" style={{ marginTop: '40px' }}>
                                <PrintSignature />
                            </div>

                            {/* Report Footer */}
                            <footer className="wsp-footer" style={{ marginTop: '4rem' }}>
                                <div className="wsp-footer-left">
                                    <div>Dicetak: {printDate}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>User: {user?.username}</div>
                                </div>
                                <div className="wsp-footer-right">
                                    PT. REBINMAS JAYA
                                </div>
                            </footer>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
