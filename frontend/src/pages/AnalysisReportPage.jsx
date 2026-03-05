import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAnalysisReport, fetchAvailablePeriods } from '../services/summaryReportService';
import { generatePDF } from '../utils/pdfGenerator';
import { Printer, RefreshCw, FileText, Settings, X, Search } from 'lucide-react';
import AggregationSeederModal from '../components/AggregationSeederModal';
import PrintModeSelector from '../components/common/PrintModeSelector';
import PrintSignature from '../components/common/PrintSignature';
import { initPrintMode } from '../utils/printOptimizer';
import '../styles/wages-summary-professional.css';

export default function AnalysisReportPage({ onBack, initialMonth, initialYear }) {
    const { token, user } = useAuth();
    const [month, setMonth] = useState(initialMonth || new Date().getMonth() + 1);
    const [year, setYear] = useState(initialYear || new Date().getFullYear());
    const [filterType, setFilterType] = useState('all');

    // Sync state with props when they change (fix navigation freeze)
    useEffect(() => {
        if (initialMonth !== undefined) setMonth(initialMonth);
        if (initialYear !== undefined) setYear(initialYear);
    }, [initialMonth, initialYear]);

    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [error, setError] = useState(null);
    const [showSeederModal, setShowSeederModal] = useState(false);
    const [periods, setPeriods] = useState([]);

    // Range Filters
    const [wageRange, setWageRange] = useState({ min: '', max: '' });
    const [otRange, setOtRange] = useState({ min: '', max: '' });
    const [premiRange, setPremiRange] = useState({ min: '', max: '' });
    const [showFilters, setShowFilters] = useState(false);

    // Load available periods
    useEffect(() => {
        async function loadPeriods() {
            if (!token) return;
            try {
                const result = await fetchAvailablePeriods(token);
                setPeriods(result.periods || []);
            } catch (e) {
                console.error('Failed to load periods:', e);
            }
        }
        loadPeriods();
        initPrintMode();
    }, [token]);

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAnalysisReport(token, { month, year, type: filterType });
            if (data.success) {
                setReportData(data);
            } else {
                setError(data.error || 'Failed to load report');
            }
        } catch (e) {
            console.error('[AnalysisReportPage] Error:', e);
            setError(e.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    }, [token, month, year, filterType]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Formatters
    const formatCurrency = (val) => {
        if (val === null || val === undefined) return '-';
        return new Intl.NumberFormat('id-ID').format(Math.round(val));
    };

    const getDiffClass = (val) => {
        if (val > 0) return 'text-diff-neg'; // Red for increase in cost
        if (val < 0) return 'text-diff-pos'; // Green for decrease in cost
        return 'text-neutral';
    };

    const getDiffLabel = (val) => {
        if (val > 0) return '▲ ';
        if (val < 0) return '▼ ';
        return '';
    };

    const getMonthName = (m) => {
        const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return months[m] || '';
    };

    const shortMonthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    // Filter Logic
    const filterData = (data, field, range) => {
        if (!data) return [];
        return data.filter(row => {
            const val = row[field];
            const min = range.min !== '' ? parseFloat(range.min) : -Infinity;
            const max = range.max !== '' ? parseFloat(range.max) : Infinity;
            return val >= min && val <= max;
        });
    };

    // Filtered Data Sets
    const filteredMainTable = useMemo(() => {
        let data = reportData?.premi_ot_table || [];
        if (wageRange.min || wageRange.max) data = filterData(data, 'curr_wage', wageRange);
        if (otRange.min || otRange.max) data = filterData(data, 'curr_ot', otRange);
        if (premiRange.min || premiRange.max) data = filterData(data, 'curr_premi', premiRange);
        return data;
    }, [reportData, wageRange, otRange, premiRange]);

    const filteredPruningTable = useMemo(() => {
        let data = reportData?.pruning_table || [];
        if (premiRange.min || premiRange.max) data = filterData(data, 'curr_pruning', premiRange);
        return data;
    }, [reportData, premiRange]);

    const handleSavePDF = () => {
        const element = document.getElementById('wsp-report-content');
        const filename = `Analysis_Report_${getMonthName(month)}_${year}.pdf`;
        generatePDF(element, filename);
    };

    const handlePrint = () => window.print();

    // Year Options
    const yearOptions = useMemo(() => {
        const years = periods.map(p => p.year);
        return [...new Set(years)].sort((a, b) => b - a);
    }, [periods]);

    const prevMonthName = reportData ? shortMonthNames[reportData.previous_period?.month] : '';
    const currMonthName = reportData ? shortMonthNames[reportData.current_period?.month] : '';

    return (
        <div className="wsp-container" style={{ padding: '1.5rem', backgroundColor: '#f8fafc' }}>
            {/* Header / Action Bar */}
            <div className="report-header-web no-print">
                <div className="report-header-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={onBack}
                            className="wsp-btn"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            &larr; Kembali
                        </button>
                        <h1>Analysis & Progress Report</h1>
                    </div>
                    <p style={{ marginLeft: '4.5rem' }}>Laporan perbandingan biaya premi dan lembur antar periode.</p>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginLeft: '4.5rem' }}>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="report-filter-badge"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{getMonthName(m)}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="report-filter-badge"
                        >
                            {yearOptions.length > 0 ? yearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                            )) : <option value={year}>{year}</option>}
                        </select>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="report-filter-badge"
                        >
                            <option value="all">ALL DIVISIONS</option>
                            <option value="non_ijl">NON IJL (REBINMAS)</option>
                            <option value="ijl">IJL ONLY</option>
                        </select>
                    </div>
                </div>

                <div className="report-header-actions">
                    <button onClick={() => setShowFilters(!showFilters)} className={`wsp-btn ${showFilters ? 'wsp-btn-primary' : ''}`}>
                        {showFilters ? <X size={18} /> : <Settings size={18} />}
                        {showFilters ? 'Tutup Filter' : 'Filter Range'}
                    </button>
                    <button onClick={() => setShowSeederModal(true)} className="wsp-btn" style={{ backgroundColor: '#fffbeb', color: '#92400e' }}>
                        Seed Data
                    </button>
                    <button onClick={handlePrint} className="wsp-btn-primary">
                        <Printer size={18} /> Cetak
                    </button>
                    <button onClick={handleSavePDF} className="wsp-btn-secondary">
                        <FileText size={18} /> PDF
                    </button>
                    <button onClick={fetchData} className="wsp-btn-secondary" disabled={loading}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Range Filters Panel */}
            {showFilters && (
                <div className="no-print" style={{
                    padding: '1.5rem',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '2rem'
                }}>
                    <RangeInput label="Range Upah Bersih" range={wageRange} setRange={setWageRange} />
                    <RangeInput label="Range Lembur (OT)" range={otRange} setRange={setOtRange} />
                    <RangeInput label="Range Total Premi" range={premiRange} setRange={setPremiRange} />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="wsp-error" style={{ margin: '2rem auto' }}>
                    <div className="wsp-error-icon">!</div>
                    <div className="wsp-error-title">Gagal Memuat Analisis</div>
                    <div className="wsp-error-message">{error}</div>
                    <button onClick={fetchData} className="wsp-btn-primary" style={{ marginTop: '1rem' }}>Coba Lagi</button>
                </div>
            )}

            {/* Main Document */}
            {!loading && !error && reportData && (
                <div className="wsp-document" id="wsp-report-content">
                    {/* Letterhead */}
                    <div className="wsp-letterhead">
                        <img src="/images/rebinmas.webp" alt="Logo" className="wsp-logo" />
                        <h1 className="wsp-company-name">
                            {filterType === 'ijl' ? 'PT. IMPIAN JAYA LESTARI' : 'PT. REBINMAS JAYA'}
                        </h1>
                        <div className="wsp-report-title">Monthly Progress & Cost Analysis Report</div>
                        <div className="wsp-report-period">
                            Perbandingan: <strong>{getMonthName(reportData.previous_period?.month)} {reportData.previous_period?.year}</strong> vs <strong>{getMonthName(reportData.current_period?.month)} {reportData.current_period?.year}</strong>
                        </div>
                    </div>

                    {/* KPI Comparison Cards */}
                    <div className="wsp-kpi-grid comparison-grid">
                        <KPIComparisonCard
                            label="Total Premi"
                            prevLabel={prevMonthName}
                            currLabel={currMonthName}
                            prevValue={reportData.totals?.prev_premi}
                            currValue={reportData.totals?.curr_premi}
                            diff={reportData.totals?.diff_premi}
                            format={formatCurrency}
                            accent="#f59e0b"
                        />
                        <KPIComparisonCard
                            label="Total Lembur (OT)"
                            prevLabel={prevMonthName}
                            currLabel={currMonthName}
                            prevValue={reportData.totals?.prev_ot}
                            currValue={reportData.totals?.curr_ot}
                            diff={reportData.totals?.diff_ot}
                            format={formatCurrency}
                            accent="#8b5cf6"
                        />
                        <KPIComparisonCard
                            label="Total Pruning"
                            prevLabel={prevMonthName}
                            currLabel={currMonthName}
                            prevValue={reportData.totals?.prev_pruning}
                            currValue={reportData.totals?.curr_pruning}
                            diff={reportData.totals?.diff_pruning}
                            format={formatCurrency}
                            accent="#059669"
                        />
                    </div>

                    {/* Main Table: Premi & OT Comparison with Breakdown */}
                    <SummaryPremiOTTable
                        data={filteredMainTable}
                        totals={reportData.totals}
                        prevMonthName={prevMonthName}
                        currMonthName={currMonthName}
                        prevYear={reportData.previous_period?.year}
                        currYear={reportData.current_period?.year}
                        formatCurrency={formatCurrency}
                        getDiffClass={getDiffClass}
                    />

                    {/* Rincian Variasi Premi — ALL types per division */}
                    <PremiVariasiTable
                        data={filteredMainTable}
                        totals={reportData.totals}
                        currMonthName={currMonthName}
                        currYear={reportData.current_period?.year}
                        formatCurrency={formatCurrency}
                    />

                    {/* Section 4: Detailed Pruning Analysis */}
                    {filteredPruningTable.length > 0 && (
                        <div className="analysis-section" style={{ marginTop: '2rem' }}>
                            <div className="analysis-section-title" style={{ padding: '0.75rem 1rem', background: '#f1f5f9', borderLeft: '4px solid #0f172a', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span>Progressive Pruning Analysis</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>Data per Divisi</span>
                            </div>
                            <div className="wsp-table-wrapper">
                                <table className="wsp-table">
                                    <thead>
                                        <tr className="wsp-header-cols">
                                            <th style={{ width: '50px' }}>No</th>
                                            <th style={{ width: '100px' }}>Divisi</th>
                                            <th className="text-left">Estate / Description</th>
                                            <th className="text-right">{prevMonthName}</th>
                                            <th className="text-right">{currMonthName}</th>
                                            <th className="text-right">Progress</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPruningTable.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="text-center">{idx + 1}</td>
                                                <td className="text-center font-bold">{row.division_code}</td>
                                                <td className="text-left">{row.description}</td>
                                                <td className="text-right">{formatCurrency(row.prev_pruning)}</td>
                                                <td className="text-right font-bold">{formatCurrency(row.curr_pruning)}</td>
                                                <td className={`text-right font-bold ${getDiffClass(row.diff_pruning)}`}>
                                                    {getDiffLabel(row.diff_pruning)}{formatCurrency(Math.abs(row.diff_pruning))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="wsp-grand-total">
                                            <td colSpan="3" className="text-right">TOTAL PRUNING</td>
                                            <td className="text-right">{formatCurrency(reportData.totals?.prev_pruning)}</td>
                                            <td className="text-right">{formatCurrency(reportData.totals?.curr_pruning)}</td>
                                            <td className="text-right">{formatCurrency(reportData.totals?.diff_pruning)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Signature Section */}
                    <div className="print-only">
                        <PrintSignature />
                    </div>

                    {/* Footer */}
                    <footer className="wsp-footer">
                        <div className="wsp-footer-left">
                            <div>Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            <div style={{ fontSize: '0.65rem' }}>User: {user?.username}</div>
                        </div>
                        <div className="wsp-footer-right">
                            PT. REBINMAS JAYA - PROGRESS ANALYSIS REPORT
                        </div>
                    </footer>
                </div>
            )}

            {/* Aggregation Seeder Modal */}
            <AggregationSeederModal
                isOpen={showSeederModal}
                onClose={() => setShowSeederModal(false)}
                month={month}
                year={year}
                division={null}
            />
        </div>
    );
}

// Sub-components for cleaner code
const RangeInput = ({ label, range, setRange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
                type="number"
                placeholder="Min Rp"
                value={range.min}
                onChange={(e) => setRange({ ...range, min: e.target.value })}
                className="wsp-input"
                style={{ flex: 1 }}
            />
            <span style={{ color: '#94a3b8' }}>-</span>
            <input
                type="number"
                placeholder="Max Rp"
                value={range.max}
                onChange={(e) => setRange({ ...range, max: e.target.value })}
                className="wsp-input"
                style={{ flex: 1 }}
            />
        </div>
    </div>
);

const KPIComparisonCard = ({ label, prevLabel, currLabel, prevValue, currValue, diff, format, accent }) => {
    const isIncrease = diff > 0;
    return (
        <div className="wsp-kpi-card comparison-card" style={accent ? { borderLeft: `4px solid ${accent}` } : {}}>
            <div className="wsp-kpi-label">{label}</div>
            <div className="wsp-kpi-compare-row">
                <div className="wsp-kpi-trend-box prev">
                    <div className="trend-label">{prevLabel}</div>
                    <div className="trend-value">{format(prevValue)}</div>
                </div>
                <div className="wsp-kpi-trend-box curr">
                    <div className="trend-label">{currLabel}</div>
                    <div className="trend-value">{format(currValue)}</div>
                </div>
            </div>
            <div className={`wsp-kpi-diff ${isIncrease ? 'pos' : diff < 0 ? 'neg' : 'neutral'}`}>
                <span>Variance:</span>
                <strong>Rp {format(diff)} {isIncrease ? '▲' : diff < 0 ? '▼' : ''}</strong>
            </div>
        </div>
    );
};

const AnalysisTable = ({ title, data, prevMonth, currMonth, fieldPrefix, totalDiff, prevTotal, currTotal, formatCurrency, getDiffClass, getDiffLabel }) => (
    <div className="analysis-section" style={{ marginTop: '2rem' }}>
        <div className="analysis-section-title" style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderLeft: '4px solid #334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span>{title}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>Unit: IDR (Rupiah)</span>
        </div>
        <div className="wsp-table-wrapper">
            <table className="wsp-table">
                <thead>
                    <tr className="wsp-header-cols">
                        <th style={{ width: '50px' }}>No</th>
                        <th style={{ width: '100px' }}>Divisi</th>
                        <th className="text-left">Estate / Description</th>
                        <th className="text-right">{prevMonth}</th>
                        <th className="text-right">{currMonth}</th>
                        <th className="text-right">Selisih</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? (
                        data.map((row, idx) => {
                            const prev = row[`prev_${fieldPrefix}`];
                            const curr = row[`curr_${fieldPrefix}`];
                            const diff = row[`diff_${fieldPrefix}`];
                            return (
                                <tr key={idx}>
                                    <td className="text-center">{idx + 1}</td>
                                    <td className="text-center font-bold">{row.division_code}</td>
                                    <td className="text-left">{row.description || row.estate}</td>
                                    <td className="text-right">{formatCurrency(prev)}</td>
                                    <td className="text-right font-bold">{formatCurrency(curr)}</td>
                                    <td className={`text-right font-bold ${getDiffClass(diff)}`}>
                                        {getDiffLabel(diff)}{formatCurrency(Math.abs(diff))}
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                Tidak ada data yang sesuai dengan filter range.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr className="wsp-grand-total">
                        <td colSpan="3" className="text-right">TOTAL {title.toUpperCase()}</td>
                        <td className="text-right">{formatCurrency(prevTotal)}</td>
                        <td className="text-right">{formatCurrency(currTotal)}</td>
                        <td className="text-right">{formatCurrency(totalDiff)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
);

// Breakdown Mini Card — shows current value + trend
const BreakdownCard = ({ label, value, diff, format, bg, border, color, labelColor }) => (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '0.85rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>{label}</div>
        <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: '1rem', fontWeight: 700, color }}>{format(value)}</div>
        {diff !== undefined && diff !== 0 && (
            <div style={{ fontSize: '0.65rem', fontWeight: 600, marginTop: '0.25rem', color: diff > 0 ? '#dc2626' : '#16a34a' }}>
                {diff > 0 ? '▲' : '▼'} {format(Math.abs(diff))}
            </div>
        )}
    </div>
);

// Unified Summary Premi & OT Table with Breakdown Columns
const SummaryPremiOTTable = ({ data, totals, prevMonthName, currMonthName, prevYear, currYear, formatCurrency, getDiffClass }) => {
    const cellBorder = { border: '1px solid #94a3b8' };
    const monoFont = { fontFamily: "'Roboto Mono', monospace", fontSize: '0.75rem' };

    return (
        <div className="analysis-section" style={{ marginTop: '1.5rem' }}>
            <div className="analysis-section-title" style={{ padding: '0.75rem 1rem', background: '#0f172a', color: '#fff', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 0, borderRadius: '6px 6px 0 0' }}>
                <span>Summary Premi & OT — Per Division</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Amount in IDR</span>
            </div>
            <div className="wsp-table-wrapper" style={{ border: '2px solid #334155', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'auto' }}>
                <table className="wsp-table" style={{ borderCollapse: 'collapse', minWidth: '900px' }}>
                    <thead>
                        {/* Master Header */}
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                            <th rowSpan="2" style={{ ...cellBorder, padding: '8px', textAlign: 'left', minWidth: '150px', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 2 }}>ESTATE/DIVISI</th>
                            <th colSpan="5" style={{ ...cellBorder, textAlign: 'center', background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: '0.75rem' }}>
                                PREMI BREAKDOWN — {currMonthName} {currYear}
                            </th>
                            <th colSpan="2" style={{ ...cellBorder, textAlign: 'center', background: '#f5f3ff', color: '#5b21b6', fontWeight: 700, fontSize: '0.75rem' }}>
                                OVERTIME
                            </th>
                            <th colSpan="2" style={{ ...cellBorder, textAlign: 'center', background: '#fff7ed', color: '#9a3412', fontWeight: 700, fontSize: '0.75rem' }}>
                                PROGRESS (Δ)
                            </th>
                        </tr>
                        {/* Sub Header */}
                        <tr style={{ backgroundColor: '#f8fafc', fontSize: '0.7rem', fontWeight: 700 }}>
                            <th style={{ ...cellBorder, background: '#fffbeb', color: '#92400e', minWidth: '80px', padding: '6px' }}>PRUNING</th>
                            <th style={{ ...cellBorder, background: '#fffbeb', color: '#92400e', minWidth: '80px', padding: '6px' }}>BRONDOL</th>
                            <th style={{ ...cellBorder, background: '#fffbeb', color: '#92400e', minWidth: '80px', padding: '6px' }}>INSENTIF</th>
                            <th style={{ ...cellBorder, background: '#fffbeb', color: '#92400e', minWidth: '80px', padding: '6px' }}>KINERJA</th>
                            <th style={{ ...cellBorder, background: '#fef3c7', color: '#78350f', fontWeight: 800, minWidth: '90px', padding: '6px' }}>TOTAL</th>
                            <th style={{ ...cellBorder, background: '#f5f3ff', color: '#5b21b6', minWidth: '80px', padding: '6px' }}>{prevMonthName}</th>
                            <th style={{ ...cellBorder, background: '#f5f3ff', color: '#5b21b6', minWidth: '80px', padding: '6px' }}>{currMonthName}</th>
                            <th style={{ ...cellBorder, background: '#fff7ed', color: '#9a3412', fontSize: '0.65rem', minWidth: '80px', padding: '6px' }}>Δ PREMI</th>
                            <th style={{ ...cellBorder, background: '#fff7ed', color: '#9a3412', fontSize: '0.65rem', minWidth: '80px', padding: '6px' }}>Δ OT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => {
                            const zeroCl = '#cbd5e1';
                            return (
                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                    <td style={{ ...cellBorder, fontWeight: 700, padding: '6px 8px', textAlign: 'left', position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafbfc', zIndex: 1 }}>
                                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8rem' }}>{row.division_code}</span>
                                        {row.description && row.description !== row.division_code && (
                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.6rem', lineHeight: 1.2, marginTop: '1px' }}>{row.description}</span>
                                        )}
                                    </td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, color: (row.curr_pruning || 0) === 0 ? zeroCl : '#334155' }}>{formatCurrency(row.curr_pruning)}</td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, color: (row.curr_brondol || 0) === 0 ? zeroCl : '#334155' }}>{formatCurrency(row.curr_brondol)}</td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, color: (row.curr_insentif || 0) === 0 ? zeroCl : '#334155' }}>{formatCurrency(row.curr_insentif)}</td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, color: (row.curr_kinerja || 0) === 0 ? zeroCl : '#334155' }}>{formatCurrency(row.curr_kinerja)}</td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, fontWeight: 700, background: '#fefce8' }}>{formatCurrency(row.curr_premi)}</td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, color: '#64748b' }}>{formatCurrency(row.prev_ot)}</td>
                                    <td className="text-right" style={{ ...cellBorder, ...monoFont, fontWeight: 600 }}>{formatCurrency(row.curr_ot)}</td>
                                    <td className={`text-right ${getDiffClass(row.diff_premi)}`} style={{ ...cellBorder, ...monoFont, fontWeight: 600 }}>
                                        {formatCurrency(row.diff_premi)}
                                    </td>
                                    <td className={`text-right ${getDiffClass(row.diff_ot)}`} style={{ ...cellBorder, ...monoFont, fontWeight: 600 }}>
                                        {formatCurrency(row.diff_ot)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ backgroundColor: '#0f172a', color: '#fff', fontWeight: 800 }}>
                            <td style={{ ...cellBorder, borderColor: '#334155', padding: '8px', textAlign: 'right', position: 'sticky', left: 0, background: '#0f172a', zIndex: 1, fontSize: '0.8rem' }}>TOTAL C/ROLL</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont }}>{formatCurrency(totals.curr_pruning)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont }}>{formatCurrency(totals.curr_brondol)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont }}>{formatCurrency(totals.curr_insentif)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont }}>{formatCurrency(totals.curr_kinerja)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont, fontWeight: 800 }}>{formatCurrency(totals.curr_premi)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont }}>{formatCurrency(totals.prev_ot)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont }}>{formatCurrency(totals.curr_ot)}</td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont, color: (totals.diff_premi || 0) > 0 ? '#fca5a5' : '#86efac' }}>
                                {formatCurrency(totals.diff_premi)}
                            </td>
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#334155', ...monoFont, color: (totals.diff_ot || 0) > 0 ? '#fca5a5' : '#86efac' }}>
                                {formatCurrency(totals.diff_ot)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// Premi Variation Table — shows ALL premi types per division with totals
const PremiVariasiTable = ({ data, totals, currMonthName, currYear, formatCurrency }) => {
    const cellBorder = { border: '1px solid #94a3b8' };
    const monoFont = { fontFamily: "'Roboto Mono', monospace", fontSize: '0.75rem' };
    const zeroCl = '#cbd5e1';

    // Premi types definition
    const premiTypes = [
        { key: 'pruning', label: 'PRUNING', color: '#92400e' },
        { key: 'brondol', label: 'BRONDOL', color: '#991b1b' },
        { key: 'insentif', label: 'INSENTIF PANEN', color: '#166534' },
        { key: 'kinerja', label: 'KINERJA', color: '#1e40af' },
        { key: 'koreksi', label: 'KOREKSI', color: '#6b21a8' },
    ];

    return (
        <div className="analysis-section" style={{ marginTop: '2rem' }}>
            <div className="analysis-section-title" style={{ padding: '0.75rem 1rem', background: '#065f46', color: '#fff', fontWeight: 700, display: 'flex', justifyContent: 'space-between', marginBottom: 0, borderRadius: '6px 6px 0 0' }}>
                <span>Rincian Variasi Premi — Per Division ({currMonthName} {currYear})</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.8 }}>Amount in IDR</span>
            </div>
            <div className="wsp-table-wrapper" style={{ border: '2px solid #065f46', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'auto' }}>
                <table className="wsp-table" style={{ borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#ecfdf5' }}>
                            <th style={{ ...cellBorder, padding: '8px', textAlign: 'left', minWidth: '150px', position: 'sticky', left: 0, background: '#ecfdf5', zIndex: 2, fontWeight: 700, fontSize: '0.75rem' }}>
                                ESTATE/DIVISI
                            </th>
                            {premiTypes.map(pt => (
                                <th key={pt.key} style={{ ...cellBorder, minWidth: '95px', padding: '8px', textAlign: 'center', background: '#ecfdf5', color: pt.color, fontWeight: 700, fontSize: '0.7rem' }}>
                                    {pt.label}
                                </th>
                            ))}
                            <th style={{ ...cellBorder, minWidth: '110px', padding: '8px', textAlign: 'center', background: '#d1fae5', color: '#065f46', fontWeight: 800, fontSize: '0.75rem' }}>
                                TOTAL PREMI
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                                <td style={{ ...cellBorder, fontWeight: 700, padding: '6px 8px', textAlign: 'left', position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#f9fafb', zIndex: 1 }}>
                                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8rem' }}>{row.division_code}</span>
                                    {row.description && row.description !== row.division_code && (
                                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.6rem', lineHeight: 1.2, marginTop: '1px' }}>{row.description}</span>
                                    )}
                                </td>
                                {premiTypes.map(pt => {
                                    const val = row[`curr_${pt.key}`] || 0;
                                    return (
                                        <td key={pt.key} className="text-right" style={{ ...cellBorder, ...monoFont, color: val === 0 ? zeroCl : '#334155' }}>
                                            {formatCurrency(val)}
                                        </td>
                                    );
                                })}
                                <td className="text-right" style={{ ...cellBorder, ...monoFont, fontWeight: 700, background: '#ecfdf5', color: '#065f46' }}>
                                    {formatCurrency(row.curr_premi)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ backgroundColor: '#065f46', color: '#fff', fontWeight: 800 }}>
                            <td style={{ ...cellBorder, borderColor: '#047857', padding: '8px', textAlign: 'right', position: 'sticky', left: 0, background: '#065f46', zIndex: 1, fontSize: '0.8rem' }}>
                                TOTAL
                            </td>
                            {premiTypes.map(pt => (
                                <td key={pt.key} className="text-right" style={{ ...cellBorder, borderColor: '#047857', ...monoFont }}>
                                    {formatCurrency(totals[`curr_${pt.key}`])}
                                </td>
                            ))}
                            <td className="text-right" style={{ ...cellBorder, borderColor: '#047857', ...monoFont, fontWeight: 800 }}>
                                {formatCurrency(totals.curr_premi)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
