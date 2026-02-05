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
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [error, setError] = useState(null);
    const [showSeederModal, setShowSeederModal] = useState(false);

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

    // Month names for display
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'July', 'Agustus', 'september', 'Oktober', 'November', 'Desember'];
    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const handleSavePDF = () => {
        const element = document.getElementById('analysis-report-content');
        const filename = `Analysis_OT_Premi_${month}_${year}.pdf`;
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
    const periodLabel = reportData ? `${monthNames[reportData.current_period?.month - 1]} ${reportData.current_period?.year}` : '';

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
                        <h2 className="sw-report-title">ANALYSIS OT & PREMI REPORT</h2>
                        <div className="sw-report-period">
                            Comparison: {prevMonthName} {reportData.previous_period?.year} vs {currMonthName} {reportData.current_period?.year}
                        </div>
                    </header>

                    {/* KPI / Totals Overview */}
                    <div className="sw-kpi-grid">
                        <div className="sw-kpi-card">
                            <div className="sw-kpi-label">TOTAL PREMI {currMonthName}</div>
                            <div className="sw-kpi-value">{formatCurrency(reportData.totals?.curr_premi)}</div>
                        </div>
                        <div className={`sw-kpi-card ${reportData.totals?.diff_premi > 0 ? 'highlight' : ''}`}>
                            <div className="sw-kpi-label">DIFF PREMI</div>
                            <div className={`sw-kpi-value ${reportData.totals?.diff_premi > 0 ? 'diff-increase' : 'diff-decrease'}`}>
                                {formatCurrency(reportData.totals?.diff_premi)}
                            </div>
                        </div>
                        <div className="sw-kpi-card">
                            <div className="sw-kpi-label">TOTAL OT {currMonthName}</div>
                            <div className="sw-kpi-value">{formatCurrency(reportData.totals?.curr_ot)}</div>
                        </div>
                        <div className={`sw-kpi-card ${reportData.totals?.diff_ot > 0 ? 'highlight' : ''}`}>
                            <div className="sw-kpi-label">DIFF OT</div>
                            <div className={`sw-kpi-value ${reportData.totals?.diff_ot > 0 ? 'diff-increase' : 'diff-decrease'}`}>
                                {formatCurrency(reportData.totals?.diff_ot)}
                            </div>
                        </div>
                    </div>

                    {/* Section 1: OT & Premi Analysis */}
                    <div className="analysis-section">
                        <div className="analysis-section-title">
                            <span>OT & Premi Breakdown</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>Amount in IDR</span>
                        </div>
                        <div className="sw-table-wrapper">
                            <table className="sw-table">
                                <thead>
                                    <tr className="sw-header-group">
                                        <th colSpan="3" style={{ borderRight: '2px solid #fff' }}>DESCRIPTION</th>
                                        <th colSpan="3" className="header-premi" style={{ borderRight: '2px solid #fff' }}>PREMI</th>
                                        <th colSpan="3" className="header-ot">OVERTIME (LEMBUR)</th>
                                    </tr>
                                    <tr className="sw-header-cols">
                                        <th style={{ width: '40px' }}>No</th>
                                        <th style={{ width: '80px' }}>Divisi</th>
                                        <th style={{ textAlign: 'left' }}>Estate / Description</th>
                                        
                                        {/* Premi Cols */}
                                        <th className="text-right header-premi">{prevMonthName}</th>
                                        <th className="text-right header-premi">{currMonthName}</th>
                                        <th className="text-right header-premi">Diff</th>

                                        {/* OT Cols */}
                                        <th className="text-right header-ot">{prevMonthName}</th>
                                        <th className="text-right header-ot">{currMonthName}</th>
                                        <th className="text-right header-ot">Diff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.premi_ot_table?.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="text-center">{idx + 1}</td>
                                            <td className="text-center" style={{ fontWeight: 600 }}>{row.division_code}</td>
                                            <td className="text-left">{row.description || row.estate}</td>
                                            
                                            <td className="text-right">{formatCurrency(row.prev_premi)}</td>
                                            <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(row.curr_premi)}</td>
                                            <td className={`text-right ${getDiffClass(row.diff_premi)}`}>
                                                {getDiffLabel(row.diff_premi)}{formatCurrency(Math.abs(row.diff_premi))}
                                            </td>

                                            <td className="text-right">{formatCurrency(row.prev_ot)}</td>
                                            <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(row.curr_ot)}</td>
                                            <td className={`text-right ${getDiffClass(row.diff_ot)}`}>
                                                {getDiffLabel(row.diff_ot)}{formatCurrency(Math.abs(row.diff_ot))}
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {/* Subtotal Row */}
                                    <tr className="subtotal">
                                        <td colSpan="3" className="text-right">TOTAL</td>
                                        <td className="text-right">{formatCurrency(reportData.totals?.prev_premi)}</td>
                                        <td className="text-right">{formatCurrency(reportData.totals?.curr_premi)}</td>
                                        <td className={`text-right ${getDiffClass(reportData.totals?.diff_premi)}`}>
                                            {formatCurrency(reportData.totals?.diff_premi)}
                                        </td>
                                        <td className="text-right">{formatCurrency(reportData.totals?.prev_ot)}</td>
                                        <td className="text-right">{formatCurrency(reportData.totals?.curr_ot)}</td>
                                        <td className={`text-right ${getDiffClass(reportData.totals?.diff_ot)}`}>
                                            {formatCurrency(reportData.totals?.diff_ot)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 2: Pruning Analysis (if data exists) */}
                    {reportData.pruning_table && reportData.pruning_table.length > 0 && (
                        <div className="analysis-section">
                            <div className="analysis-section-title">
                                <span>Progressive Pruning Analysis</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>Amount in IDR</span>
                            </div>
                            <div className="sw-table-wrapper">
                                <table className="sw-table">
                                    <thead>
                                        <tr className="sw-header-group">
                                            <th colSpan="3" style={{ borderRight: '2px solid #fff' }}>DESCRIPTION</th>
                                            <th colSpan="3" className="header-pruning">PRUNING COST</th>
                                        </tr>
                                        <tr className="sw-header-cols">
                                            <th style={{ width: '40px' }}>No</th>
                                            <th style={{ width: '80px' }}>Divisi</th>
                                            <th style={{ textAlign: 'left' }}>Estate / Description</th>
                                            
                                            <th className="text-right header-pruning">{prevMonthName}</th>
                                            <th className="text-right header-pruning">{currMonthName}</th>
                                            <th className="text-right header-pruning">Diff</th>
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
                                        
                                        {/* Subtotal Row */}
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
