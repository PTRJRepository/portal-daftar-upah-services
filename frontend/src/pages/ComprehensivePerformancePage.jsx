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
import { isProdMode, buildAppPath } from '../utils/prodModeUtils';
import MonthSelector from '../components/common/MonthSelector';
import LoadingScreen from '../components/common/LoadingScreen';
import '../styles/wages-summary-professional.css';
import { initPrintMode } from '../utils/printOptimizer';

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function ComprehensivePerformancePage({
  onBack,
  initialMonth = new Date().getMonth() + 1,
  initialYear = new Date().getFullYear(),
  initialDivision = ''
}) {
  const { token, user } = useAuth();

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
    const employeeCount = filteredData.length;
    const totalHK = filteredData.reduce((sum, row) => sum + (row.jumlah_hk || 0), 0);
    const totalPremi = filteredData.reduce((sum, row) => sum + (row.total_premi || 0), 0);
    const totalLembur = filteredData.reduce((sum, row) => sum + (row.lembur_jumlah || 0), 0);
    const totalUpahBersih = filteredData.reduce((sum, row) => sum + (row.upah_bersih || 0), 0);

    return {
      employeeCount,
      totalHK,
      totalPremi,
      totalLembur,
      totalUpahBersih
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

  if (loading && rawData.length === 0) {
    return <LoadingScreen isLoading={loading} message="Memuat data..." />;
  }

  if (error && rawData.length === 0) {
    return (
      <div className="wsp-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#dc2626' }}>Error</h2>
        <p>{error}</p>
        <button onClick={onBack} className="sw-btn">Kembali</button>
      </div>
    );
  }

  const periodLabel = `${monthNames[month - 1]} ${year}`;

  return (
    <div className="wsp-container">
      {/* Action Bar */}
      <div className="wsp-action-bar">
        <button onClick={onBack} className="wsp-btn">KEMBALI</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={handlePrint} className="wsp-btn">PRINT</button>
          <button onClick={handleExportCSV} className="wsp-btn wsp-btn-primary">EXPORT CSV</button>
        </div>
      </div>

      {/* Document */}
      <div className="wsp-document">
        {/* Letterhead */}
        <header className="wsp-letterhead">
          <h1 className="wsp-company-name">PT. REBINMAS JAYA</h1>
          <h2 className="wsp-report-title">ANALISIS PERFORMA KOMPREHENSIF</h2>
          <div className="wsp-report-period">Periode: {periodLabel}</div>
          <div className="wsp-report-division">Divisi: {division} {gang && gang !== 'ALL' ? `- Gang: ${gang}` : ''}</div>
        </header>

        {/* Filters Section */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
            {/* Month Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>PERIODE</label>
              <MonthSelector
                month={month}
                year={year}
                onChange={(m, y) => { setMonth(m); setYear(y); }}
              />
            </div>

            {/* Division Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>DIVISI</label>
              <select
                value={division}
                onChange={(e) => { setDivision(e.target.value); setGang(''); }}
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="ALL">SEMUA DIVISI</option>
                {allDivisions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Gang Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>GANG</label>
              <select
                value={gang}
                onChange={(e) => setGang(e.target.value)}
                disabled={!division || gangs.length === 0}
                style={{
                  padding: '0.6rem 1rem',
                  fontSize: '0.9rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: (!division || gangs.length === 0) ? '#f1f5f9' : 'white',
                  cursor: (!division || gangs.length === 0) ? 'not-allowed' : 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="">Pilih Gang</option>
                <option value="ALL">SEMUA GANG</option>
                {gangs.map(g => (
                  <option key={g.gang_code} value={g.gang_code}>{g.gang_code} - {g.description || ''}</option>
                ))}
              </select>
            </div>

            {/* Fetch Data Button */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem' }}>&nbsp;</label>
              <button
                onClick={fetchData}
                disabled={loading}
                style={{
                  padding: '0.6rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  border: '1px solid #16a34a',
                  borderRadius: '6px',
                  backgroundColor: loading ? '#86efac' : '#22c55e',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: loading ? 0.7 : 1,
                  minWidth: '150px'
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#16a34a';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#22c55e';
                  }
                }}
              >
                {loading ? 'MEMUAT...' : 'FETCH DATA'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI Cards - Dynamic based on activeTab */}
        <div className="wsp-kpi-grid">
          <div className="wsp-kpi-card">
            <div className="wsp-kpi-label">Total Employee</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.employeeCount)}</div>
          </div>
          <div className="wsp-kpi-card">
            <div className="wsp-kpi-label">Total HK</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.totalHK)}</div>
          </div>
          {(activeTab === 'semua' || activeTab === 'premi') && (
            <div className="wsp-kpi-card">
              <div className="wsp-kpi-label">Total Premi</div>
              <div className="wsp-kpi-value">{formatNumber(kpiData.totalPremi)}</div>
            </div>
          )}
          {(activeTab === 'semua' || activeTab === 'lembur') && (
            <div className="wsp-kpi-card">
              <div className="wsp-kpi-label">Total Lembur</div>
              <div className="wsp-kpi-value">{formatNumber(kpiData.totalLembur)}</div>
            </div>
          )}
          {(activeTab === 'semua' || activeTab === 'tunjangan') && (
            <div className="wsp-kpi-card">
              <div className="wsp-kpi-label">Total Tunjangan</div>
              <div className="wsp-kpi-value">{formatNumber(filteredData.reduce((s, r) => s + (r.total_tunjangan || 0), 0))}</div>
            </div>
          )}
          {activeTab === 'potongan' && (
            <div className="wsp-kpi-card">
              <div className="wsp-kpi-label">Total Potongan</div>
              <div className="wsp-kpi-value">{formatNumber(filteredData.reduce((s, r) => s + (r.total_potongan_bersih || 0), 0))}</div>
            </div>
          )}
          <div className="wsp-kpi-card highlight">
            <div className="wsp-kpi-label">Total Upah Bersih</div>
            <div className="wsp-kpi-value">{formatNumber(kpiData.totalUpahBersih)}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'semua', label: 'Semua' },
            { key: 'lembur', label: 'Lembur' },
            { key: 'premi', label: 'Premi' },
            { key: 'tunjangan', label: 'Tunjangan' },
            { key: 'potongan', label: 'Potongan' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.6rem 1.2rem',
                fontSize: '0.85rem',
                fontWeight: '600',
                border: '1px solid',
                borderColor: activeTab === tab.key ? '#1e3a8a' : '#cbd5e1',
                backgroundColor: activeTab === tab.key ? '#1e3a8a' : 'white',
                color: activeTab === tab.key ? 'white' : '#475569',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              {tab.label} ({activeTab === tab.key ? filteredData.length : rawData.filter(r => {
                switch (tab.key) {
                  case 'lembur': return r.lembur_jam > 0;
                  case 'premi': return r.total_premi > 0;
                  case 'tunjangan': return r.total_tunjangan > 0;
                  case 'potongan': return r.total_potongan_bersih > 0;
                  default: return true;
                }
              }).length})
            </button>
          ))}
        </div>

        {/* Range Filter Inputs - Dynamic based on activeTab */}
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#475569' }}>
            Filter {activeTab === 'semua' ? 'Upah Bersih' : activeTab === 'premi' ? 'Premi' : activeTab === 'lembur' ? 'Lembur' : activeTab === 'tunjangan' ? 'Tunjangan' : 'Potongan'}:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Min:</label>
            <input
              type="number"
              value={rangeFilters[activeTab]?.min || 0}
              onChange={(e) => setRangeFilters(prev => ({
                ...prev,
                [activeTab]: { ...prev[activeTab], min: parseInt(e.target.value) || 0 }
              }))}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.9rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                width: '140px',
                backgroundColor: 'white'
              }}
              placeholder="0"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#64748b' }}>Max:</label>
            <input
              type="number"
              value={rangeFilters[activeTab]?.max || ''}
              onChange={(e) => setRangeFilters(prev => ({
                ...prev,
                [activeTab]: { ...prev[activeTab], max: e.target.value ? parseInt(e.target.value) : null }
              }))}
              style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.9rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                width: '140px',
                backgroundColor: 'white'
              }}
              placeholder="Kosongkan untuk tanpa batas"
            />
          </div>
          <button
            onClick={() => setRangeFilters(prev => ({
              ...prev,
              [activeTab]: { min: 0, max: null }
            }))}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              color: '#64748b'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            Reset
          </button>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
            {filteredData.length} data {filteredData.length !== rawData.length ? `dari ${rawData.length}` : ''}
          </div>
        </div>

        {/* Data Table */}
        <div className="wsp-table-wrapper" style={{ marginTop: '1.5rem' }}>
          {filteredData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
              <div>Tidak ada data untuk filter yang dipilih</div>
            </div>
          ) : (
            <table className="wsp-table">
              <thead>
                {/* Level 1: Column Groups - Dynamic based on activeTab */}
                <tr className="wsp-header-master">
                  <th colSpan="4">IDENTITAS & TASK</th>
                  <th colSpan="1">ABSENSI</th>
                  {activeTab === 'semua' && <th colSpan="4">TUNJANGAN</th>}
                  {activeTab === 'semua' && <th colSpan={2 + dynamicPremiHeaders.length}>PREMI</th>}
                  {activeTab === 'lembur' && <th colSpan="2">LEMBUR</th>}
                  {activeTab === 'tunjangan' && <th colSpan="4">TUNJANGAN</th>}
                  {activeTab === 'premi' && <th colSpan={2 + dynamicPremiHeaders.length}>PREMI</th>}
                  {activeTab === 'potongan' && <th colSpan="1">POTONGAN</th>}
                  {activeTab === 'semua' && <th colSpan="2">TOTAL</th>}
                  <th colSpan="1">UPAH BERSIH</th>
                </tr>
                {/* Level 2: Column Names */}
                <tr className="wsp-header-sub">
                  <th>NIK</th>
                  <th>NAMA</th>
                  <th>GANG</th>
                  <th>Task Desc</th>
                  <th>HK</th>
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <th>Beras</th>}
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <th>Jabatan</th>}
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <th>Masa Kerja</th>}
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <th>Total</th>}
                  {(activeTab === 'semua' || activeTab === 'premi') && <th>Brondol</th>}
                  {(activeTab === 'semua' || activeTab === 'premi') && <th>Pruning</th>}
                  {(activeTab === 'semua' || activeTab === 'premi') && dynamicPremiHeaders.map(h => <th key={h}>{h.replace(/_/g, ' ').toUpperCase()}</th>)}
                  {(activeTab === 'semua' || activeTab === 'premi') && <th>Total</th>}
                  {(activeTab === 'semua' || activeTab === 'lembur') && <th>Jam</th>}
                  {(activeTab === 'lembur') && <th>Jumlah</th>}
                  {activeTab === 'potongan' && <th>Total Potongan</th>}
                  {activeTab === 'semua' && <th>Kotor</th>}
                  <th>Bersih</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'wsp-row-even' : 'wsp-row-odd'}>
                    <td>{row.nik || '-'}</td>
                    <td>{row.nama || '-'}</td>
                    <td>{row.gang_code || '-'}</td>
                    <td style={{ fontSize: '0.75rem' }}>{row.task_desc || '-'}</td>
                    <td className="text-right">{formatNumber(row.jumlah_hk)}</td>
                    {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(row.beras_jumlah)}</td>}
                    {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(row.jabatan_jumlah)}</td>}
                    {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(row.masa_kerja_jumlah)}</td>}
                    {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(row.total_tunjangan)}</td>}
                    {(activeTab === 'semua' || activeTab === 'premi') && <td className="text-right">{formatNumber(row.premi_brondol)}</td>}
                    {(activeTab === 'semua' || activeTab === 'premi') && <td className="text-right">{formatNumber(row.premi_pruning)}</td>}
                    {(activeTab === 'semua' || activeTab === 'premi') && dynamicPremiHeaders.map(h => (
                      <td key={h} className="text-right">{formatNumber(row.premi?.[h])}</td>
                    ))}
                    {(activeTab === 'semua' || activeTab === 'premi') && <td className="text-right">{formatNumber(row.total_premi)}</td>}
                    {(activeTab === 'semua' || activeTab === 'lembur') && <td className="text-right">{formatDecimal(row.lembur_jam)}</td>}
                    {activeTab === 'lembur' && <td className="text-right">{formatNumber(row.lembur_jumlah)}</td>}
                    {activeTab === 'potongan' && <td className="text-right">{formatNumber(row.total_potongan_bersih)}</td>}
                    {activeTab === 'semua' && <td className="text-right">{formatNumber(row.jumlah_upah_kotor)}</td>}
                    <td className="text-right" style={{ fontWeight: 'bold' }}>{formatNumber(row.upah_bersih)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="wsp-grand-total">
                  <td colSpan="4">TOTAL ({filteredData.length} Employee)</td>
                  <td className="text-right">{formatNumber(kpiData.totalHK)}</td>
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.beras_jumlah || 0), 0))}</td>}
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.jabatan_jumlah || 0), 0))}</td>}
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.masa_kerja_jumlah || 0), 0))}</td>}
                  {(activeTab === 'semua' || activeTab === 'tunjangan') && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.total_tunjangan || 0), 0))}</td>}
                  {(activeTab === 'semua' || activeTab === 'premi') && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.premi_brondol || 0), 0))}</td>}
                  {(activeTab === 'semua' || activeTab === 'premi') && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.premi_pruning || 0), 0))}</td>}
                  {(activeTab === 'semua' || activeTab === 'premi') && dynamicPremiHeaders.map(h => (
                    <td key={h} className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.premi?.[h] || 0), 0))}</td>
                  ))}
                  {(activeTab === 'semua' || activeTab === 'premi') && <td className="text-right">{formatNumber(kpiData.totalPremi)}</td>}
                  {(activeTab === 'semua' || activeTab === 'lembur') && <td className="text-right">{formatDecimal(filteredData.reduce((s, r) => s + (r.lembur_jam || 0), 0))}</td>}
                  {activeTab === 'lembur' && <td className="text-right">{formatNumber(kpiData.totalLembur)}</td>}
                  {activeTab === 'potongan' && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.total_potongan_bersih || 0), 0))}</td>}
                  {activeTab === 'semua' && <td className="text-right">{formatNumber(filteredData.reduce((s, r) => s + (r.jumlah_upah_kotor || 0), 0))}</td>}
                  <td className="text-right" style={{ fontWeight: 'bold' }}>{formatNumber(kpiData.totalUpahBersih)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
          <div>Dicetak pada: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ marginTop: '0.3rem' }}>Sistem Payroll PT Rebinmas Jaya</div>
        </div>
      </div>
    </div>
  );
}
