import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { fetchMonthlyTaxReport, fetchAnnualTaxReport, fetchAnnualAstekBpjsReport, downloadMonthlyTaxReportExcel } from '../services/taxReportService';
import { fetchDivisions, fetchGangs } from '../services/gangService';
import { Calculator, BarChart2, CalendarDays, Activity, FileWarning, Search, ChevronDown, ChevronRight, DollarSign, Download, Filter } from 'lucide-react';
import '../styles/TaxReportPage.css';

// LocalStorage keys for tax report persistence
// Note: Month/Year are now shared globally via ReportContext (report_period_month, report_period_year)
const STORAGE_KEYS = {
    DIVISION: 'tax_report_division',
    GANG: 'tax_report_gang',
    ACTIVE_TAB: 'tax_report_active_tab'
};

// Load from localStorage
const loadFromStorage = (key, defaultValue) => {
    try {
        const stored = localStorage.getItem(key);
        return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
};

// Save to localStorage
const saveToStorage = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
};

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
function MonthlyTaxTab({ token, month, year, setMonth, setYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloadingExcel, setDownloadingExcel] = useState(false);
    const [error, setError] = useState(null);
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
            const result = await fetchMonthlyTaxReport(token, year, month, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, year, month, division, gang]);

    const handleDownloadExcel = async () => {
        setDownloadingExcel(true);
        try {
            await downloadMonthlyTaxReportExcel(token, year, month, division, gang);
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
        for (let y = year; y >= year - 3; y--) years.push(y);
        return years;
    }, [year]);

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
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                        {MONTH_NAMES.map((name, idx) => (
                            <option key={idx} value={idx + 1}>{name}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}>
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
                    <p>Data pajak untuk {MONTH_NAMES[month - 1]} {year} belum tersedia. Pastikan data sudah di-seed melalui Aggregation Seeder.</p>
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
function AnnualTaxTab({ token, month, year, setMonth, setYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [subTab, setSubTab] = useState('penghasilan'); // 'penghasilan' | 'kalkulasi'
    const [penghasilanMode, setPenghasilanMode] = useState('gaji'); // 'gaji' | 'masa_kerja'

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchAnnualTaxReport(token, year, month, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, year, month, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = year; y >= year - 3; y--) years.push(y);
        return years;
    }, [year]);

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
                <label>📅 Periode:</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}>
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
                    <p>Data pajak untuk tahun {year} belum tersedia.</p>
                </div>
            ) : (
                <>
                    {/* Laporan Pajak Tahunan - Single Table Structure */}
                    <h3 className="tax-report-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DollarSign size={20} /> Laporan Pajak Tahunan — {year}
                    </h3>
                    {/* Sub-tab Navigation */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                        <button
                            onClick={() => setSubTab('penghasilan')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                background: 'none',
                                borderBottom: subTab === 'penghasilan' ? '2px solid #3b82f6' : '2px solid transparent',
                                color: subTab === 'penghasilan' ? '#3b82f6' : '#64748b',
                                fontWeight: subTab === 'penghasilan' ? '600' : '400',
                                cursor: 'pointer'
                            }}
                        >
                            Penghasilan Setahun
                        </button>
                        <button
                            onClick={() => setSubTab('kalkulasi')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                background: 'none',
                                borderBottom: subTab === 'kalkulasi' ? '2px solid #3b82f6' : '2px solid transparent',
                                color: subTab === 'kalkulasi' ? '#3b82f6' : '#64748b',
                                fontWeight: subTab === 'kalkulasi' ? '600' : '400',
                                cursor: 'pointer'
                            }}
                        >
                            Kalkulasi Pajak Setahun
                        </button>
                    </div>

                    <div className="tax-report-table-wrapper" style={{ marginBottom: '2rem' }}>
                        {subTab === 'penghasilan' && (
                            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                                <label style={{ marginRight: '1rem', fontWeight: 'bold', color: '#334155' }}>Tampilkan Uraian Bulanan:</label>
                                <select
                                    value={penghasilanMode}
                                    onChange={(e) => setPenghasilanMode(e.target.value)}
                                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#fff' }}
                                >
                                    <optgroup label="PENGHASILAN">
                                        <option value="gaji">Gaji Kotor</option>
                                        <option value="masa_kerja">Masa Kerja (Info)</option>
                                    </optgroup>
                                    <optgroup label="BPJS & ASTEK">
                                        <option value="bpjs_kesehatan">BPJS Kesehatan 4% (Majikan)</option>
                                        <option value="astek_ins_084">Astek Ins 0.84% (Majikan)</option>
                                        <option value="astek_ins_2">Astek Ins 2% (Pekerja)</option>
                                        <option value="pensiun_1">Pensiun 1% (Pekerja)</option>
                                    </optgroup>
                                </select>
                                <span style={{ marginLeft: '1rem', fontStyle: 'italic', color: '#64748b', fontSize: '0.9em' }}>
                                    *Pilih uraian untuk melihat rincian bulanannya secara spesifik.
                                </span>
                            </div>
                        )}
                        <table className="tax-report-table">
                            <thead>
                                {subTab === 'penghasilan' ? (
                                    <>
                                        <tr>
                                            <th className="col-no" rowSpan={2}>No</th>
                                            <th className="col-name" rowSpan={2}>Name</th>
                                            <th rowSpan={2}>L/P</th>
                                            <th rowSpan={2}>Stat</th>
                                            <th rowSpan={2}>BL</th>
                                            <th colSpan={12} style={{ textAlign: 'center' }}>
                                                URAIAN BULANAN ({
                                                    penghasilanMode === 'gaji' ? 'GAJI KOTOR' :
                                                        penghasilanMode === 'masa_kerja' ? 'MASA KERJA' :
                                                            penghasilanMode === 'bpjs_kesehatan' ? 'BPJS KES 4%' :
                                                                penghasilanMode === 'astek_ins_084' ? 'ASTEK INS 0.84%' :
                                                                    penghasilanMode === 'astek_ins_2' ? 'ASTEK INS 2%' : 'PENSIUN 1%'
                                                })
                                            </th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>
                                                {penghasilanMode === 'gaji' ? 'TOTAL\nGaji Setahun' :
                                                    penghasilanMode === 'masa_kerja' ? 'TOTAL\nMasa Kerja' :
                                                        penghasilanMode === 'bpjs_kesehatan' ? 'TOTAL\nBPJS Kes 4%' :
                                                            penghasilanMode === 'astek_ins_084' ? 'TOTAL\nAstek 0.84%' :
                                                                penghasilanMode === 'astek_ins_2' ? 'TOTAL\nAstek 2%' : 'TOTAL\nPensiun 1%'}
                                            </th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>T H R</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>BONUS /<br />Ex-Gratia</th>
                                            <th rowSpan={2} style={{ textAlign: 'center', backgroundColor: '#f8fafc', color: '#64748b', fontStyle: 'italic', fontWeight: 'normal', fontSize: '0.9em' }}>Total<br />Masa Kerja<br />(Info)</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>Total<br />Penghasilan<br />Setahun</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>PTKP</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>Penghasilan<br />Kena<br />Pajak</th>
                                        </tr>
                                        <tr>
                                            {MONTH_NAMES.map((name, idx) => (
                                                <th className="sub-header" key={idx} style={{ textAlign: 'center' }}>{name.substring(0, 3)}</th>
                                            ))}
                                        </tr>
                                    </>
                                ) : (
                                    <>
                                        <tr>
                                            <th className="col-no" rowSpan={2}>No</th>
                                            <th className="col-name" rowSpan={2}>Name</th>
                                            <th colSpan={6} style={{ textAlign: 'center' }}>PENGHASILAN SETAHUN</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>Total<br />Penghasilan<br />Bruto</th>
                                            <th colSpan={4} style={{ textAlign: 'center' }}>POTONGAN</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>Penghasilan<br />Neto Setahun/<br />disetahunkan</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>PTKP</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>Penghasilan<br />Kena<br />Pajak</th>
                                            <th rowSpan={2} style={{ textAlign: 'center' }}>PPh21</th>
                                        </tr>
                                        <tr>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>Total Gaji<br />Kotor</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>T H R</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>BONUS /<br />Ex-Gratia</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>BPJS<br />Kesehatan (4%)</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>Astek Ins<br />0,84%</th>
                                            <th className="sub-header" style={{ textAlign: 'center', backgroundColor: '#f8fafc', color: '#64748b', fontStyle: 'italic', fontWeight: 'normal', fontSize: '0.9em' }}>Total<br />Masa Kerja<br />(Info)</th>

                                            <th className="sub-header" style={{ textAlign: 'center' }}>Astek Ins<br />2% from Inc</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>Bi.Jabatan<br />5%per year</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>PENSIUN<br />1%</th>
                                            <th className="sub-header" style={{ textAlign: 'center' }}>Total<br />Potongan</th>
                                        </tr>
                                    </>
                                )}
                            </thead>
                            <tbody>
                                {data.employees.map((emp, idx) => (
                                    <tr key={emp.emp_code}>
                                        <td className="text-center col-no">{idx + 1}</td>
                                        <td className="col-name">{emp.emp_name}</td>

                                        {subTab === 'penghasilan' ? (
                                            <>
                                                <td className="text-center">{emp.gender === 'L' || emp.gender === 'M' ? 'L' : 'P'}</td>
                                                <td className="text-center">{emp.status_ptkp}</td>
                                                <td className="text-center">{emp.kategori_ter}</td>

                                                {Array.from({ length: 12 }, (_, m) => {
                                                    const val = penghasilanMode === 'gaji'
                                                        ? (emp.monthly_gaji_kotor?.[m + 1] || 0)
                                                        : penghasilanMode === 'masa_kerja'
                                                            ? (emp.monthly_masa_kerja?.[m + 1] || 0)
                                                            : penghasilanMode === 'bpjs_kesehatan'
                                                                ? (emp.monthly_bpjs_kesehatan?.[m + 1] || 0)
                                                                : penghasilanMode === 'astek_ins_084'
                                                                    ? (emp.monthly_astek_ins_084?.[m + 1] || 0)
                                                                    : penghasilanMode === 'astek_ins_2'
                                                                        ? (emp.monthly_astek_ins_2?.[m + 1] || 0)
                                                                        : (emp.monthly_pensiun_1?.[m + 1] || 0);
                                                    return <td key={m} className="text-right">{formatNumber(val) || '-'}</td>;
                                                })}

                                                <td className="text-right"><strong>{formatNumber(
                                                    penghasilanMode === 'gaji' ? emp.gaji_jan_nov :
                                                        penghasilanMode === 'masa_kerja' ? emp.masa_kerja_jan_nov :
                                                            penghasilanMode === 'bpjs_kesehatan' ? emp.bpjs_kesehatan_4pct :
                                                                penghasilanMode === 'astek_ins_084' ? emp.astek_084pct :
                                                                    penghasilanMode === 'astek_ins_2' ? emp.astek_ins_2pct : emp.pensiun_1pct
                                                )}</strong></td>
                                                <td className="text-right">{formatNumber(emp.thr)}</td>
                                                <td className="text-right">{formatNumber(emp.bonus)}</td>
                                                <td className="text-right" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>{formatNumber(emp.masa_kerja_jan_nov)}</td>

                                                <td className="text-right"><strong>{formatNumber((emp.gaji_jan_nov || 0) + (emp.thr || 0) + (emp.bonus || 0))}</strong></td>

                                                <td className="text-right">{formatNumber(emp.ptkp)}</td>
                                                <td className="text-right">{formatNumber(emp.penghasilan_kena_pajak)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="text-right"><strong>{formatNumber(emp.gaji_jan_nov)}</strong></td>
                                                <td className="text-right">{formatNumber(emp.thr)}</td>
                                                <td className="text-right">{formatNumber(emp.bonus)}</td>
                                                <td className="text-right">{formatNumber(emp.bpjs_kesehatan_4pct)}</td>
                                                <td className="text-right">{formatNumber(emp.astek_084pct)}</td>
                                                <td className="text-right" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>{formatNumber(emp.masa_kerja_jan_nov)}</td>
                                                <td className="text-right"><strong>{formatNumber((emp.gaji_jan_nov || 0) + (emp.thr || 0) + (emp.bonus || 0) + (emp.bpjs_kesehatan_4pct || 0) + (emp.astek_084pct || 0))}</strong></td>

                                                <td className="text-right">{formatNumber(emp.astek_ins_2pct)}</td>
                                                <td className="text-right">{formatNumber(emp.biaya_jabatan)}</td>
                                                <td className="text-right">{formatNumber(emp.pensiun_1pct)}</td>
                                                <td className="text-right">{formatNumber(emp.total_potongan_tahunan)}</td>

                                                <td className="text-right">{formatNumber(emp.penghasilan_netto_setahun)}</td>
                                                <td className="text-right">{formatNumber(emp.ptkp)}</td>
                                                <td className="text-right">{formatNumber(emp.penghasilan_kena_pajak)}</td>
                                                <td className="text-right"><strong>{formatNumber(emp.pph21_kena_pajak)}</strong></td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                {subTab === 'penghasilan' ? (
                                    <tr>
                                        <td colSpan={5} className="text-right"><strong>TOTAL</strong></td>
                                        {Array.from({ length: 12 }, (_, m) => {
                                            const monthTotal = data.employees.reduce((s, e) => {
                                                const val = penghasilanMode === 'gaji'
                                                    ? (e.monthly_gaji_kotor?.[m + 1] || 0)
                                                    : penghasilanMode === 'masa_kerja'
                                                        ? (e.monthly_masa_kerja?.[m + 1] || 0)
                                                        : penghasilanMode === 'bpjs_kesehatan'
                                                            ? (e.monthly_bpjs_kesehatan?.[m + 1] || 0)
                                                            : penghasilanMode === 'astek_ins_084'
                                                                ? (e.monthly_astek_ins_084?.[m + 1] || 0)
                                                                : penghasilanMode === 'astek_ins_2'
                                                                    ? (e.monthly_astek_ins_2?.[m + 1] || 0)
                                                                    : (e.monthly_pensiun_1?.[m + 1] || 0);
                                                return s + val;
                                            }, 0);
                                            return <td key={m} className="text-right"><strong>{formatNumber(monthTotal) || '-'}</strong></td>;
                                        })}
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (
                                            penghasilanMode === 'gaji' ? (e.gaji_jan_nov || 0) :
                                                penghasilanMode === 'masa_kerja' ? (e.masa_kerja_jan_nov || 0) :
                                                    penghasilanMode === 'bpjs_kesehatan' ? (e.bpjs_kesehatan_4pct || 0) :
                                                        penghasilanMode === 'astek_ins_084' ? (e.astek_084pct || 0) :
                                                            penghasilanMode === 'astek_ins_2' ? (e.astek_ins_2pct || 0) : (e.pensiun_1pct || 0)
                                        ), 0))}</strong></td>

                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.thr || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.bonus || 0), 0))}</strong></td>
                                        <td className="text-right" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.masa_kerja_jan_nov || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + ((e.gaji_jan_nov || 0) + (e.thr || 0) + (e.bonus || 0)), 0))}</strong></td>

                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.ptkp || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.penghasilan_kena_pajak || 0), 0))}</strong></td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="text-right"><strong>TOTAL</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.gaji_jan_nov || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.thr || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.bonus || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.bpjs_kesehatan_4pct || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.astek_084pct || 0), 0))}</strong></td>
                                        <td className="text-right" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.masa_kerja_jan_nov || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + ((e.gaji_jan_nov || 0) + (e.thr || 0) + (e.bonus || 0) + (e.bpjs_kesehatan_4pct || 0) + (e.astek_084pct || 0)), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.astek_ins_2pct || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.biaya_jabatan || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.pensiun_1pct || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.total_potongan_tahunan || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.penghasilan_netto_setahun || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.ptkp || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.penghasilan_kena_pajak || 0), 0))}</strong></td>
                                        <td className="text-right"><strong>{formatNumber(data.employees.reduce((s, e) => s + (e.pph21_kena_pajak || 0), 0))}</strong></td>
                                    </tr>
                                )}
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
function AstekBpjsTab({ token, month, year, setMonth, setYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [astekMode, setAstekMode] = useState('total');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchAnnualAstekBpjsReport(token, year, month, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, year, month, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = year; y >= year - 3; y--) years.push(y);
        return years;
    }, [year]);

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
                <label>📅 Periode:</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}>
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

            {data && data.employees.length > 0 && (
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                    <label style={{ marginRight: '1rem', fontWeight: 'bold', color: '#334155' }}>Tampilkan Uraian Bulanan:</label>
                    <select
                        value={astekMode}
                        onChange={(e) => setAstekMode(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: '#fff' }}
                    >
                        <option value="total">Total Seluruh BPJS & Astek (Info)</option>
                        <optgroup label="BPJS Kesehatan">
                            <option value="bpjs_kes_majikan">BPJS Kes 4% (Majikan)</option>
                            <option value="bpjs_kes_pekerja">BPJS Kes 1% (Pekerja)</option>
                        </optgroup>
                        <optgroup label="Astek / Jamsostek">
                            <option value="astek_majikan">Astek 0.84% (Majikan)</option>
                            <option value="astek_pekerja">Astek 2% (Pekerja)</option>
                        </optgroup>
                        <optgroup label="BPJS Pensiun">
                            <option value="bpjs_pensiun_majikan">Pensiun 2% (Majikan)</option>
                            <option value="bpjs_pensiun_pekerja">Pensiun 1% (Pekerja)</option>
                        </optgroup>
                    </select>
                    <span style={{ marginLeft: '1rem', fontStyle: 'italic', color: '#64748b', fontSize: '0.9em' }}>
                        *Pilih uraian untuk melihat rincian bulanannya secara spesifik.
                    </span>
                </div>
            )}

            {!data || data.employees.length === 0 ? (
                <div className="tax-report-empty">
                    <h3><FileWarning size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Tidak Ada Data</h3>
                    <p>Data ASTEK & BPJS untuk tahun {year} belum tersedia.</p>
                </div>
            ) : (
                <div className="tax-report-table-wrapper">
                    <table className="tax-report-table">
                        <thead>
                            <tr>
                                <th className="col-no" rowSpan={2}>No</th>
                                <th className="col-name" rowSpan={2}>Name</th>
                                <th colSpan={12} style={{ textAlign: 'center' }}>
                                    URAIAN BULANAN ({
                                        astekMode === 'total' ? 'TOTAL BPJS & ASTEK' :
                                            astekMode === 'bpjs_kes_majikan' ? 'BPJS Kes 4%' :
                                                astekMode === 'bpjs_kes_pekerja' ? 'BPJS Kes 1%' :
                                                    astekMode === 'astek_majikan' ? 'Astek 0.84%' :
                                                        astekMode === 'astek_pekerja' ? 'Astek 2%' :
                                                            astekMode === 'bpjs_pensiun_majikan' ? 'Pensiun 2%' : 'Pensiun 1%'
                                    })
                                </th>
                                <th rowSpan={2}>TOTAL<br />Jan s/d Des</th>
                                <th rowSpan={2}>TOTAL<br />Masa Kerja</th>
                            </tr>
                            <tr>
                                {MONTH_NAMES.map((name, idx) => (
                                    <th className="sub-header" key={idx}>{name.substring(0, 3)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp, idx) => {
                                // Calculate ASTEK+BPJS per month based on mode
                                const monthlyTotals = {};
                                let grandTotal = 0;
                                for (let m = 1; m <= 12; m++) {
                                    const md = emp.monthly_data?.[String(m)];
                                    let total = 0;
                                    if (md) {
                                        if (astekMode === 'total') {
                                            total = md.astek_pekerja + md.astek_majikan + md.bpjs_kes_pekerja + md.bpjs_kes_majikan + md.bpjs_pensiun_pekerja + md.bpjs_pensiun_majikan;
                                        } else {
                                            total = md[astekMode] || 0;
                                        }
                                    }
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
                                        <td className="text-right"><strong>{formatNumber(emp.total?.masa_kerja || 0)}</strong></td>
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
                                        if (!md) return s;
                                        if (astekMode === 'total') {
                                            return s + md.astek_pekerja + md.astek_majikan + md.bpjs_kes_pekerja + md.bpjs_kes_majikan + md.bpjs_pensiun_pekerja + md.bpjs_pensiun_majikan;
                                        }
                                        return s + (md[astekMode] || 0);
                                    }, 0);
                                    return <td key={m} className="text-right">{formatNumber(monthTotal)}</td>;
                                })}
                                <td className="text-right">
                                    <strong>{formatNumber(data.employees.reduce((s, emp) => {
                                        if (astekMode === 'total') {
                                            return s + (emp.total?.astek_pekerja || 0) + (emp.total?.astek_majikan || 0) + (emp.total?.bpjs_kes_pekerja || 0) + (emp.total?.bpjs_kes_majikan || 0) + (emp.total?.bpjs_pensiun_pekerja || 0) + (emp.total?.bpjs_pensiun_majikan || 0);
                                        }
                                        return s + (emp.total?.[astekMode] || 0);
                                    }, 0))}</strong>
                                </td>
                                <td className="text-right">
                                    <strong>{formatNumber(data.employees.reduce((s, emp) => s + (emp.total?.masa_kerja || 0), 0))}</strong>
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
function MonthlyPph21GridTab({ token, month, year, setMonth, setYear, division, gang }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Re-using the annual report which now includes monthly_pph21
            const result = await fetchAnnualTaxReport(token, year, month, division, gang);
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token, year, month, division, gang]);

    useEffect(() => { loadData(); }, [loadData]);

    const yearOptions = useMemo(() => {
        const years = [];
        for (let y = year; y >= year - 3; y--) years.push(y);
        return years;
    }, [year]);

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
                <label>📅 Periode:</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx + 1}>{name}</option>
                    ))}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}>
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
                    <p>Historis potongan PPh21 untuk tahun {year} belum tersedia.</p>
                </div>
            ) : (
                <div className="tax-report-table-wrapper">
                    <table className="tax-report-table">
                        <thead>
                            <tr>
                                <th className="col-no" rowSpan={2}>No</th>
                                <th className="col-name" rowSpan={2}>Nama</th>
                                <th rowSpan={2}>NO.NPWP</th>
                                <th colSpan={12} style={{ textAlign: 'center' }}>PPH 21 TAHUN {year}</th>
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
    const { token, user } = useAuth();
    const { month, setMonth, year, setYear, allDivisions } = useReport();
    const navigate = useNavigate();

    // Local state with localStorage persistence
    const [activeTab, setActiveTab] = useState(() => loadFromStorage(STORAGE_KEYS.ACTIVE_TAB, 'monthly'));
    // Note: month and year are now shared via ReportContext
    const [selectedDivision, setSelectedDivision] = useState(() => loadFromStorage(STORAGE_KEYS.DIVISION, ''));
    const [selectedGang, setSelectedGang] = useState(() => loadFromStorage(STORAGE_KEYS.GANG, ''));

    // Gangs list for selected division
    const [gangs, setGangs] = useState([]);
    const [gangsLoading, setGangsLoading] = useState(false);

    // Save to localStorage when values change
    useEffect(() => {
        saveToStorage(STORAGE_KEYS.ACTIVE_TAB, activeTab);
    }, [activeTab]);

    // Note: month and year are now automatically persisted by useCurrentPeriod hook

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.DIVISION, selectedDivision);
    }, [selectedDivision]);

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.GANG, selectedGang);
    }, [selectedGang]);

    // Initialize division from context if not set in localStorage
    useEffect(() => {
        if (!selectedDivision && allDivisions.length > 0) {
            // Use first division from context
            setSelectedDivision(allDivisions[0]);
        }
    }, [allDivisions, selectedDivision]);

    // Load gangs when division changes
    useEffect(() => {
        async function loadGangs() {
            if (!selectedDivision || !token) {
                setGangs([]);
                return;
            }

            setGangsLoading(true);
            try {
                const list = await fetchGangs(token, selectedDivision, null, true);
                setGangs(list || []);

                // Reset gang if current selection is not in new list
                if (selectedGang && !list.some(g => g.gang_code === selectedGang)) {
                    setSelectedGang('');
                }
            } catch (e) {
                console.error('Failed to load gangs:', e);
                setGangs([]);
            } finally {
                setGangsLoading(false);
            }
        }
        loadGangs();
    }, [selectedDivision, token]);

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

                    {/* Filter Controls */}
                    <div className="tax-report-filters">
                        {/* Division Selector */}
                        <select
                            value={selectedDivision}
                            onChange={(e) => {
                                setSelectedDivision(e.target.value);
                                setSelectedGang(''); // Reset gang when division changes
                            }}
                            className="tax-report-select"
                        >
                            <option value="">Pilih Divisi...</option>
                            {allDivisions.map((div) => (
                                <option key={div} value={div}>{div}</option>
                            ))}
                        </select>

                        {/* Gang Selector */}
                        <select
                            value={selectedGang}
                            onChange={(e) => setSelectedGang(e.target.value)}
                            className="tax-report-select"
                            disabled={!selectedDivision || gangsLoading}
                        >
                            <option value="">SEMUA GANG</option>
                            {gangs.map((gang) => (
                                <option key={gang.gang_code} value={gang.gang_code}>
                                    {gang.gang_code} - {gang.gang_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Period Display */}
                <div className="tax-report-badge">
                    {selectedDivision || '-'} • {selectedGang || 'ALL'} • {month}-{year}
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
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}
                {activeTab === 'annual' && (
                    <AnnualTaxTab
                        token={token}
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}
                {activeTab === 'pph21_grid' && (
                    <MonthlyPph21GridTab
                        token={token}
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}
                {activeTab === 'astek' && (
                    <AstekBpjsTab
                        token={token}
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        division={selectedDivision}
                        gang={selectedGang}
                    />
                )}
            </div>
        </div>
    );
}
