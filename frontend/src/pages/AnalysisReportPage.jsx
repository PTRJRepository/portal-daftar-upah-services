import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAnalysisReport } from '../services/summaryReportService';
import { generatePDF } from '../utils/pdfGenerator';
import MonthSelector from '../components/common/MonthSelector';
import LoadingScreen from '../components/common/LoadingScreen';
import AggregationSeederModal from '../components/AggregationSeederModal';
import PrintModeSelector from '../components/common/PrintModeSelector';
import { initPrintMode } from '../utils/printOptimizer';
import '../styles/analysis-report-print.css';

export default function AnalysisReportPage({ onBack, initialMonth, initialYear }) {
    const { token } = useAuth();
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

    // Range Filters
    const [wageRange, setWageRange] = useState({ min: '', max: '' });
    const [otRange, setOtRange] = useState({ min: '', max: '' });
    const [premiRange, setPremiRange] = useState({ min: '', max: '' });
    const [showFilters, setShowFilters] = useState(false);

    // Fetch data & Initialize print mode
    useEffect(() => {
        async function loadData() {
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
        }
        loadData();

        // Initialize print mode for optimized printing
        initPrintMode();
    }, [token, month, year, filterType]);

    // Format currency
    const formatCurrency = (val) => {
        if (val === null || val === undefined) return '-';
        return new Intl.NumberFormat('id-ID').format(Math.round(val));
    };

    // Get difference class
    const getDiffClass = (val) => {
        if (val > 0) return 'diff-increase';
        if (val < 0) return 'diff-decrease';
        return 'diff-neutral';
    };

    const getDiffLabel = (val) => {
        if (val > 0) return '▲ ';
        if (val < 0) return '▼ ';
        return '';
    };

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

    // Month names for display
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'July', 'Agustus', 'september', 'Oktober', 'November', 'Desember'];
    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const handleSavePDF = () => {
        const element = document.getElementById('analysis-report-content');
        const filename = `Analysis_Report_${month}_${year}.pdf`;
        generatePDF(element, filename);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <LoadingScreen isLoading={loading} message="Generating Financial Analysis..." />;
    }

    if (error) {
        return (
            <div className="summary-wages-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', color: '#dc2626' }}>
                    <h2>⚠️ Error Generating Report</h2>
                    <p>{error}</p>
                    <button onClick={onBack} className="sw-btn" style={{ marginTop: '1rem' }}>Back</button>
                </div>
            </div>
        );
    }

    // Prepare labels
    const prevMonthName = reportData ? shortMonthNames[reportData.previous_period?.month - 1] : '';
    const currMonthName = reportData ? shortMonthNames[reportData.current_period?.month - 1] : '';

    // Filtered Data Sets
    const wageData = filterData(reportData?.premi_ot_table, 'curr_wage', wageRange);
    const otData = filterData(reportData?.premi_ot_table, 'curr_ot', otRange);
    const premiData = filterData(reportData?.premi_ot_table, 'curr_premi', premiRange);

    return (
        <div className="summary-wages-container">
            {/* Action Bar */}
            <div className="sw-action-bar">
                <button onClick={onBack} className="sw-btn">
                    &larr; BACK
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>PERIOD:</span>
                        <MonthSelector
                            month={month}
                            year={year}
                            onChange={(m, y) => { setMonth(m); setYear(y); }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>FILTER:</span>
                        <select 
                            value={filterType} 
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{ 
                                padding: '0.4rem 0.8rem', 
                                borderRadius: '4px', 
                                border: '1px solid #cbd5e1',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                color: '#334155'
                            }}
                        >
                            <option value="all">ALL DIVISIONS</option>
                            <option value="non_ijl">NON IJL (REBINMAS)</option>
                            <option value="ijl">IJL ONLY</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="sw-btn"
                        style={{ background: showFilters ? '#e2e8f0' : 'white', color: '#334155' }}
                    >
                        {showFilters ? 'Hide Range Filters' : 'Show Range Filters'}
                    </button>
                </div>

                <div className="btn-group">
                    <button onClick={() => setShowSeederModal(true)} className="sw-btn" style={{ background: '#fbbf24', color: '#78350f' }}>
                        SEED AGGREGATION
                    </button>
                    <PrintModeSelector onPrint={handlePrint} />
                    <button onClick={handleSavePDF} className="sw-btn sw-btn-primary" title="Download Report as PDF">
                        SAVE PDF
                    </button>
                    <button onClick={handlePrint} className="sw-btn sw-btn-primary">
                        PRINT REPORT
                    </button>
                </div>
            </div>

            {/* Filter Controls */}
            {showFilters && (
                <div style={{ padding: '1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '2rem', justifyContent: 'center' }}>
                    <FilterGroup title="Upah Bersih Range" range={wageRange} setRange={setWageRange} />
                    <FilterGroup title="Lembur Range" range={otRange} setRange={setOtRange} />
                    <FilterGroup title="Premi Range" range={premiRange} setRange={setPremiRange} />
                </div>
            )}

            {/* Document (Paper) */}
            {reportData && (
                <div className="sw-document" id="analysis-report-content">
                    {/* Letterhead */}
                    <header className="sw-letterhead" style={{ position: 'relative' }}>
                        <img 
                            src="/images/rebinmas.webp" 
                            alt="Logo" 
                            style={{ 
                                position: 'absolute', 
                                left: 0, 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                height: '80px',
                                width: 'auto'
                            }} 
                        />
                        <h1 className="sw-company-name">
                            {filterType === 'ijl' ? 'PT. IMPIAN JAYA LESTARI' : 'PT. REBINMAS JAYA'}
                        </h1>
                        <h2 className="sw-report-title">FINANCIAL ANALYSIS REPORT</h2>
                        <div className="sw-report-period">
                            Comparison: {prevMonthName} {reportData.previous_period?.year} vs {currMonthName} {reportData.current_period?.year}
                        </div>
                    </header>

                    {/* KPI / Totals Overview */}
                    <div className="sw-kpi-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                         {/* Wage KPI */}
                         <div className="sw-kpi-card" style={{ gridColumn: 'span 2' }}>
                            <div className="sw-kpi-label">TOTAL UPAH BERSIH {currMonthName}</div>
                            <div className="sw-kpi-value">{formatCurrency(reportData.totals?.curr_wage)}</div>
                            <div style={{ fontSize: '0.8rem', color: reportData.totals?.diff_wage > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                                Diff: {formatCurrency(reportData.totals?.diff_wage)} ({getDiffLabel(reportData.totals?.diff_wage)})
                            </div>
                        </div>

                        {/* OT KPI */}
                        <div className="sw-kpi-card" style={{ gridColumn: 'span 2' }}>
                            <div className="sw-kpi-label">TOTAL LEMBUR {currMonthName}</div>
                            <div className="sw-kpi-value">{formatCurrency(reportData.totals?.curr_ot)}</div>
                            <div style={{ fontSize: '0.8rem', color: reportData.totals?.diff_ot > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                                Diff: {formatCurrency(reportData.totals?.diff_ot)} ({getDiffLabel(reportData.totals?.diff_ot)})
                            </div>
                        </div>

                         {/* Premi KPI */}
                         <div className="sw-kpi-card" style={{ gridColumn: 'span 2' }}>
                            <div className="sw-kpi-label">TOTAL PREMI {currMonthName}</div>
                            <div className="sw-kpi-value">{formatCurrency(reportData.totals?.curr_premi)}</div>
                            <div style={{ fontSize: '0.8rem', color: reportData.totals?.diff_premi > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                                Diff: {formatCurrency(reportData.totals?.diff_premi)} ({getDiffLabel(reportData.totals?.diff_premi)})
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Wage Analysis */}
                    <AnalysisTable 
                        title="Analisis Upah Bersih" 
                        data={wageData} 
                        prevMonth={prevMonthName} 
                        currMonth={currMonthName} 
                        fieldPrefix="wage"
                        totalDiff={reportData.totals?.diff_wage}
                        prevTotal={reportData.totals?.prev_wage}
                        currTotal={reportData.totals?.curr_wage}
                        formatCurrency={formatCurrency}
                        getDiffClass={getDiffClass}
                        getDiffLabel={getDiffLabel}
                    />

                     {/* Section 2: Overtime Analysis */}
                     <AnalysisTable 
                        title="Analisis Lembur (Overtime)" 
                        data={otData} 
                        prevMonth={prevMonthName} 
                        currMonth={currMonthName} 
                        fieldPrefix="ot"
                        totalDiff={reportData.totals?.diff_ot}
                        prevTotal={reportData.totals?.prev_ot}
                        currTotal={reportData.totals?.curr_ot}
                        formatCurrency={formatCurrency}
                        getDiffClass={getDiffClass}
                        getDiffLabel={getDiffLabel}
                    />

                    {/* Section 3: Premi Analysis */}
                    <AnalysisTable 
                        title="Analisis Premi" 
                        data={premiData} 
                        prevMonth={prevMonthName} 
                        currMonth={currMonthName} 
                        fieldPrefix="premi"
                        totalDiff={reportData.totals?.diff_premi}
                        prevTotal={reportData.totals?.prev_premi}
                        currTotal={reportData.totals?.curr_premi}
                        formatCurrency={formatCurrency}
                        getDiffClass={getDiffClass}
                        getDiffLabel={getDiffLabel}
                    />

                    {/* Section 4: Pruning Analysis (if data exists) */}
                    {reportData.pruning_table && reportData.pruning_table.length > 0 && (
                         <div className="analysis-section">
                            <div className="analysis-section-title">
                                <span>Progressive Pruning Analysis</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>Amount in IDR</span>
                            </div>
                            <div className="sw-table-wrapper">
                                <table className="sw-table">
                                    <thead>
                                        <tr className="sw-header-cols">
                                            <th style={{ width: '40px' }}>No</th>
                                            <th style={{ width: '80px' }}>Divisi</th>
                                            <th style={{ textAlign: 'left' }}>Estate / Description</th>
                                            <th className="text-right">{prevMonthName}</th>
                                            <th className="text-right">{currMonthName}</th>
                                            <th className="text-right">Diff</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.pruning_table.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="text-center">{idx + 1}</td>
                                                <td className="text-center" style={{ fontWeight: 600 }}>{row.division_code}</td>
                                                <td className="text-left">{row.description || row.estate}</td>
                                                <td className="text-right">{formatCurrency(row.prev_pruning)}</td>
                                                <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(row.curr_pruning)}</td>
                                                <td className={`text-right ${getDiffClass(row.diff_pruning)}`}>
                                                    {getDiffLabel(row.diff_pruning)}{formatCurrency(Math.abs(row.diff_pruning))}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="subtotal">
                                            <td colSpan="3" className="text-right">TOTAL</td>
                                            <td className="text-right">{formatCurrency(reportData.totals?.prev_pruning)}</td>
                                            <td className="text-right">{formatCurrency(reportData.totals?.curr_pruning)}</td>
                                            <td className={`text-right ${getDiffClass(reportData.totals?.diff_pruning)}`}>
                                                {formatCurrency(reportData.totals?.diff_pruning)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Signature Section */}
                    <div className="sw-signature-section">
                        <div className="sw-signature-block">
                            <div className="sw-signature-title">PREPARED BY :</div>
                            <div className="sw-signature-name">( ........................................ )</div>
                        </div>
                        <div className="sw-signature-block">
                            <div className="sw-signature-title">CHECKED BY :</div>
                            <div className="sw-signature-name">( ........................................ )</div>
                        </div>
                        <div className="sw-signature-block">
                            <div className="sw-signature-title">APPROVED BY :</div>
                            <div className="sw-signature-name">( ........................................ )</div>
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="sw-footer">
                        <div>Printed on: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        <div>PT. REBINMAS JAYA - FINANCIAL ANALYSIS REPORT</div>
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

// Reusable Components

const FilterGroup = ({ title, range, setRange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b' }}>{title}</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
                type="number" 
                placeholder="Min" 
                value={range.min} 
                onChange={(e) => setRange({ ...range, min: e.target.value })}
                style={{ width: '100px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
            <span style={{ color: '#94a3b8' }}>-</span>
            <input 
                type="number" 
                placeholder="Max" 
                value={range.max} 
                onChange={(e) => setRange({ ...range, max: e.target.value })}
                style={{ width: '100px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
            />
        </div>
    </div>
);

const AnalysisTable = ({ title, data, prevMonth, currMonth, fieldPrefix, totalDiff, prevTotal, currTotal, formatCurrency, getDiffClass, getDiffLabel }) => (
    <div className="analysis-section">
        <div className="analysis-section-title">
            <span>{title}</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>Amount in IDR</span>
        </div>
        <div className="sw-table-wrapper">
            <table className="sw-table">
                <thead>
                    <tr className="sw-header-cols">
                        <th style={{ width: '40px' }}>No</th>
                        <th style={{ width: '80px' }}>Divisi</th>
                        <th style={{ textAlign: 'left' }}>Estate / Description</th>
                        <th className="text-right">{prevMonth}</th>
                        <th className="text-right">{currMonth}</th>
                        <th className="text-right">Diff</th>
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
                                    <td className="text-center" style={{ fontWeight: 600 }}>{row.division_code}</td>
                                    <td className="text-left">{row.description || row.estate}</td>
                                    <td className="text-right">{formatCurrency(prev)}</td>
                                    <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(curr)}</td>
                                    <td className={`text-right ${getDiffClass(diff)}`}>
                                        {getDiffLabel(diff)}{formatCurrency(Math.abs(diff))}
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="6" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                                No data matches filters
                            </td>
                        </tr>
                    )}
                    
                    {/* Subtotal Row - Only show totals if not filtering or handle properly */}
                    {/* If filtering, simple sum of displayed rows would be better, but sticking to global totals for now as per design unless requested */}
                    <tr className="subtotal">
                        <td colSpan="3" className="text-right">TOTAL (Global)</td>
                        <td className="text-right">{formatCurrency(prevTotal)}</td>
                        <td className="text-right">{formatCurrency(currTotal)}</td>
                        <td className={`text-right ${getDiffClass(totalDiff)}`}>
                            {formatCurrency(totalDiff)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
);