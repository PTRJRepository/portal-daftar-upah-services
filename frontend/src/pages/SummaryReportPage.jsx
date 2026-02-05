/**
 * SummaryReportPage - Display aggregation summary from daftar_upah_aggregation_history
 * Professional Financial Report "Paper View" Style
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchDivisionSummary, fetchAvailablePeriods, fetchDivisionsWithData, validateAggregation } from '../services/summaryReportService';
import { generatePDF } from '../utils/pdfGenerator';
import AggregationSeederModal from '../components/AggregationSeederModal';
import '../styles/wages-summary-professional.css';

export default function SummaryReportPage({ onBack, initialDivision, initialMonth, initialYear }) {
    const { token, user } = useAuth();

    // Filters - Default to November since December may not have data yet
    const [division, setDivision] = useState(initialDivision || '');
    const [month, setMonth] = useState(initialMonth || 11);  // November
    const [year, setYear] = useState(initialYear || new Date().getFullYear());

    // Data
    const [divisions, setDivisions] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    const [gangDescriptions, setGangDescriptions] = useState({});
    const [grandTotal, setGrandTotal] = useState(null);
    const [filteredHeaders, setFilteredHeaders] = useState([]);

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSeederModal, setShowSeederModal] = useState(false);
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

    // Merge summary data with gang descriptions
    const mergedSummaryData = useMemo(() => {
        return summaryData.map(row => ({
            ...row,
            // Use real-time gang description if available, otherwise use stored description, fallback to gang_code
            gang_description: gangDescriptions[row.gang_code] || row.gang_description || row.gang_code
        }));
    }, [summaryData, gangDescriptions]);

    // Load available divisions
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
            const result = await fetchDivisionSummary(token, {
                division: division || undefined,
                month: month || undefined,
                year: year || undefined
            });

            if (result.success) {
                setSummaryData(result.data || []);
                setGrandTotal(result.grand_total || null);
                setFilteredHeaders(result.filtered_headers || []);
            } else {
                setError('Failed to fetch summary data');
            }
        } catch (e) {
            console.error('Error fetching summary:', e);
            setError(e.message || 'Failed to fetch summary data');
        } finally {
            setLoading(false);
        }
    }, [token, division, month, year]);

    // Fetch data when filters change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    // Formatters
    const formatNumber = (value) => {
        if (value === null || value === undefined || value === '') return '-';
        const num = Number(value);
        if (isNaN(num)) return '-';
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(num));
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
        let header = `Gang,Workers,HK Checkroll,${dynamicPremiHeaders.join(',')},Total Premi,Lembur,PPH 21,SPSI,Insentif,Kinerja,Pruning,Koreksi,Total Upah Bersih\n`;
        let csv = header;

        mergedSummaryData.forEach(row => {
            const premis = dynamicPremiHeaders.map(h => getDynamicPremiValue(row, h) || 0).join(',');
            // Calculate total_premi excluding special (insentif, kinerja, prunning)
            const totalPremiExcludingSpecial = (row.total_premi || 0) - (row.total_premi_insentif || 0) - (row.total_premi_kinerja || 0) - (row.total_premi_prunning || 0);

            csv += `"${row.gang_description || row.gang_code}",` +
                `${row.total_employees || 0},` +
                `${row.total_hk || 0},` +
                `${premis},` +
                `${totalPremiExcludingSpecial},` +
                `${row.total_lembur || 0},` +
                `${row.total_pph21 || 0},` +
                `${row.total_spsi || 0},` +
                `${row.total_premi_insentif || 0},` +
                `${row.total_premi_kinerja || 0},` +
                `${row.total_premi_prunning || 0},` +
                `${row.total_koreksi || 0},` +
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
                `${grandTotal.total_premi_excluding_special},` +
                `${grandTotal.total_lembur},` +
                `${grandTotal.total_pph21},` +
                `${grandTotal.total_spsi},` +
                `${grandTotal.total_premi_insentif},` +
                `${grandTotal.total_premi_kinerja},` +
                `${grandTotal.total_premi_prunning},` +
                `${grandTotal.total_koreksi},` +
                `${grandTotal.total_upah_bersih}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Summary_Detail_${division || 'ALL'}_${month}_${year}.csv`;
        link.click();
    };

    return (
        <div className="wsp-container">
            {/* Action Bar */}
            <div className="wsp-action-bar no-print">
                <div className="left-section">
                    {onBack && (
                        <button onClick={onBack} className="wsp-btn" title="Kembali">
                            Back
                        </button>
                    )}
                    <div className="wsp-filter-group" style={{ display: 'flex', gap: '0.5rem' }}>
                        <select
                            value={division}
                            onChange={e => setDivision(e.target.value)}
                            className="wsp-select"
                        >
                            <option value="">All Divisions</option>
                            {divisions.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="wsp-select">
                            {[...Array(12)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                            ))}
                        </select>
                        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="wsp-select">
                            {[2023, 2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="right-section">
                    <button onClick={() => setShowSeederModal(true)} className="wsp-btn" style={{ background: '#fbbf24', color: '#78350f' }}>
                        Seed Aggregation
                    </button>
                    <button onClick={handleValidate} className="wsp-btn" style={{ background: '#3b82f6', color: 'white' }} disabled={validating || loading}>
                        {validating ? 'Validating...' : 'Validate'}
                    </button>
                    <button onClick={fetchData} className="wsp-btn" disabled={loading}>Refresh</button>
                    <button onClick={handlePrint} className="wsp-btn">Print</button>
                    <button onClick={handleSavePDF} className="wsp-btn" title="Download Report as PDF">Save PDF</button>
                    <button onClick={handleExport} className="wsp-btn wsp-btn-primary" disabled={loading || summaryData.length === 0}>Export CSV</button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="wsp-loading"><div className="wsp-spinner"></div>Loading...</div>
            ) : error ? (
                <div className="wsp-error">! {error}</div>
            ) : (
                <div className="wsp-document" id="summary-report-content">
                    {/* Letterhead */}
                    <div className="wsp-letterhead">
                        <img src="/images/rebinmas.webp" alt="PT REBINMAS JAYA" className="wsp-logo" />
                        <h1 className="wsp-company-name">PT. REBINMAS JAYA</h1>
                        <div className="wsp-report-title">SUMMARY REPORT DETAIL</div>
                        <div className="wsp-report-period">
                            Division: <strong style={{ color: '#0f172a' }}>{division || 'ALL'}</strong> | Period: <strong style={{ color: '#0f172a' }}>{periodLabel}</strong>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    {grandTotal && (
                        <div className="wsp-kpi-grid">
                            <div className="wsp-kpi-card">
                                <div className="wsp-kpi-label">TOTAL WORKERS</div>
                                <div className="wsp-kpi-value">{formatNumber(grandTotal.total_employees)}</div>
                            </div>
                            <div className="wsp-kpi-card">
                                <div className="wsp-kpi-label">TOTAL HK CHEKROLL</div>
                                <div className="wsp-kpi-value">{formatNumber(grandTotal.total_hk)}</div>
                            </div>
                            <div className="wsp-kpi-card secondary">
                                <div className="wsp-kpi-label">TOTAL PREMI</div>
                                <div className="wsp-kpi-value">Rp {formatNumber(grandTotal.total_premi_excluding_special)}</div>
                            </div>
                            <div className="wsp-kpi-card highlight">
                                <div className="wsp-kpi-label">TOTAL UPAH BERSIH</div>
                                <div className="wsp-kpi-value">Rp {formatNumber(grandTotal.total_upah_bersih)}</div>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="wsp-table-wrapper">
                        <table className="wsp-table">
                            <thead>
                                <tr className="wsp-header-master">
                                    <th rowSpan="2" style={{ minWidth: '300px', width: '300px' }}>ESTATE / GANG</th>
                                    <th colSpan="2">MANPOWER</th>
                                    {/* Screen: Show full PREMI INCOME with all dynamic columns */}
                                    <th colSpan={dynamicPremiHeaders.length + 1} className="print-hide-detail">PREMI INCOME</th>
                                    {/* Print: Show only PREMI INCOME with 1 column (Total Premi) */}
                                    <th className="print-show-only">PREMI INCOME</th>
                                    <th rowSpan="2" style={{ width: '120px' }}>LEMBUR</th>
                                    <th colSpan="2">DEDUCTIONS</th>
                                    <th colSpan="4" className="print-hide-additional">ADDITIONAL INFO</th>
                                    <th rowSpan="2" style={{ width: '140px' }}>TOTAL UPAH BERSIH</th>
                                </tr>
                                <tr className="wsp-header-sub">
                                    {/* Manpower */}
                                    <th style={{ width: '60px' }}>WORKERS</th>
                                    <th style={{ width: '60px' }}>HK</th>

                                    {/* Premi Dynamic - Hidden on Print */}
                                    {dynamicPremiHeaders.map((h, i) => (
                                        <th key={i} style={{ minWidth: '90px' }} className="print-hide-detail">{h}</th>
                                    ))}

                                    <th style={{ width: '100px', background: '#334155' }}>TOTAL PREMI</th>

                                    {/* Deductions */}
                                    <th style={{ width: '90px' }}>PPH 21</th>
                                    <th style={{ width: '90px' }}>SPSI</th>

                                    {/* Additional Info / Specifics */}
                                    <th style={{ minWidth: '90px' }} className="print-hide-additional">INSENTIF</th>
                                    <th style={{ minWidth: '90px' }} className="print-hide-additional">KINERJA</th>
                                    <th style={{ minWidth: '90px' }} className="print-hide-additional">PRUNING</th>
                                    <th style={{ minWidth: '90px' }} className="print-hide-additional">KOREKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mergedSummaryData.length === 0 ? (
                                    <tr><td colSpan="15" className="text-center" style={{ padding: '3rem' }}>No Data Available</td></tr>
                                ) : (
                                    mergedSummaryData.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="text-left">{row.gang_description || row.gang_code}</td>
                                            <td className={`text-right ${!Number(row.total_employees) && 'val-zero'}`}>{formatNumber(row.total_employees)}</td>
                                            <td className={`text-right ${!Number(row.total_hk) && 'val-zero'}`}>{formatNumber(row.total_hk)}</td>

                                            {/* Dynamic Premi Cols */}
                                            {dynamicPremiHeaders.map(header => {
                                                const val = getDynamicPremiValue(row, header);
                                                return (
                                                    <td key={header} className={`text-right print-hide-detail ${!val && 'val-zero'}`}>
                                                        {formatNumber(val)}
                                                    </td>
                                                );
                                            })}

                                            {/* Total Premi - Excluding Insentif, Kinerja, Prunning */}
                                            <td className={`text-right ${!Number(row.total_premi_excluding_special ?? row.total_premi) && 'val-zero'}`} style={{ fontWeight: 600 }}>
                                                {formatNumber(row.total_premi_excluding_special ?? row.total_premi)}
                                            </td>

                                            <td className={`text-right ${!Number(row.total_lembur) && 'val-zero'}`}>{formatNumber(row.total_lembur)}</td>
                                            <td className={`text-right ${!Number(row.total_pph21) && 'val-zero'}`}>{formatNumber(row.total_pph21)}</td>
                                            <td className={`text-right ${!Number(row.total_spsi) && 'val-zero'}`}>{formatNumber(row.total_spsi)}</td>

                                            {/* Additional Info / Specifics */}
                                            <td className={`text-right print-hide-additional ${!Number(row.total_premi_insentif) && 'val-zero'}`}>{formatNumber(row.total_premi_insentif)}</td>
                                            <td className={`text-right print-hide-additional ${!Number(row.total_premi_kinerja) && 'val-zero'}`}>{formatNumber(row.total_premi_kinerja)}</td>
                                            <td className={`text-right print-hide-additional ${!Number(row.total_premi_prunning) && 'val-zero'}`}>{formatNumber(row.total_premi_prunning)}</td>
                                            <td className={`text-right print-hide-additional ${!Number(row.total_koreksi) && 'val-zero'}`}>{formatNumber(row.total_koreksi)}</td>

                                            <td className={`text-right ${!Number(row.total_upah_bersih) ? 'val-zero' : 'val-positive'}`} style={{ fontWeight: 600 }}>
                                                {formatNumber(row.total_upah_bersih)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>

                            {grandTotal && (
                                <tfoot>
                                    <tr className="wsp-grand-total">
                                        <td>GRAND TOTAL</td>
                                        <td className="text-right">{formatNumber(grandTotal.total_employees)}</td>
                                        <td className="text-right">{formatNumber(grandTotal.total_hk)}</td>

                                        {/* Dynamic Premi Totals - Hidden on Print */}
                                        {dynamicPremiHeaders.map(header => {
                                            const total = grandTotal.dynamic_premi_totals?.[header] || 0;
                                            return (
                                                <td key={header} className="text-right print-hide-detail">{formatNumber(total)}</td>
                                            );
                                        })}

                                        {/* Total Premi - Excluding Insentif, Kinerja, Prunning */}
                                        <td className="text-right">{formatNumber(grandTotal.total_premi_excluding_special)}</td>

                                        <td className="text-right">{formatNumber(grandTotal.total_lembur)}</td>
                                        <td className="text-right">{formatNumber(grandTotal.total_pph21)}</td>
                                        <td className="text-right">{formatNumber(grandTotal.total_spsi)}</td>

                                        {/* Additional Info Totals */}
                                        <td className="text-right print-hide-additional">{formatNumber(grandTotal.total_premi_insentif)}</td>
                                        <td className="text-right print-hide-additional">{formatNumber(grandTotal.total_premi_kinerja)}</td>
                                        <td className="text-right print-hide-additional">{formatNumber(grandTotal.total_premi_prunning)}</td>
                                        <td className="text-right print-hide-additional">{formatNumber(grandTotal.total_koreksi)}</td>

                                        <td className="text-right" style={{ color: '#4ade80' }}>{formatNumber(grandTotal.total_upah_bersih)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Signature Section */}
                    <div className="wsp-signature-section">
                        <div className="wsp-signature-block">
                            <div className="wsp-signature-title">DIBUAT OLEH :</div>
                            <div className="wsp-signature-name">( ........................................ )</div>
                        </div>
                        <div className="wsp-signature-block">
                            <div className="wsp-signature-title">DIPERIKSA OLEH :</div>
                            <div className="wsp-signature-name">( ........................................ )</div>
                        </div>
                        <div className="wsp-signature-block">
                            <div className="wsp-signature-title">DISETUJUI OLEH :</div>
                            <div className="wsp-signature-name">( ........................................ )</div>
                        </div>
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
