import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getEmployeeCheckroll, getEmployeeHistoricalData } from '../../services/employeeDetailService'
import LoadingScreen from '../common/LoadingScreen'
import './EmployeeDetailPage.css'

export default function HrInfoPage({
    employeeData,
    month,
    year,
    division,
    onBack
}) {
    const { token } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [checkrollData, setCheckrollData] = useState(null)

    // Historical data (from seeded extend_db_ptrj ONLY)
    const [careerHistory, setCareerHistory] = useState([])
    const [payrollHistory, setPayrollHistory] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)

    // UI state
    const [activeTab, setActiveTab] = useState('profil')

    const empCode = employeeData?.nik || employeeData?.NIK || ''

    useEffect(() => {
        async function loadData() {
            if (!token || !empCode) {
                setError('Token atau NIK tidak tersedia')
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')

            try {
                const data = await getEmployeeCheckroll(token, empCode, month, year, division);
                setCheckrollData(data)
            } catch (e) {
                console.error('Failed to load checkroll data:', e)
                setError('Gagal memuat data profil: ' + (e.message || e))
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [token, empCode, month, year, division])

    // Lazy load history when user switches tab
    useEffect(() => {
        if ((activeTab === 'karir' || activeTab === 'gaji' || activeTab === 'beras' || activeTab === 'analisis') && payrollHistory.length === 0 && careerHistory.length === 0 && !historyLoading) {
            loadHistoryData()
        }
    }, [activeTab])

    async function loadHistoryData() {
        setHistoryLoading(true)
        try {
            // ALL historical data comes EXCLUSIVELY from extend_db_ptrj (seeded history database)
            const historical = await getEmployeeHistoricalData(token, empCode);
            const data = historical || { career: [], payroll: [] };
            setCareerHistory(data.career || [])
            setPayrollHistory(data.payroll || [])
            console.log(`[HrInfoPage] Seeded data loaded: ${(data.career || []).length} career, ${(data.payroll || []).length} payroll records`);
        } catch (e) {
            console.error("[HrInfoPage] Failed to load seeded history:", e);
        } finally {
            setHistoryLoading(false)
        }
    }

    if (loading) {
        return <LoadingScreen isLoading={true} message="Memuat Profil HR Managerial..." />
    }

    if (error) {
        return (
            <div className="payslip-wrapper" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
                    <h2 style={{ color: '#1e293b', marginBottom: '1rem' }}>Gagal Memuat Data</h2>
                    <p style={{ color: '#64748b', marginBottom: '2rem' }}>{error}</p>
                    <button onClick={onBack} style={{ padding: '10px 24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Kembali</button>
                </div>
            </div>
        )
    }

    const empInfo = checkrollData?.employee || employeeData || {}

    const renderTenure = () => {
        if (!empInfo.join_date) return '-';
        try {
            const joinDate = new Date(empInfo.join_date);
            const now = new Date();
            let years = now.getFullYear() - joinDate.getFullYear();
            let months = now.getMonth() - joinDate.getMonth();
            if (months < 0) { years--; months += 12; }
            return `${years} tahun ${months} bulan`;
        } catch { return '-'; }
    }

    const fmt = (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return '-';
        return new Intl.NumberFormat('id-ID').format(n);
    }
    const n = (v) => parseFloat(v) || 0;
    const getMonthName = (m) => ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1] || m;

    // Styles
    const card = { backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', marginBottom: '1.5rem' };
    const th = (bg = '#f8fafc', color = '#475569', border = '#e2e8f0') => ({ padding: '0.5rem 0.6rem', borderBottom: `1px solid ${border}`, backgroundColor: bg, color, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' });
    const td = (align = 'left') => ({ padding: '0.5rem 0.6rem', fontSize: '0.8rem', textAlign: align, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' });

    const tabs = [
        { id: 'profil', label: '👤 Profil', icon: '' },
        { id: 'karir', label: '📊 Karir & Mutasi', icon: '' },
        { id: 'gaji', label: '💰 Riwayat Gaji', icon: '' },
        { id: 'beras', label: '🍚 Tunjangan Beras', icon: '' },
        { id: 'analisis', label: '📋 Analisis Lengkap', icon: '' },
    ];

    return (
        <div style={{ padding: '1.5rem 2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.6rem', fontWeight: 'bold' }}>Managerial HR Profile</h1>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>Riwayat Komprehensif Karyawan</p>
                </div>
                <button onClick={onBack} style={{ padding: '8px 16px', backgroundColor: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    ← Kembali
                </button>
            </div>

            {/* ID Banner */}
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#4f46e5', fontWeight: 'bold', flexShrink: 0 }}>
                    {(empInfo.nama || 'NN').substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>{empInfo.nama || '-'}</h2>
                    <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '0.82rem', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span><strong>EmpCode:</strong> {empInfo.nik || empCode}</span>
                        <span><strong>NIK KTP:</strong> {empInfo.actual_nik || '-'}</span>
                        <span><strong>Divisi:</strong> {empInfo.loc_code || division || '-'}</span>
                        <span><strong>Gang:</strong> {empInfo.gang_code || '-'}</span>
                        <span style={{ color: empInfo.status === '1' ? '#059669' : '#ef4444', fontWeight: 600 }}>{empInfo.status === '1' ? '● Aktif' : '● Non-Aktif'}</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        padding: '10px 20px', border: 'none', borderBottom: activeTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent',
                        backgroundColor: 'transparent', color: activeTab === tab.id ? '#1e40af' : '#64748b',
                        cursor: 'pointer', fontWeight: activeTab === tab.id ? 700 : 500, fontSize: '0.88rem',
                        transition: 'all 0.2s', whiteSpace: 'nowrap', marginBottom: '-2px'
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ==================== TAB: PROFIL ==================== */}
            {activeTab === 'profil' && (
                <div style={card}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                        <div>
                            <h3 style={{ margin: '0 0 1rem 0', color: '#0369a1', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #bae6fd', paddingBottom: '0.25rem', display: 'inline-block' }}>🏢 Penempatan & Kepegawaian</h3>
                            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.88rem' }}>
                                {[
                                    ['Divisi / Lokasi', empInfo.loc_code || division || '-'],
                                    ['Gang', `${empInfo.gang_code || '-'} ${empInfo.gang_description ? `— ${empInfo.gang_description}` : ''}`],
                                    ['Status', empInfo.status === '1' ? 'Aktif' : empInfo.status === '0' ? 'Non-Aktif' : (empInfo.status || '-')],
                                    ['Tipe Karyawan', empInfo.employee_type || '-'],
                                    ['Tanggal Bergabung', empInfo.join_date ? new Date(empInfo.join_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
                                    ['Masa Kerja', renderTenure()],
                                    ['Upah Dasar', `Rp ${fmt(empInfo.upah_dasar)}`],
                                    ['Status PTKP', empInfo.status_ptkp || '-'],
                                    ['Kategori TER', empInfo.kategori_ter || '-'],
                                ].map(([label, value], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.2rem' }}>
                                        <span style={{ color: '#64748b' }}>{label}</span>
                                        <span style={{ fontWeight: 500, color: '#1e293b', textAlign: 'right' }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 1rem 0', color: '#b45309', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #fde68a', paddingBottom: '0.25rem', display: 'inline-block' }}>👤 Data Demografis</h3>
                            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.88rem' }}>
                                {[
                                    ['Jenis Kelamin', empInfo.jenis_kelamin === 'P' ? 'Perempuan' : empInfo.jenis_kelamin === 'L' ? 'Laki-laki' : '-'],
                                    ['Tempat Lahir', empInfo.birth_place || '-'],
                                    ['Tanggal Lahir', empInfo.birth_date ? new Date(empInfo.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
                                    ['Agama', empInfo.religion || '-'],
                                    ['Status Pernikahan', empInfo.marital_status || '-'],
                                ].map(([label, value], i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.2rem' }}>
                                        <span style={{ color: '#64748b' }}>{label}</span>
                                        <span style={{ fontWeight: 500 }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TAB: KARIR ==================== */}
            {activeTab === 'karir' && (
                <div style={card}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#3730a3', fontSize: '1rem' }}>📊 Riwayat Karir & Mutasi Divisi <span style={{ fontSize: '0.65rem', padding: '2px 8px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '12px', fontWeight: 600, marginLeft: '8px' }}>Seeded History DB</span></h3>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            <div className="spinner" style={{ border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                            Memuat riwayat karir...
                        </div>
                    ) : careerHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Belum ada data karir historis.</div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Periode', 'EmpCode', 'Nama', 'Divisi', 'Lokasi', 'Gang', 'Tipe', 'Status', 'Upah Dasar'].map(h => (
                                            <th key={h} style={th('#eef2ff', '#3730a3', '#c7d2fe')}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {careerHistory.map((c, i) => (
                                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                            <td style={{ ...td(), fontWeight: 600, color: '#334155' }}>{getMonthName(c.period_month)} {c.period_year}</td>
                                            <td style={td()}>{c.emp_code || '-'}</td>
                                            <td style={td()}>{c.emp_name || '-'}</td>
                                            <td style={td()}>{c.division_code || '-'}</td>
                                            <td style={td()}>{c.loc_code || '-'}</td>
                                            <td style={td()}>{c.gang_code || '-'}</td>
                                            <td style={td()}>{c.employee_type || '-'}</td>
                                            <td style={td()}>{c.status || '-'}</td>
                                            <td style={{ ...td('right'), fontWeight: 600 }}>Rp {fmt(c.upah_dasar)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB: BERAS ==================== */}
            {activeTab === 'beras' && (
                <div style={card}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#92400e', fontSize: '1rem' }}>🍚 Riwayat Tunjangan Beras</h3>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Memuat riwayat beras...</div>
                    ) : payrollHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Belum ada data tunjangan beras.</div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #fde68a' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={th('#fffbeb', '#92400e', '#fde68a')}>Periode</th>
                                        <th style={th('#fffbeb', '#92400e', '#fde68a')}>EmpCode</th>
                                        <th style={{ ...th('#fffbeb', '#92400e', '#fde68a'), textAlign: 'right' }}>Rate Beras</th>
                                        <th style={{ ...th('#fffbeb', '#92400e', '#fde68a'), textAlign: 'right' }}>Jumlah Tunjangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrollHistory.map((p, i) => (
                                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fffbeb' }}>
                                            <td style={{ ...td(), fontWeight: 600, color: '#78350f' }}>{p.period_label || `${getMonthName(n(p.period_month))} ${p.period_year}`}</td>
                                            <td style={td()}>{(p.nik || p.emp_code || '-').toString().trim()}</td>
                                            <td style={{ ...td('right') }}>Rp {fmt(p.beras_rate)}</td>
                                            <td style={{ ...td('right'), fontWeight: 600, color: '#d97706' }}>Rp {fmt(p.beras_jumlah)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB: GAJI ==================== */}
            {activeTab === 'gaji' && (
                <div style={card}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#166534', fontSize: '1rem' }}>💰 Riwayat Penggajian (Simple View)</h3>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Memuat riwayat penggajian...</div>
                    ) : payrollHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Belum ada data penggajian.</div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Periode', 'EmpCode', 'HK', 'Gaji Pokok', 'Total Tunjangan', 'Total Premi', 'Upah Kotor', 'Total Potongan', 'PPH21', 'Upah Bersih'].map(h => (
                                            <th key={h} style={{ ...th('#f0fdf4', '#166534', '#bbf7d0'), textAlign: h === 'Periode' || h === 'EmpCode' ? 'left' : 'right' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrollHistory.map((p, i) => (
                                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                                            <td style={{ ...td(), fontWeight: 600, color: '#14532d' }}>{p.period_label || `${getMonthName(n(p.period_month))} ${p.period_year}`}</td>
                                            <td style={{ ...td(), color: '#64748b', fontSize: '0.75rem' }}>{(p.nik || p.emp_code || '-').toString().trim()}</td>
                                            <td style={{ ...td('right') }}>{n(p.jumlah_hk || p.hari_kerja)}</td>
                                            <td style={{ ...td('right') }}>Rp {fmt(p.gaji_pokok_aktual || p.gaji_pokok)}</td>
                                            <td style={{ ...td('right') }}>Rp {fmt(p.total_tunjangan)}</td>
                                            <td style={{ ...td('right') }}>Rp {fmt(p.total_premi)}</td>
                                            <td style={{ ...td('right'), fontWeight: 700, color: '#14532d' }}>Rp {fmt(p.jumlah_upah_kotor)}</td>
                                            <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.total_potongan || p.total_potongan_bersih)}</td>
                                            <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pph21_ter || p.pot_pph21)}</td>
                                            <td style={{ ...td('right'), fontWeight: 700, color: '#059669' }}>Rp {fmt(p.upah_bersih)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB: ANALISIS LENGKAP ==================== */}
            {activeTab === 'analisis' && (
                <div>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#334155', fontSize: '1.1rem' }}>📋 Analisis Daftar Upah Lengkap — Semua Komponen</h3>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Memuat analisis lengkap...</div>
                    ) : payrollHistory.length === 0 ? (
                        <div style={{ ...card, textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Belum ada data.</div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '2000px' }}>
                                <thead>
                                    {/* Row 1: Group headers */}
                                    <tr>
                                        <th rowSpan={2} style={{ ...th('#f8fafc', '#334155', '#e2e8f0'), position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#f8fafc' }}>Periode</th>
                                        <th rowSpan={2} style={th('#f8fafc', '#334155', '#e2e8f0')}>EmpCode</th>
                                        <th colSpan={4} style={{ ...th('#eef2ff', '#3730a3', '#c7d2fe') }}>PENGGAJIAN</th>
                                        <th colSpan={5} style={{ ...th('#fffbeb', '#92400e', '#fde68a') }}>TUNJANGAN</th>
                                        <th colSpan={3} style={{ ...th('#fdf2f8', '#831843', '#fbcfe8') }}>PREMI</th>
                                        <th rowSpan={2} style={{ ...th('#f0fdf4', '#166534', '#bbf7d0'), textAlign: 'right' }}>UPAH KOTOR</th>
                                        <th colSpan={7} style={{ ...th('#fef2f2', '#991b1b', '#fecaca') }}>POTONGAN</th>
                                        <th rowSpan={2} style={{ ...th('#fef2f2', '#991b1b', '#fecaca'), textAlign: 'right' }}>TOT. POT</th>
                                        <th colSpan={3} style={{ ...th('#ecfdf5', '#065f46', '#a7f3d0') }}>PAJAK & HASIL</th>
                                    </tr>
                                    {/* Row 2: Sub headers */}
                                    <tr>
                                        {/* PENGGAJIAN */}
                                        <th style={{ ...th('#eef2ff', '#4338ca', '#c7d2fe'), fontSize: '0.68rem' }}>HK</th>
                                        <th style={{ ...th('#eef2ff', '#4338ca', '#c7d2fe'), fontSize: '0.68rem', textAlign: 'right' }}>Upah Dasar</th>
                                        <th style={{ ...th('#eef2ff', '#4338ca', '#c7d2fe'), fontSize: '0.68rem', textAlign: 'right' }}>Gaji Pokok</th>
                                        <th style={{ ...th('#eef2ff', '#4338ca', '#c7d2fe'), fontSize: '0.68rem', textAlign: 'right' }}>Koreksi HK</th>
                                        {/* TUNJANGAN */}
                                        <th style={{ ...th('#fffbeb', '#b45309', '#fde68a'), fontSize: '0.68rem', textAlign: 'right' }}>Beras</th>
                                        <th style={{ ...th('#fffbeb', '#b45309', '#fde68a'), fontSize: '0.68rem', textAlign: 'right' }}>Jabatan</th>
                                        <th style={{ ...th('#fffbeb', '#b45309', '#fde68a'), fontSize: '0.68rem', textAlign: 'right' }}>Masa Kerja</th>
                                        <th style={{ ...th('#fffbeb', '#b45309', '#fde68a'), fontSize: '0.68rem', textAlign: 'right' }}>Lembur</th>
                                        <th style={{ ...th('#fffbeb', '#b45309', '#fde68a'), fontSize: '0.68rem', textAlign: 'right' }}>Tot. Tunj</th>
                                        {/* PREMI */}
                                        <th style={{ ...th('#fdf2f8', '#9d174d', '#fbcfe8'), fontSize: '0.68rem', textAlign: 'right' }}>Brondol</th>
                                        <th style={{ ...th('#fdf2f8', '#9d174d', '#fbcfe8'), fontSize: '0.68rem', textAlign: 'right' }}>PPH</th>
                                        <th style={{ ...th('#fdf2f8', '#9d174d', '#fbcfe8'), fontSize: '0.68rem', textAlign: 'right' }}>Tot. Premi</th>
                                        {/* POTONGAN */}
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>SPSI</th>
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>BPJS Kes (P)</th>
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>BPJS Kes (M)</th>
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>BPJS Pen (P)</th>
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>BPJS Pen (M)</th>
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>Astek (P)</th>
                                        <th style={{ ...th('#fef2f2', '#b91c1c', '#fecaca'), fontSize: '0.68rem', textAlign: 'right' }}>Astek (M)</th>
                                        {/* PAJAK & HASIL */}
                                        <th style={{ ...th('#ecfdf5', '#065f46', '#a7f3d0'), fontSize: '0.68rem', textAlign: 'right' }}>Bruto Pajak</th>
                                        <th style={{ ...th('#ecfdf5', '#065f46', '#a7f3d0'), fontSize: '0.68rem', textAlign: 'right' }}>PPH21</th>
                                        <th style={{ ...th('#ecfdf5', '#065f46', '#a7f3d0'), fontSize: '0.68rem', textAlign: 'right', fontWeight: 700 }}>UPAH BERSIH</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payrollHistory.map((p, i) => {
                                        const bg = i % 2 === 0 ? 'white' : '#fafafa';
                                        return (
                                            <tr key={i} style={{ backgroundColor: bg }}>
                                                <td style={{ ...td(), fontWeight: 600, color: '#334155', position: 'sticky', left: 0, backgroundColor: bg, zIndex: 1 }}>{p.period_label || `${getMonthName(n(p.period_month))} ${p.period_year}`}</td>
                                                <td style={{ ...td(), color: '#64748b', fontSize: '0.72rem' }}>{(p.nik || p.emp_code || '-').toString().trim()}</td>
                                                {/* PENGGAJIAN */}
                                                <td style={td('center')}>{n(p.jumlah_hk || p.hari_kerja)}</td>
                                                <td style={td('right')}>Rp {fmt(p.upah_dasar)}</td>
                                                <td style={td('right')}>Rp {fmt(p.gaji_pokok_aktual || p.gaji_pokok)}</td>
                                                <td style={{ ...td('right'), color: n(p.koreksi_hk) !== 0 ? '#b91c1c' : '#94a3b8' }}>{fmt(p.koreksi_hk)}</td>
                                                {/* TUNJANGAN */}
                                                <td style={td('right')}>Rp {fmt(p.beras_jumlah)}</td>
                                                <td style={td('right')}>Rp {fmt(p.jabatan_jumlah)}</td>
                                                <td style={td('right')}>Rp {fmt(p.masa_kerja_jumlah)}</td>
                                                <td style={td('right')}>Rp {fmt(p.lembur_jumlah)}</td>
                                                <td style={{ ...td('right'), fontWeight: 600 }}>Rp {fmt(p.total_tunjangan)}</td>
                                                {/* PREMI */}
                                                <td style={td('right')}>Rp {fmt(p.premi_brondol)}</td>
                                                <td style={td('right')}>Rp {fmt(p.premi_pph)}</td>
                                                <td style={{ ...td('right'), fontWeight: 600 }}>Rp {fmt(p.total_premi)}</td>
                                                {/* UPAH KOTOR */}
                                                <td style={{ ...td('right'), fontWeight: 700, color: '#14532d' }}>Rp {fmt(p.jumlah_upah_kotor)}</td>
                                                {/* POTONGAN */}
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_spsi)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_bpjs_kesehatan_pekerja)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_bpjs_kesehatan_majikan)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_bpjs_pensiun_pekerja)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_bpjs_pensiun_majikan)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_astek_pekerja)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pot_astek_majikan)}</td>
                                                {/* TOT POTONGAN */}
                                                <td style={{ ...td('right'), fontWeight: 600, color: '#b91c1c' }}>Rp {fmt(p.total_potongan || p.total_potongan_bersih)}</td>
                                                {/* PAJAK & HASIL */}
                                                <td style={td('right')}>Rp {fmt(p.penghasilan_bruto || p.upah_kotor_pajak)}</td>
                                                <td style={{ ...td('right'), color: '#b91c1c' }}>Rp {fmt(p.pph21_ter || p.pot_pph21)}</td>
                                                <td style={{ ...td('right'), fontWeight: 700, color: '#059669', fontSize: '0.85rem' }}>Rp {fmt(p.upah_bersih)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
