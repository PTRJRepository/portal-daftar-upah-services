/**
 * SummaryReportPage - Display aggregation summary from daftar_upah_aggregation_history
 * Professional Financial Report "Paper View" Style
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchDivisionSummary, fetchAvailablePeriods, fetchDivisionsWithData } from '../services/summaryReportService';
import { generatePDF } from '../utils/pdfGenerator';
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

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    // Extract dynamic premi headers - FILTERED to exclude specific types
    const dynamicPremiHeaders = useMemo(() => {
        if (summaryData.length === 0) return [];
        const allHeaders = summaryData[0]?._premi_headers || [];

        // Patterns to EXCLUDE from display (including KOREKSI to exclude from total_premi calculation)
        // Also excludes PANEN to normalize to INSENTIF PANEN in informasi tambahan
        const excludePatterns = ['prun', 'pruning', 'prunning', 'insentif_panen', 'insentif panen', 'tiket', 'koreksi', 'panen'];

        // Filter out excluded patterns
        return allHeaders.filter(header => {
            const headerLower = header.toLowerCase();
            return !excludePatterns.some(pattern => headerLower.includes(pattern));
        });
    }, [summaryData]);

    // Dynamic Header Keys
    const premiKeys = useMemo(() => {
        return dynamicPremiHeaders.map(h =>
            `premi_${h.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')}`
        );
    }, [dynamicPremiHeaders]);

    // Calculate Grand Total - using total_premi from database
    const grandTotal = useMemo(() => {
        if (summaryData.length === 0) return null;

        const total = {
            total_employees: 0,
            total_hk: 0,
            total_lembur: 0,
            total_pph21: 0,
            total_spsi: 0,
            total_upah_bersih: 0,
            total_premi: 0,  // Will be summed from database column total_premi
            // Informasi Tambahan
            total_insentif_panen: 0,
            total_prunning: 0,
            total_koreksi: 0
        };

        // Initialize dynamic premi totals
        premiKeys.forEach(key => total[key] = 0);

        summaryData.forEach(row => {
            total.total_employees += Number(row.total_employees) || 0;
            total.total_hk += Number(row.total_hk) || 0;
            total.total_lembur += Number(row.total_lembur) || 0;
            total.total_pph21 += Number(row.total_pph21) || 0;
            total.total_spsi += Number(row.total_spsi) || 0;
            total.total_upah_bersih += Number(row.total_upah_bersih) || 0;

            // Use total_premi directly from database, not calculated
            total.total_premi += Number(row.total_premi) || 0;

            // Still sum individual premi columns for display breakdown
            premiKeys.forEach(key => {
                const val = Number(row[key]) || 0;
                total[key] += val;
            });

            // Informasi Tambahan totals
            total.total_insentif_panen += Number(row.premi_insentif_panen) || 0;
            total.total_prunning += Number(row.premi_prunning || row.premi_pruning) || 0;
            total.total_koreksi += Number(row.total_koreksi) || 0;
        });

        return total;
    }, [summaryData, premiKeys]);

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
        let header = `Gang,Workers,HK Checkroll,${dynamicPremiHeaders.join(',')},Total Premi,Lembur,PPH 21,SPSI,Total Upah Bersih\n`;
        let csv = header;

        summaryData.forEach(row => {
            const premis = premiKeys.map(k => row[k] || 0).join(',');

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
            const premis = premiKeys.map(k => grandTotal[k] || 0).join(',');
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
                                <div className="wsp-kpi-value">Rp {formatNumber(grandTotal.total_premi)}</div>
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
                                    <th rowSpan="2" style={{ minWidth: '200px' }}>ESTATE / GANG</th>
                                    <th colSpan="2">MANPOWER</th>
                                    {dynamicPremiHeaders.length > 0 && (
                                        <th colSpan={dynamicPremiHeaders.length + 1} className="print-hide-detail">PREMI INCOME</th>
                                    )}
                                    <th rowSpan="2" style={{ width: '120px' }} className="print-show-only">TOTAL PREMI</th>
                                    <th rowSpan="2" style={{ width: '120px' }}>LEMBUR</th>
                                    <th colSpan="2">DEDUCTIONS</th>
                                    <th rowSpan="2" style={{ width: '140px' }}>TOTAL UPAH BERSIH</th>
                                    <th colSpan="3" style={{ background: '#475569' }} className="print-hide">INFORMASI TAMBAHAN</th>
                                </tr>
                                <tr className="wsp-header-sub">
                                    {/* Manpower */}
                                    <th style={{ width: '80px' }}>WORKERS</th>
                                    <th style={{ width: '80px' }}>HK</th>

                                    {/* Premi Dynamic - Hidden on Print */}
                                    {dynamicPremiHeaders.map((h, i) => (
                                        <th key={i} style={{ minWidth: '100px' }} className="print-hide-detail">{h}</th>
                                    ))}
                                    {dynamicPremiHeaders.length > 0 && (
                                        <th style={{ width: '120px', background: '#334155' }} className="print-hide-detail">TOTAL PREMI</th>
                                    )}

                                    {/* Deductions */}
                                    <th style={{ width: '100px' }}>PPH 21</th>
                                    <th style={{ width: '100px' }}>SPSI</th>

                                    {/* Informasi Tambahan - Hidden on Print */}
                                    <th style={{ width: '110px', background: '#475569' }} className="print-hide">INSENTIF PANEN</th>
                                    <th style={{ width: '100px', background: '#475569' }} className="print-hide">PRUNING</th>
                                    <th style={{ width: '100px', background: '#475569' }} className="print-hide">KOREKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryData.length === 0 ? (
                                    <tr><td colSpan="15" className="text-center" style={{ padding: '3rem' }}>No Data Available</td></tr>
                                ) : (
                                    summaryData.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="text-left">{row.gang_description || row.gang_code}</td>
                                            <td className={`text-right ${!Number(row.total_employees) && 'val-zero'}`}>{formatNumber(row.total_employees)}</td>
                                            <td className={`text-right ${!Number(row.total_hk) && 'val-zero'}`}>{formatNumber(row.total_hk)}</td>

                                            {/* Premi Cols - Hidden on Print */}
                                            {premiKeys.map(key => (
                                                <td key={key} className={`text-right print-hide-detail ${!Number(row[key]) && 'val-zero'}`}>
                                                    {formatNumber(row[key])}
                                                </td>
                                            ))}
                                            {/* Total Premi in PREMI INCOME group - hidden on print */}
                                            {premiKeys.length > 0 && (
                                                <td className={`text-right print-hide-detail ${!Number(row.total_premi) && 'val-zero'}`} style={{ fontWeight: 600 }}>
                                                    {formatNumber(row.total_premi)}
                                                </td>
                                            )}
                                            {/* Total Premi - shown only during print */}
                                            <td className={`text-right print-show-only ${!Number(row.total_premi) && 'val-zero'}`} style={{ fontWeight: 600 }}>
                                                {formatNumber(row.total_premi)}
                                            </td>

                                            <td className={`text-right ${!Number(row.total_lembur) && 'val-zero'}`}>{formatNumber(row.total_lembur)}</td>
                                            <td className={`text-right ${!Number(row.total_pph21) && 'val-zero'}`}>{formatNumber(row.total_pph21)}</td>
                                            <td className={`text-right ${!Number(row.total_spsi) && 'val-zero'}`}>{formatNumber(row.total_spsi)}</td>

                                            <td className={`text-right ${!Number(row.total_upah_bersih) ? 'val-zero' : 'val-positive'}`} style={{ fontWeight: 600 }}>
                                                {formatNumber(row.total_upah_bersih)}
                                            </td>

                                            {/* Informasi Tambahan Columns - Hidden on Print */}
                                            <td className={`text-right print-hide ${!Number(row.premi_insentif_panen) && 'val-zero'}`} style={{ background: 'rgba(71, 85, 105, 0.1)' }}>
                                                {formatNumber(row.premi_insentif_panen)}
                                            </td>
                                            <td className={`text-right print-hide ${!Number(row.premi_prunning || row.premi_pruning) && 'val-zero'}`} style={{ background: 'rgba(71, 85, 105, 0.1)' }}>
                                                {formatNumber(row.premi_prunning || row.premi_pruning)}
                                            </td>
                                            <td className={`text-right print-hide ${!Number(row.total_koreksi) && 'val-zero'}`} style={{ background: 'rgba(71, 85, 105, 0.1)' }}>
                                                {formatNumber(row.total_koreksi)}
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

                                        {/* Premi Totals - Hidden on Print */}
                                        {premiKeys.map(key => (
                                            <td key={key} className="text-right print-hide-detail">{formatNumber(grandTotal[key])}</td>
                                        ))}
                                        {/* Total Premi in PREMI INCOME group - hidden on print */}
                                        {premiKeys.length > 0 && (
                                            <td className="text-right print-hide-detail">{formatNumber(grandTotal.total_premi)}</td>
                                        )}
                                        {/* Total Premi - shown only during print */}
                                        <td className="text-right print-show-only">{formatNumber(grandTotal.total_premi)}</td>

                                        <td className="text-right">{formatNumber(grandTotal.total_lembur)}</td>
                                        <td className="text-right">{formatNumber(grandTotal.total_pph21)}</td>
                                        <td className="text-right">{formatNumber(grandTotal.total_spsi)}</td>
                                        <td className="text-right" style={{ color: '#4ade80' }}>{formatNumber(grandTotal.total_upah_bersih)}</td>

                                        {/* Informasi Tambahan Totals - Hidden on Print */}
                                        <td className="text-right print-hide">{formatNumber(grandTotal.total_insentif_panen)}</td>
                                        <td className="text-right print-hide">{formatNumber(grandTotal.total_prunning)}</td>
                                        <td className="text-right print-hide">{formatNumber(grandTotal.total_koreksi)}</td>
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
            )}
        </div>
    );
}
