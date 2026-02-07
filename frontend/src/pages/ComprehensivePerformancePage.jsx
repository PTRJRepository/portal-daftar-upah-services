/**
 * ComprehensivePerformancePage - Analisis Performa Komprehensif
 *
 * Halaman analisis performa dengan:
 * - KPI Cards
 * - Filter tabs (Semua, Lembur, Premi, Tunjangan, Potongan)
 * - Custom HTML Table (print-ready)
 * - Row filtering berdasarkan tab aktif
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchGangs, fetchDivisions } from '../services/gangService';
import '../styles/wages-summary-professional.css';
import { initPrintMode } from '../utils/printOptimizer';

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function ComprehensivePerformancePage({
  initialMonth = new Date().getMonth() + 1,
  initialYear = new Date().getFullYear(),
  initialDivision = '',
  onBack
}) {
  const { token } = useAuth();

  // State for filters
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [division, setDivision] = useState(initialDivision);
  const [gang, setGang] = useState('');

  // State for data
  const [rawData, setRawData] = useState([]);
  const [allDivisions, setAllDivisions] = useState([]);
  const [gangs, setGangs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State for active tab
  const [activeTab, setActiveTab] = useState('semua');

  // State for range filters per tab
  const [rangeFilters, setRangeFilters] = useState({
    semua: { min: 0, max: null },      // Filter by upah_bersih
    premi: { min: 0, max: null },      // Filter by total_premi
    lembur: { min: 0, max: null },     // Filter by lembur_jumlah
    tunjangan: { min: 0, max: null },  // Filter by total_tunjangan
    potongan: { min: 0, max: null }   // Filter by total_potongan_bersih
  });

  // Initialize print mode
  useEffect(() => {
    initPrintMode();
  }, []);

  // Fetch divisions
  useEffect(() => {
    async function loadDivisions() {
      if (!token) return;
      try {
        const divisions = await fetchDivisions(token);
        setAllDivisions(divisions || []);
      } catch (e) {
        console.error('[ComprehensivePerformance] Failed to load divisions:', e);
      }
    }
    loadDivisions();
  }, [token]);

  // Load gangs when division changes
  useEffect(() => {
    async function loadGangs() {
      if (!division || !token) {
        setGangs([]);
        setGang('');
        return;
      }
      try {
        const list = await fetchGangs(token, division, null, true);
        if (list && list.length > 0) {
          setGangs(list);
          if (!gang || !list.some(g => g.gang_code === gang)) {
            setGang(list[0]?.gang_code || '');
          }
        } else {
          setGangs([]);
          setGang('');
        }
      } catch (e) {
        console.error('[ComprehensivePerformance] Failed to load gangs:', e);
        setGangs([]);
        setGang('');
      }
    }
    loadGangs();
  }, [division, token]);

  // Fetch payroll data - extracted as separate function for manual trigger
  const fetchData = async () => {
    if (!token) {
      setRawData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002';

      // Jika division dipilih (bukan "ALL"), fetch per divisi
      // Jika "ALL" atau kosong, fetch semua divisi secara parallel
      if (division && division !== 'ALL') {
        const gangParam = gang && gang !== 'ALL' ? `&gang_code=${gang}` : '';
        const response = await fetch(
          `${apiUrl}/payroll/report/division-raw-tree?division_code=${division}&month=${month}&year=${year}${gangParam}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch payroll data');
        }

        const result = await response.json();

        // Flatten the data from all gangs
        let allEmployees = [];
        if (result.gangs && Array.isArray(result.gangs)) {
          result.gangs.forEach(gangData => {
            if (gangData.employees && Array.isArray(gangData.employees)) {
              allEmployees = allEmployees.concat(gangData.employees);
            }
          });
        }

        setRawData(allEmployees);
      } else if (division === 'ALL' && allDivisions.length > 0) {
        // Fetch semua divisi secara parallel
        const divisionPromises = allDivisions.map(divCode =>
          fetch(
            `${apiUrl}/payroll/report/division-raw-tree?division_code=${divCode}&month=${month}&year=${year}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          ).then(res => res.json())
        );

        const results = await Promise.all(divisionPromises);

        // Flatten all employees from all divisions
        let allEmployees = [];
        results.forEach(result => {
          if (result.gangs && Array.isArray(result.gangs)) {
            result.gangs.forEach(gangData => {
              if (gangData.employees && Array.isArray(gangData.employees)) {
                allEmployees = allEmployees.concat(gangData.employees);
              }
            });
          }
        });

        setRawData(allEmployees);
      } else {
        setRawData([]);
      }
    } catch (e) {
      console.error('[ComprehensivePerformance] Error fetching data:', e);
      setError(e.message || 'Failed to fetch data');
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch payroll data when filters change (auto-fetch)
  useEffect(() => {
    fetchData();
  }, [token, division, gang, month, year, allDivisions]);

  // Filter data based on active tab and range filters
  const filteredData = useMemo(() => {
    const filter = rangeFilters[activeTab] || { min: 0, max: null };

    return rawData.filter(row => {
      // Determine value to check based on active tab
      let value = 0;
      let hasData = true;

      switch (activeTab) {
        case 'semua':
          value = row.upah_bersih || 0;
          hasData = true; // Always show for "Semua" tab
          break;
        case 'lembur':
          value = row.lembur_jumlah || 0;
          hasData = value > 0;
          break;
        case 'premi':
          value = row.total_premi || 0;
          hasData = value > 0;
          break;
        case 'tunjangan':
          value = row.total_tunjangan || 0;
          hasData = value > 0;
          break;
        case 'potongan':
          value = row.total_potongan_bersih || 0;
          hasData = value > 0;
          break;
        default:
          return true;
      }

      // Apply range filter
      const minMatch = value >= filter.min;
      const maxMatch = filter.max === null || value <= filter.max;

      return hasData && minMatch && maxMatch;
    });
  }, [rawData, activeTab, rangeFilters]);

  // Calculate KPI
  const kpiData = useMemo(() => {
    // Helper to sum
    const sum = (field) => filteredData.reduce((acc, row) => acc + (row[field] || 0), 0);

    return {
      employeeCount: filteredData.length,
      totalHK: sum('jumlah_hk'),
      totalPremi: sum('total_premi'),
      totalLembur: sum('lembur_jumlah'),
      totalUpahBersih: sum('upah_bersih'),
      totalTunjangan: sum('total_tunjangan'),
      totalPotongan: sum('total_potongan_bersih')
    };
  }, [filteredData]);

  // Format helpers
  const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('id-ID').format(Math.round(num));
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const formatDecimal = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = Number(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num);
  };

  // Get dynamic premi headers from data
  const dynamicPremiHeaders = useMemo(() => {
    const headers = new Set();
    rawData.forEach(row => {
      if (row.premi) {
        Object.keys(row.premi).forEach(key => {
          if (key !== 'premi_brondol' && key !== 'premi_pruning') {
            headers.add(key);
          }
        });
      }
    });
    return Array.from(headers);
  }, [rawData]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    const headers = [
      'NIK', 'NAMA', 'GANG', 'JK',
      'HK', 'Hadir',
      'Gaji Pokok',
      'Beras', 'Jabatan', 'Masa Kerja', 'Total Tunjangan',
      'Brondol', ...dynamicPremiHeaders, 'Total Premi',
      'Jam Lembur', 'Rate Lembur', 'Jumlah Lembur',
      'Astek', 'BPJS', 'SPSI', 'PPH21', 'Total Potongan',
      'Upah Kotor', 'Upah Bersih'
    ];

    const csvRows = [];
    csvRows.push(headers.join(','));

    filteredData.forEach(row => {
      const values = [
        row.nik || '',
        `"${(row.nama || '').replace(/"/g, '""')}"`,
        row.gang_code || '',
        row.jenis_kelamin || '',
        row.jumlah_hk || 0,
        row.kehadiran || 0,
        row.gaji_pokok || 0,
        row.beras_jumlah || 0,
        row.jabatan_jumlah || 0,
        row.masa_kerja_jumlah || 0,
        row.total_tunjangan || 0,
        row.premi_brondol || 0,
        ...dynamicPremiHeaders.map(h => row.premi?.[h] || 0),
        row.total_premi || 0,
        row.lembur_jam || 0,
        row.lembur_rate || 0,
        row.lembur_jumlah || 0,
        row.pot_astek || 0,
        row.pot_bpjs_kesehatan_pekerja || 0,
        row.pot_spsi || 0,
        row.pot_pph21 || 0,
        row.total_potongan_bersih || 0,
        row.jumlah_upah_kotor || 0,
        row.upah_bersih || 0
      ];
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Analisis_Performa_${division}_${month}_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Render (New UI)
  return (
    <div className="wsp-container">
      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.7)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div className="spinner-border" style={{
            width: '3rem', height: '3rem',
            border: '5px solid #e2e8f0', borderTopColor: '#3b82f6',
            borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{ marginTop: '1rem', fontWeight: 'bold', color: '#1e3a8a' }}>Memuat Data...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Action Bar */}
      <div className="wsp-action-bar no-print">
        <div className="left-section">
          <button onClick={onBack} className="wsp-btn">
            &larr; KEMBALI
          </button>

          <div className="wsp-filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Month/Year */}
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="wsp-select"
              title="Bulan"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="wsp-select"
              title="Tahun"
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>

            {/* Division */}
            <select
              value={division}
              onChange={(e) => { setDivision(e.target.value); setGang('ALL'); }}
              className="wsp-select"
              title="Divisi"
              style={{ minWidth: '150px' }}
            >
              <option value="ALL">SEMUA DIVISI</option>
              {allDivisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Gang */}
            <select
              value={gang}
              onChange={(e) => setGang(e.target.value)}
              className="wsp-select"
              title="Gang"
              disabled={division === 'ALL' || !division}
              style={{ minWidth: '150px' }}
            >
              <option value="ALL">SEMUA GANG</option>
              {gangs.map(g => (
                <option key={g.gang_code} value={g.gang_code}>
                  {g.gang_code} {g.description ? `- ${g.description}` : ''}
                </option>
              ))}
            </select>

            <button onClick={fetchData} className="wsp-btn wsp-btn-primary" disabled={loading}>
              {loading ? 'MEMUAT...' : 'REFRESH'}
            </button>
          </div>
        </div>

        <div className="right-section">
          <button onClick={handlePrint} className="wsp-btn">
            PRINT / PDF
          </button>
          <button onClick={handleExportCSV} className="wsp-btn wsp-btn-primary">
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '0.5rem', margin: '1rem' }}>
          {error}
        </div>
      )}

      {/* Report Document */}
      <div className="wsp-document">
        {/* Letterhead */}
        <div className="wsp-letterhead">
          <h1 className="wsp-company-name">PT. REBINMAS JAYA</h1>
          <h2 className="wsp-report-title">ANALISIS PERFORMA KOMPREHENSIF</h2>
          <div className="wsp-report-period">
            Periode: {monthNames[month - 1]} {year}
          </div>
          <div className="wsp-report-division">
            {division === 'ALL' ? 'SEMUA DIVISI' : `Divisi: ${division}`}
            {gang && gang !== 'ALL' && ` | Gang: ${gang}`}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="wsp-kpi-grid" style={{ marginBottom: '2rem' }}>
          <div className="wsp-kpi-card">
            <div className="wsp-kpi-label">TOTAL KARYAWAN</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.employeeCount)}</div>
          </div>
          <div className="wsp-kpi-card">
            <div className="wsp-kpi-label">TOTAL HK</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.totalHK)}</div>
          </div>
          <div className="wsp-kpi-card">
            <div className="wsp-kpi-label">TOTAL LEMBUR</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.totalLembur)}</div>
          </div>
          <div className="wsp-kpi-card highlight">
            <div className="wsp-kpi-label">TOTAL UPAH BERSIH</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.totalUpahBersih)}</div>
          </div>
        </div>

        {/* Internal Tab Filter (No-print) */}
        <div className="no-print" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'semua', label: 'SEMUA' },
              { key: 'lembur', label: 'LEMBUR' },
              { key: 'premi', label: 'PREMI' },
              { key: 'tunjangan', label: 'TUNJANGAN' },
              { key: 'potongan', label: 'POTONGAN' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={activeTab === tab.key ? 'wsp-btn wsp-btn-primary' : 'wsp-btn'}
                style={{ borderRadius: '20px', fontSize: '0.8rem' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Range Filter */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>FILTER NILAI (Min/Max):</span>
            <input
              type="number"
              placeholder="Min"
              className="wsp-select"
              style={{ width: '120px' }}
              value={rangeFilters[activeTab]?.min || ''}
              onChange={(e) => setRangeFilters(prev => ({
                ...prev, [activeTab]: { ...prev[activeTab], min: e.target.value ? parseInt(e.target.value) : 0 }
              }))}
            />
            <span style={{ color: '#94a3b8' }}>-</span>
            <input
              type="number"
              placeholder="Max"
              className="wsp-select"
              style={{ width: '120px' }}
              value={rangeFilters[activeTab]?.max || ''}
              onChange={(e) => setRangeFilters(prev => ({
                ...prev, [activeTab]: { ...prev[activeTab], max: e.target.value ? parseInt(e.target.value) : null }
              }))}
            />
            <button
              className="wsp-btn"
              onClick={() => setRangeFilters(prev => ({ ...prev, [activeTab]: { min: 0, max: null } }))}
            >
              RESET
            </button>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
              Menampilkan {filteredData.length} data
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="wsp-table-wrapper">
          <table className="wsp-table">
            <thead>
              <tr className="wsp-header-master">
                <th colSpan="4">KARYAWAN</th>
                <th colSpan="1">ABSENSI</th>
                {activeTab === 'semua' && <th colSpan="4">TUNJANGAN</th>}
                {activeTab === 'semua' && <th colSpan={2 + dynamicPremiHeaders.length}>PREMI</th>}
                {(activeTab === 'semua' || activeTab === 'lembur') && <th colSpan="2">LEMBUR</th>}
                {activeTab === 'tunjangan' && <th colSpan="4">TUNJANGAN</th>}
                {activeTab === 'premi' && <th colSpan={2 + dynamicPremiHeaders.length}>PREMI</th>}
                {activeTab === 'potongan' && <th colSpan="1">POTONGAN</th>}
                {activeTab === 'semua' && <th colSpan="2">TOTAL</th>}
                <th colSpan="1">UPAH BERSIH</th>
              </tr>
              <tr className="wsp-header-sub">
                <th>NIK</th>
                <th>NAMA</th>
                <th>GANG</th>
                <th>TASK</th>
                <th className="text-right">HK</th>

                {(activeTab === 'semua' || activeTab === 'tunjangan') && (
                  <>
                    <th className="text-right">BERAS</th>
                    <th className="text-right">JABATAN</th>
                    <th className="text-right">MASA KERJA</th>
                    <th className="text-right">TOTAL</th>
                  </>
                )}

                {(activeTab === 'semua' || activeTab === 'premi') && (
                  <>
                    <th className="text-right">BRONDOL</th>
                    <th className="text-right">PRUNING</th>
                    {dynamicPremiHeaders.map(h => (
                      <th key={h} className="text-right">{h.replace('PREMI_', '').replace(/_/g, ' ')}</th>
                    ))}
                    <th className="text-right">TOTAL</th>
                  </>
                )}

                {(activeTab === 'semua' || activeTab === 'lembur') && (
                  <>
                    <th className="text-right">JAM</th>
                    <th className="text-right">RUPIAH</th>
                  </>
                )}

                {activeTab === 'potongan' && <th className="text-right">TOTAL POTONGAN</th>}

                {activeTab === 'semua' && <th className="text-right">KOTOR</th>}
                <th className="text-right">BERSIH</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => {
                const hasLemburDetails = activeTab === 'lembur' && row.lembur_records && row.lembur_records.length > 0;

                return (
                  <React.Fragment key={idx}>
                    {/* Main Employee Row */}
                    <tr>
                      <td>{row.nik}</td>
                      <td style={{ fontWeight: 500 }}>{row.nama}</td>
                      <td>{row.gang_code}</td>
                      <td style={{ fontSize: '0.75rem' }}>{row.task_desc}</td>
                      <td className="text-right">{formatNumber(row.jumlah_hk)}</td>

                      {(activeTab === 'semua' || activeTab === 'tunjangan') && (
                        <>
                          <td className="text-right">{formatNumber(row.beras_jumlah)}</td>
                          <td className="text-right">{formatNumber(row.jabatan_jumlah)}</td>
                          <td className="text-right">{formatNumber(row.masa_kerja_jumlah)}</td>
                          <td className="text-right">{formatNumber(row.total_tunjangan)}</td>
                        </>
                      )}

                      {(activeTab === 'semua' || activeTab === 'premi') && (
                        <>
                          <td className="text-right">{formatNumber(row.premi_brondol)}</td>
                          <td className="text-right">{formatNumber(row.premi_pruning)}</td>
                          {dynamicPremiHeaders.map(h => (
                            <td key={h} className="text-right">{formatNumber(row.premi?.[h] || 0)}</td>
                          ))}
                          <td className="text-right">{formatNumber(row.total_premi)}</td>
                        </>
                      )}

                      {(activeTab === 'semua' || activeTab === 'lembur') && (
                        <>
                          <td className="text-right">{formatDecimal(row.lembur_jam)}</td>
                          <td className="text-right" style={{ fontWeight: hasLemburDetails ? 'bold' : 'normal' }}>
                            {formatNumber(row.lembur_jumlah)}
                            {hasLemburDetails && (
                              <span style={{ marginLeft: '4px', fontSize: '0.7rem', color: '#64748b' }}>
                                ▼
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {activeTab === 'potongan' && <td className="text-right">{formatNumber(row.total_potongan_bersih)}</td>}

                      {activeTab === 'semua' && <td className="text-right">{formatNumber(row.jumlah_upah_kotor)}</td>}
                      <td className="text-right" style={{ fontWeight: 'bold' }}>{formatNumber(row.upah_bersih)}</td>
                    </tr>

                    {/* Lembur Detail Sub-rows (Only when Lembur tab is active and has details) */}
                    {hasLemburDetails && row.lembur_records.map((detail, detailIdx) => (
                      <tr key={`${idx}-detail-${detailIdx}`} style={{ backgroundColor: '#f8fafc' }}>
                        <td colSpan={4} style={{ paddingLeft: '2rem', fontSize: '0.8rem', fontStyle: 'italic', color: '#64748b' }}>
                          └─ {detail.trx_date} | {detail.task_code || '-'} {detail.task_desc ? `(${detail.task_desc})` : ''}
                        </td>
                        <td className="text-right" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</td>

                        {(activeTab === 'semua' || activeTab === 'tunjangan') && (
                          <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>-</td>
                        )}

                        {(activeTab === 'semua' || activeTab === 'premi') && (
                          <td colSpan={3 + dynamicPremiHeaders.length} style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>-</td>
                        )}

                        {(activeTab === 'semua' || activeTab === 'lembur') && (
                          <>
                            <td className="text-right" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {formatDecimal(detail.hours || 0)}
                            </td>
                            <td className="text-right" style={{ fontSize: '0.8rem', color: '#059669' }}>
                              {formatNumber(detail.amount || 0)}
                            </td>
                          </>
                        )}

                        {activeTab === 'potongan' && <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>-</td>}
                        {activeTab === 'semua' && <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>-</td>}
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>-</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredData.length === 0 && !loading && (
                <tr>
                  <td colSpan="100%" className="text-center" style={{ padding: '2rem', fontStyle: 'italic', color: '#64748b' }}>
                    Tidak ada data untuk ditampilkan. Silakan cek filter Anda.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="wsp-grand-total">
                <td colSpan="4">TOTAL ({filteredData.length} Employee)</td>
                <td className="text-right">{formatNumber(kpiData.totalHK)}</td>

                {(activeTab === 'semua' || activeTab === 'tunjangan') && (
                  <>
                    <td colSpan="3"></td>
                    <td className="text-right">{formatNumber(kpiData.totalTunjangan)}</td>
                  </>
                )}
                {(activeTab === 'semua' || activeTab === 'premi') && (
                  <>
                    <td colSpan={2 + dynamicPremiHeaders.length}></td>
                    <td className="text-right">{formatNumber(kpiData.totalPremi)}</td>
                  </>
                )}
                {(activeTab === 'semua' || activeTab === 'lembur') && (
                  <>
                    <td></td>
                    <td className="text-right">{formatNumber(kpiData.totalLembur)}</td>
                  </>
                )}
                {activeTab === 'potongan' && <td className="text-right">{formatNumber(kpiData.totalPotongan)}</td>}
                {activeTab === 'semua' && <td></td>}
                <td className="text-right">{formatNumber(kpiData.totalUpahBersih)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="wsp-footer">
          <div>Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div>Sistem Payroll PT Rebinmas Jaya - Plantware Auto Report</div>
        </div>

      </div>
    </div>
  );
}
