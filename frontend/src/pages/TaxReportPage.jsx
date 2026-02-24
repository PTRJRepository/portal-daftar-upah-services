import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { fetchMonthlyTaxReport, fetchAnnualTaxReport, fetchAnnualAstekBpjsReport, downloadMonthlyTaxReportExcel } from '../services/taxReportService';
import { Calculator, BarChart2, CalendarDays, Activity, FileWarning, Search, ChevronDown, ChevronRight, DollarSign, Download } from 'lucide-react';
import '../styles/TaxReportPage.css';

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const formatNumber = (val) => {
    if (val === null || val === undefined || val === 0) return '-';
    return new Intl.NumberFormat('id-ID').format(Math.round(val));
};

const formatPercent = (val) => {
    if (val === null || val === undefined || val === 0) return '-';
    return `${val.toFixed(2)}%`;
};

// ================================================================
// TAB 1: Pajak Bulanan (Monthly PPH21)
// ================================================================
function MonthlyTaxTab({ token, year: contextYear, month: contextMonth, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloadingExcel, setDownloadingExcel] = useState(false);
    const [error, setError] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(contextMonth);
    const [selectedYear, setSelectedYear] = useState(contextYear);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRow = (empCode) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(empCode)) {
            newExpanded.delete(empCode);
        } else {
            newExpanded.add(empCode);
        }
        setExpandedRows(newExpanded);
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchMonthlyTaxReport(token, selectedYear, selectedMonth, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, selectedYear, selectedMonth, division, gang]);

    const handleDownloadExcel = async () => {
        setDownloadingExcel(true);
        try {
            await downloadMonthlyTaxReportExcel(token, selectedYear, selectedMonth, division, gang);
        } catch (err) {
            alert('Gagal mengunduh Excel: ' + (err.message || 'Unknown error'));
        } finally {
            setDownloadingExcel(false);
        }
    };

    useEffect(() => { loadData(); }, [loadData]);

    // Year options
    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = contextYear; y >= contextYear - 3; y--) years.push(y);
        return years;
    }, [contextYear]);

    if (loading) return (
        <div className="tax-report-loading">
            <span className="spinner"></span> Memuat data pajak bulanan...
        </div>
    );

    if (error) return (
        <div className="tax-report-empty">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <div>
            {/* Period Selector */}
            <div className="tax-report-period-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label>📅 Periode:</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                        {MONTH_NAMES.map((name, idx) => (
                            <option key={idx} value={idx + 1}>{name}</option>
                        ))}
                    </select>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {data && data.employees.length > 0 && (
                    <button
                        onClick={handleDownloadExcel}
                        disabled={downloadingExcel}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            cursor: downloadingExcel ? 'not-allowed' : 'pointer',
                            opacity: downloadingExcel ? 0.7 : 1,
                            transition: 'background-color 0.2s'
                        }}
                    >
                        <Download size={16} />
                        {downloadingExcel ? 'Mengunduh...' : 'Unduh Excel (Formula)'}
                    </button>
                )}
            </div>

            {!data || data.employees.length === 0 ? (
                <div className="tax-report-empty">
                    <h3><FileWarning size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Tidak Ada Data</h3>
                    <p>Data pajak untuk {MONTH_NAMES[selectedMonth - 1]} {selectedYear} belum tersedia. Pastikan data sudah di-seed melalui Aggregation Seeder.</p>
                </div>
            ) : (
                <div className="tax-report-table-wrapper">
                    <table className="tax-report-table">
                        <thead>
                            <tr>
                                <th className="col-no">No</th>
                                <th className="col-name">Nama</th>
                                <th>L/P</th>
                                <th>Status PTKP</th>
                                <th>Kategori TER</th>
                                <th>Gang</th>
                                <th>Upah Kotor</th>
                                <th>Penghasilan Bruto</th>
                                <th>Tarif TER (%)</th>
                                <th>PPH21</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp, idx) => {
                                const isExpanded = expandedRows.has(emp.emp_code);
                                return (
                                    <React.Fragment key={emp.emp_code}>
                                        <tr
                                            onClick={() => toggleRow(emp.emp_code)}
                                            style={{ cursor: 'pointer' }}
                                            className={isExpanded ? 'active-row' : ''}
                                        >
                                            <td className="text-center col-no">
                                                <span style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </span>
                                                {idx + 1}
                                            </td>
                                            <td className="col-name">{emp.emp_name}</td>
                                            <td className="text-center">{emp.gender === 'L' || emp.gender === 'M' ? 'L' : 'P'}</td>
                                            <td className="text-center">{emp.status_ptkp}</td>
                                            <td className="text-center">{emp.kategori_ter}</td>
                                            <td className="text-center">{emp.gang_code}</td>
                                            <td className="text-right">{formatNumber(emp.upah_kotor)}</td>
                                            <td className="text-right">{formatNumber(emp.penghasilan_bruto)}</td>
                                            <td className="text-center">{formatPercent(emp.tarif_pajak_ter)}</td>
                                            <td className="text-right">{formatNumber(emp.pph21_ter)}</td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="expanded-row-detail" style={{ backgroundColor: '#f8fafc' }}>
                                                <td colSpan={10} style={{ padding: '16px' }}>
                                                    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>

                                                        {/* RINCIAN UPAH KOTOR */}
                                                        <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: 'white' }}>
                                                            <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontSize: '13px', color: '#1e293b' }}>
                                                                Rincian Upah Kotor
                                                            </h4>
                                                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                                                <tbody>
                                                                    <tr><td style={{ padding: '4px 0' }}>Hari Kerja (HK)</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.hk)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Gaji Pokok Aktual</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.gaji_pokok_aktual)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Gaji Pokok Total <span style={{ color: '#64748b', fontSize: '10px' }}>(HK × Pokok)</span></td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber((emp.hk || 0) * (emp.gaji_pokok_aktual || 0))}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Koreksi HK</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.koreksi_hk)}</td></tr>
                                                                    <tr><td colSpan={2} style={{ height: '8px', borderBottom: '1px dashed #e2e8f0' }}></td></tr>

                                                                    <tr><td style={{ paddingTop: '8px' }}>Tunjangan Beras</td><td className="text-right" style={{ paddingTop: '8px' }}>{formatNumber(emp.tunjangan_beras)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Tunjangan Jabatan</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.tunjangan_jabatan)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Tunjangan Masa Kerja</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.tunjangan_masa_kerja)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Tunjangan Lembur</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.tunjangan_lembur)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Tunjangan Lainnya</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber((emp.total_tunjangan || 0) - (emp.tunjangan_beras || 0) - (emp.tunjangan_jabatan || 0) - (emp.tunjangan_masa_kerja || 0) - (emp.tunjangan_lembur || 0))}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Total Tunjangan</td><td className="text-right" style={{ padding: '4px 0', fontWeight: 'bold' }}>{formatNumber(emp.total_tunjangan)}</td></tr>
                                                                    <tr><td colSpan={2} style={{ height: '8px', borderBottom: '1px dashed #e2e8f0' }}></td></tr>

                                                                    <tr><td style={{ paddingTop: '8px' }}>Premi PPH</td><td className="text-right" style={{ paddingTop: '8px' }}>{formatNumber(emp.premi_pph)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Premi Brondol</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.premi_brondol)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0' }}>Premi Lainnya</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber((emp.total_premi || 0) - (emp.premi_pph || 0) - (emp.premi_brondol || 0))}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Total Premi</td><td className="text-right" style={{ padding: '4px 0', fontWeight: 'bold' }}>{formatNumber(emp.total_premi)}</td></tr>
                                                                    <tr><td colSpan={2} style={{ height: '8px', borderBottom: '1px dashed #e2e8f0' }}></td></tr>

                                                                    <tr><td style={{ paddingTop: '8px', color: '#dc2626' }}>Potongan SPSI</td><td className="text-right" style={{ paddingTop: '8px', color: '#dc2626' }}>-{formatNumber(emp.pot_spsi)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0', color: '#dc2626' }}>Potongan Koreksi</td><td className="text-right" style={{ padding: '4px 0', color: '#dc2626' }}>-{formatNumber(emp.pot_koreksi)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0', fontWeight: 'bold', color: '#dc2626' }}>Total Potongan (Kotor)</td><td className="text-right" style={{ padding: '4px 0', fontWeight: 'bold', color: '#dc2626' }}>-{formatNumber(emp.total_potongan_kotor)}</td></tr>

                                                                    <tr><td colSpan={2} style={{ height: '8px', borderBottom: '1px solid #94a3b8' }}></td></tr>
                                                                    <tr>
                                                                        <td style={{ paddingTop: '8px', fontWeight: 'bold', fontSize: '13px' }}>TOTAL UPAH KOTOR</td>
                                                                        <td className="text-right" style={{ paddingTop: '8px', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{formatNumber(emp.upah_kotor)}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* RINCIAN PENGHASILAN BRUTO */}
                                                        <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: 'white' }}>
                                                            <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontSize: '13px', color: '#1e293b' }}>
                                                                Rincian Penghasilan Bruto (Kena Pajak)
                                                            </h4>
                                                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                                                <tbody>
                                                                    <tr><td style={{ padding: '4px 0' }}>Upah Kotor</td><td className="text-right" style={{ padding: '4px 0' }}>{formatNumber(emp.upah_kotor)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0', color: '#16a34a' }}>(+) BPJS Kesehatan (Ditanggung Majikan 4%)</td><td className="text-right" style={{ padding: '4px 0', color: '#16a34a' }}>{formatNumber(emp.bpjs_kes_majikan)}</td></tr>
                                                                    <tr><td style={{ padding: '4px 0', color: '#16a34a' }}>(+) ASTEK JKK/JKM (Ditanggung Majikan)</td><td className="text-right" style={{ padding: '4px 0', color: '#16a34a' }}>{formatNumber(emp.astek_jht_majikan)}</td></tr>
                                                                    <tr><td colSpan={2} style={{ height: '8px', borderBottom: '1px solid #94a3b8' }}></td></tr>
                                                                    <tr>
                                                                        <td style={{ paddingTop: '8px', fontWeight: 'bold', fontSize: '13px' }}>TOTAL PENGHASILAN BRUTO</td>
                                                                        <td className="text-right" style={{ paddingTop: '8px', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{formatNumber(emp.penghasilan_bruto)}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>

                                                            <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '4px', borderLeft: '4px solid #3b82f6' }}>
                                                                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e293b' }}>Kalkulasi PPH21 (Metode TER)</h4>
                                                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                                                    <tbody>
                                                                        <tr><td style={{ padding: '2px 0' }}>Status PTKP Master</td><td className="text-right" style={{ padding: '2px 0', fontWeight: 'bold' }}>{emp.status_ptkp}</td></tr>
                                                                        <tr><td style={{ padding: '2px 0' }}>Kategori TER</td><td className="text-right" style={{ padding: '2px 0', fontWeight: 'bold' }}>{emp.kategori_ter}</td></tr>
                                                                        <tr><td style={{ padding: '2px 0' }}>Tarif Pajak Efektif</td><td className="text-right" style={{ padding: '2px 0', fontWeight: 'bold' }}>{formatPercent(emp.tarif_pajak_ter)}</td></tr>
                                                                        <tr><td colSpan={2} style={{ height: '4px', borderBottom: '1px solid #94a3b8' }}></td></tr>
                                                                        <tr>
                                                                            <td style={{ paddingTop: '4px', fontWeight: 'bold' }}>POTONGAN PPH21</td>
                                                                            <td className="text-right" style={{ paddingTop: '4px', fontWeight: 'bold', color: '#dc2626' }}>{formatNumber(emp.pph21_ter)}</td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} className="text-right"><strong>TOTAL</strong></td>
                                <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.upah_kotor, 0))}</td>
                                <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.penghasilan_bruto, 0))}</td>
                                <td></td>
                                <td className="text-right"><strong>{formatNumber(data.total_pph21)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ================================================================
// TAB 2: Pajak Tahunan (Annual Tax)
// ================================================================
function AnnualTaxTab({ token, year: contextYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(contextYear);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchAnnualTaxReport(token, selectedYear, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, selectedYear, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = contextYear; y >= contextYear - 3; y--) years.push(y);
        return years;
    }, [contextYear]);

    if (loading) return (
        <div className="tax-report-loading">
            <span className="spinner"></span> Memuat data pajak tahunan (12 bulan)...
        </div>
    );

    if (error) return (
        <div className="tax-report-empty">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <div>
            {/* Year Selector */}
            <div className="tax-report-period-bar">
                <label>📅 Tahun:</label>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                {data && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Data tersedia: {data.available_months.map(m => MONTH_NAMES[m - 1]).join(', ') || 'Belum ada'}
                    </span>
                )}
            </div>

            {!data || data.employees.length === 0 ? (
                <div className="tax-report-empty">
                    <h3><FileWarning size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Tidak Ada Data</h3>
                    <p>Data pajak untuk tahun {selectedYear} belum tersedia.</p>
                </div>
            ) : (
                <>
                    {/* Section 1: Penghasilan Setahun */}
                    <h3 className="tax-report-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DollarSign size={20} /> Penghasilan Setahun — {selectedYear}
                    </h3>
                    <div className="tax-report-table-wrapper" style={{ marginBottom: '2rem' }}>
                        <table className="tax-report-table">
                            <thead>
                                <tr>
                                    <th className="col-no" rowSpan={2}>No</th>
                                    <th className="col-name" rowSpan={2}>Name</th>
                                    <th rowSpan={2}>L/P</th>
                                    <th rowSpan={2}>Stat</th>
                                    <th rowSpan={2}>BL</th>
                                    <th colSpan={12} style={{ textAlign: 'center' }}>PENGHASILAN SETAHUN</th>
                                    <th rowSpan={2}>TOTAL<br />Jan s/d Des</th>
                                    <th className="header-only" rowSpan={2}>THR</th>
                                    <th className="header-only" rowSpan={2}>Bonus</th>
                                    <th className="header-only" rowSpan={2}>Medical<br />Claim</th>
                                    <th rowSpan={2}>BPJS<br />Kes 4%</th>
                                    <th rowSpan={2}>ASTEK<br />JHT</th>
                                    <th rowSpan={2}>Total Penghasilan<br />Setahun</th>
                                    <th rowSpan={2}>PhP</th>
                                </tr>
                                <tr>
                                    {MONTH_NAMES.map((name, idx) => (
                                        <th className="sub-header" key={idx}>{name.substring(0, 3)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.employees.map((emp, idx) => (
                                    <tr key={emp.emp_code}>
                                        <td className="text-center col-no">{idx + 1}</td>
                                        <td className="col-name">{emp.emp_name}</td>
                                        <td className="text-center">{emp.gender === 'L' || emp.gender === 'M' ? 'L' : 'P'}</td>
                                        <td className="text-center">{emp.status_ptkp}</td>
                                        <td className="text-center">{emp.kategori_ter}</td>
                                        {Array.from({ length: 12 }, (_, m) => (
                                            <td key={m} className="text-right">
                                                {formatNumber(emp.monthly_income?.[String(m + 1)] || 0)}
                                            </td>
                                        ))}
                                        <td className="text-right"><strong>{formatNumber(emp.total_income)}</strong></td>
                                        <td className="text-right" style={{ color: '#9ca3af' }}>-</td>
                                        <td className="text-right" style={{ color: '#9ca3af' }}>-</td>
                                        <td className="text-right" style={{ color: '#9ca3af' }}>-</td>
                                        <td className="text-right">{formatNumber(emp.bpjs_kesehatan_4pct)}</td>
                                        <td className="text-right">{formatNumber(emp.astek_jht)}</td>
                                        <td className="text-right"><strong>{formatNumber(emp.total_penghasilan_setahun)}</strong></td>
                                        <td className="text-right">{formatNumber(emp.pph21_kena_pajak)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5} className="text-right"><strong>TOTAL</strong></td>
                                    {Array.from({ length: 12 }, (_, m) => (
                                        <td key={m} className="text-right">
                                            {formatNumber(data.employees.reduce((s, e) => s + (e.monthly_income?.[String(m + 1)] || 0), 0))}
                                        </td>
                                    ))}
                                    <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.total_income, 0))}</strong></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.bpjs_kesehatan_4pct, 0))}</td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.astek_jht, 0))}</td>
                                    <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.total_penghasilan_setahun, 0))}</strong></td>
                                    <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.pph21_kena_pajak, 0))}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Section 2: Potongan & Perhitungan Pajak */}
                    <h3 className="tax-report-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart2 size={20} /> Potongan & Perhitungan Pajak — {selectedYear}
                    </h3>
                    <div className="tax-report-table-wrapper">
                        <table className="tax-report-table">
                            <thead>
                                <tr>
                                    <th className="col-no">No</th>
                                    <th className="col-name">Name</th>
                                    <th>L/P</th>
                                    <th>Stat</th>
                                    <th>GAB</th>
                                    <th colSpan={4} style={{ textAlign: 'center' }}>PENGHASILAN SETAHUN</th>
                                    <th>Total<br />Penghasilan<br />Setahun</th>
                                    <th colSpan={4} style={{ textAlign: 'center' }}>POTONGAN</th>
                                    <th>Penghasilan<br />Netto Setahun<br />(disetahunkan)</th>
                                    <th>PTKP</th>
                                    <th>Penghasilan<br />Kena Pajak</th>
                                </tr>
                                <tr>
                                    <th className="sub-header" colSpan={5}></th>
                                    <th className="sub-header">BPJS<br />KESEHATAN (4%)</th>
                                    <th className="sub-header">Astek/Jns<br />HT (JHT)</th>
                                    <th className="sub-header">T H R</th>
                                    <th className="sub-header">PENGHASILAN<br />LAIN-LAIN</th>
                                    <th className="sub-header"></th>
                                    <th className="sub-header">Biaya<br />Jabatan 5%</th>
                                    <th className="sub-header">Astek Ins &<br />Bi jabatan</th>
                                    <th className="sub-header">PENSIUN</th>
                                    <th className="sub-header">Total</th>
                                    <th className="sub-header"></th>
                                    <th className="sub-header"></th>
                                    <th className="sub-header"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.employees.map((emp, idx) => (
                                    <tr key={emp.emp_code}>
                                        <td className="text-center col-no">{idx + 1}</td>
                                        <td className="col-name">{emp.emp_name}</td>
                                        <td className="text-center">{emp.gender === 'L' || emp.gender === 'M' ? 'L' : 'P'}</td>
                                        <td className="text-center">{emp.status_ptkp}</td>
                                        <td className="text-right">{formatNumber(emp.total_income)}</td>
                                        <td className="text-right">{formatNumber(emp.bpjs_kesehatan_4pct)}</td>
                                        <td className="text-right">{formatNumber(emp.astek_jht)}</td>
                                        <td className="text-right" style={{ color: '#9ca3af' }}>-</td>
                                        <td className="text-right" style={{ color: '#9ca3af' }}>-</td>
                                        <td className="text-right"><strong>{formatNumber(emp.total_penghasilan_setahun)}</strong></td>
                                        <td className="text-right">{formatNumber(emp.biaya_jabatan)}</td>
                                        <td className="text-right">{formatNumber(emp.astek_pensiun_pekerja_setahun)}</td>
                                        <td className="text-right">{formatNumber(emp.bpjs_pensiun_pekerja_setahun)}</td>
                                        <td className="text-right">{formatNumber(emp.total_potongan_tahunan)}</td>
                                        <td className="text-right">{formatNumber(emp.penghasilan_netto_setahun)}</td>
                                        <td className="text-right">{formatNumber(emp.ptkp)}</td>
                                        <td className="text-right">
                                            <span className={emp.penghasilan_kena_pajak > 0 ? 'positive' : ''}>
                                                {formatNumber(emp.penghasilan_kena_pajak)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} className="text-right"><strong>TOTAL</strong></td>
                                    <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.total_income, 0))}</strong></td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.bpjs_kesehatan_4pct, 0))}</td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.astek_jht, 0))}</td>
                                    <td></td>
                                    <td></td>
                                    <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.total_penghasilan_setahun, 0))}</strong></td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.biaya_jabatan, 0))}</td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.astek_pensiun_pekerja_setahun, 0))}</td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.bpjs_pensiun_pekerja_setahun, 0))}</td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.total_potongan_tahunan, 0))}</td>
                                    <td className="text-right">{formatNumber(data.employees.reduce((s, e) => s + e.penghasilan_netto_setahun, 0))}</td>
                                    <td></td>
                                    <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + e.penghasilan_kena_pajak, 0))}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

// ================================================================
// TAB 3: ASTEK & BPJS Setahun
// ================================================================
function AstekBpjsTab({ token, year: contextYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(contextYear);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchAnnualAstekBpjsReport(token, selectedYear, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, selectedYear, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = contextYear; y >= contextYear - 3; y--) years.push(y);
        return years;
    }, [contextYear]);

    if (loading) return (
        <div className="tax-report-loading">
            <span className="spinner"></span> Memuat data ASTEK & BPJS...
        </div>
    );

    if (error) return (
        <div className="tax-report-empty">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <div>
            <div className="tax-report-period-bar">
                <label>📅 Tahun:</label>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                {data && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Data tersedia: {data.available_months.map(m => MONTH_NAMES[m - 1]).join(', ') || 'Belum ada'}
                    </span>
                )}
            </div>

            {!data || data.employees.length === 0 ? (
                <div className="tax-report-empty">
                    <h3><FileWarning size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Tidak Ada Data</h3>
                    <p>Data ASTEK & BPJS untuk tahun {selectedYear} belum tersedia.</p>
                </div>
            ) : (
                <div className="tax-report-table-wrapper">
                    <table className="tax-report-table">
                        <thead>
                            <tr>
                                <th className="col-no" rowSpan={2}>No</th>
                                <th className="col-name" rowSpan={2}>Name</th>
                                <th colSpan={12} style={{ textAlign: 'center' }}>PENGHASILAN SETAHUN</th>
                                <th rowSpan={2}>TOTAL<br />Jan s/d Des</th>
                            </tr>
                            <tr>
                                {MONTH_NAMES.map((name, idx) => (
                                    <th className="sub-header" key={idx}>{name.substring(0, 3)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp, idx) => {
                                // Calculate total ASTEK+BPJS per month
                                const monthlyTotals = {};
                                let grandTotal = 0;
                                for (let m = 1; m <= 12; m++) {
                                    const md = emp.monthly_data?.[String(m)];
                                    const total = md
                                        ? md.astek_pekerja + md.astek_majikan + md.bpjs_kes_pekerja + md.bpjs_kes_majikan + md.bpjs_pensiun_pekerja + md.bpjs_pensiun_majikan
                                        : 0;
                                    monthlyTotals[m] = total;
                                    grandTotal += total;
                                }

                                return (
                                    <tr key={emp.emp_code}>
                                        <td className="text-center col-no">{idx + 1}</td>
                                        <td className="col-name">{emp.emp_name}</td>
                                        {Array.from({ length: 12 }, (_, m) => (
                                            <td key={m} className="text-right">
                                                {formatNumber(monthlyTotals[m + 1])}
                                            </td>
                                        ))}
                                        <td className="text-right"><strong>{formatNumber(grandTotal)}</strong></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={2} className="text-right"><strong>TOTAL</strong></td>
                                {Array.from({ length: 12 }, (_, m) => {
                                    const monthTotal = data.employees.reduce((s, emp) => {
                                        const md = emp.monthly_data?.[String(m + 1)];
                                        return s + (md ? md.astek_pekerja + md.astek_majikan + md.bpjs_kes_pekerja + md.bpjs_kes_majikan + md.bpjs_pensiun_pekerja + md.bpjs_pensiun_majikan : 0);
                                    }, 0);
                                    return <td key={m} className="text-right">{formatNumber(monthTotal)}</td>;
                                })}
                                <td className="text-right">
                                    <strong>{formatNumber(data.employees.reduce((s, emp) => {
                                        return s + emp.total.astek_pekerja + emp.total.astek_majikan + emp.total.bpjs_kes_pekerja + emp.total.bpjs_kes_majikan + emp.total.bpjs_pensiun_pekerja + emp.total.bpjs_pensiun_majikan;
                                    }, 0))}</strong>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ================================================================
// TAB 4: List PPh21 Bulanan (Grid)
// ================================================================
function MonthlyPph21GridTab({ token, year: contextYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(contextYear);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Re-using the annual report which now includes monthly_pph21
            const result = await fetchAnnualTaxReport(token, selectedYear, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, selectedYear, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = contextYear; y >= contextYear - 3; y--) years.push(y);
        return years;
    }, [contextYear]);

    if (loading) return (
        <div className="tax-report-loading">
            <span className="spinner"></span> Memuat data histori PPH21...
        </div>
    );

    if (error) return (
        <div className="tax-report-empty">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <div>
            <div className="tax-report-period-bar">
                <label>📅 Tahun:</label>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                    {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                {data && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Data tersedia: {data.available_months.map(m => MONTH_NAMES[m - 1]).join(', ') || 'Belum ada'}
                    </span>
                )}
            </div>

            {!data || data.employees.length === 0 ? (
                <div className="tax-report-empty">
                    <h3><FileWarning size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Tidak Ada Data</h3>
                    <p>Historis potongan PPh21 untuk tahun {selectedYear} belum tersedia.</p>
                </div>
            ) : (
                <div className="tax-report-table-wrapper">
                    <table className="tax-report-table">
                        <thead>
                            <tr>
                                <th className="col-no" rowSpan={2}>No</th>
                                <th className="col-name" rowSpan={2}>Nama</th>
                                <th rowSpan={2}>NO.NPWP</th>
                                <th colSpan={12} style={{ textAlign: 'center' }}>PPH 21 TAHUN {selectedYear}</th>
                            </tr>
                            <tr>
                                {MONTH_NAMES.map((name, idx) => (
                                    <th className="sub-header" key={idx}>{name.toUpperCase()}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp, idx) => (
                                <tr key={emp.emp_code}>
                                    <td className="text-center col-no">{idx + 1}</td>
                                    <td className="col-name">{emp.emp_name}</td>
                                    <td className="text-center">-</td> {/* Placeholder for NPWP */}
                                    {Array.from({ length: 12 }, (_, m) => (
                                        <td key={m} className="text-right">
                                            {formatNumber(emp.monthly_pph21?.[String(m + 1)] || 0)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="text-right"><strong>TOTAL PPH21</strong></td>
                                {Array.from({ length: 12 }, (_, m) => (
                                    <td key={m} className="text-right">
                                        <strong>
                                            {formatNumber(data.employees.reduce((s, e) => s + (e.monthly_pph21?.[String(m + 1)] || 0), 0))}
                                        </strong>
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ================================================================
// MAIN: TaxReportPage
// ================================================================
export default function TaxReportPage() {
    const { token } = useAuth();
    const { month, year, division, gang } = useReport();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('monthly');

    const tabs = [
        { key: 'monthly', label: 'Kalkulasi PPH21', icon: <Calculator size={18} /> },
        { key: 'annual', label: 'Pajak Tahunan', icon: <BarChart2 size={18} /> },
        { key: 'pph21_grid', label: 'Historis PPH21 Setahun', icon: <CalendarDays size={18} /> },
        { key: 'astek', label: 'ASTEK & BPJS', icon: <Activity size={18} /> },
    ];

    return (
        <div className="tax-report-container">
            {/* Toolbar */}
            <div className="tax-report-toolbar">
                <div className="tax-report-toolbar-left">
                    <button
                        className="tax-report-back-btn"
                        onClick={() => navigate('/')}
                        title="Dashboard"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="tax-report-title">Report Pajak</span>
                    <div className="tax-report-divider"></div>
                    <div className="tax-report-badge">
                        {division} • {gang || 'ALL'} • {month}-{year}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tax-report-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`tax-report-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {tab.icon} <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="tax-report-content">
                {activeTab === 'monthly' && (
                    <MonthlyTaxTab
                        token={token}
                        year={year}
                        month={month}
                        division={division}
                        gang={gang}
                    />
                )}
                {activeTab === 'annual' && (
                    <AnnualTaxTab
                        token={token}
                        year={year}
                        division={division}
                        gang={gang}
                    />
                )}
                {activeTab === 'pph21_grid' && (
                    <MonthlyPph21GridTab
                        token={token}
                        year={year}
                        division={division}
                        gang={gang}
                    />
                )}
                {activeTab === 'astek' && (
                    <AstekBpjsTab
                        token={token}
                        year={year}
                        division={division}
                        gang={gang}
                    />
                )}
            </div>
        </div>
    );
}
