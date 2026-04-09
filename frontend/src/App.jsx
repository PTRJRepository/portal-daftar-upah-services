import { useEffect, useState, useMemo, useCallback, lazy, Suspense, memo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ReportProvider, useReport } from './context/ReportContext'
import LoadingScreen from './components/common/LoadingScreen'
import ErrorBoundary from './components/common/ErrorBoundary'
import { isProdMode, getUserDivision, redirectToExternalLogin, buildAppPath, getBasePath } from './utils/prodModeUtils'
import DashboardLayout from './layouts/DashboardLayout'
import ReportToolbar from './components/common/ReportToolbar'
import './styles/print-overrides.css'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Lazy load pages - TEMPORARILY STATIC
import DashboardHome from './pages/DashboardHome'
import EmployeeDetailRoute from './pages/EmployeeDetailRoute'
import HrInfoRoute from './pages/HrInfoRoute'
import LoginPage from './pages/LoginPage'
import PayslipPrintPage from './pages/PayslipPrintPage'

// Report Pages
import CustomPayrollTable from './components/CustomPayrollTable'
import GangAttendanceMatrix from './components/GangAttendanceMatrix'
import GangOvertimeMatrix from './components/GangOvertimeMatrix'
import GangEmployeeInfo from './components/GangEmployeeInfo'
import EmployeeDirectoryPage from './pages/EmployeeDirectoryAnalytics'
import SummaryReportPage from './pages/SummaryReportPage'
import WagesSummaryRebinmasPage from './pages/WagesSummaryRebinmasPage'
import WagesSummaryIJLPage from './pages/WagesSummaryIJLPage'
import AnalysisReportPage from './pages/AnalysisReportPage'
import AggregationSeederPage from './pages/AggregationSeederPage'
import SpreadsheetSyncPage from './pages/SpreadsheetSyncPage'
import PayrollAnalysisPage from './pages/PayrollAnalysisPage'
import ExecutivePayrollPage from './pages/ExecutivePayrollPage'
import GangComparisonReportPage from './pages/GangComparisonReportPage'
import WagesComparisonPage from './pages/WagesComparisonPage'
import ImpactReportPage from './pages/ImpactReportPage'
import TaxReportPage from './pages/TaxReportPage'
import OtherIncomesPage from './pages/OtherIncomesPage'
import { downloadTaxReportExcel, downloadMonthlyTaxReportExcelFromDOM } from './services/taxReportService'
import ProductivityReportPage from './pages/ProductivityReportPage'
import DetailedSalaryAnalysisPage from './pages/DetailedSalaryAnalysisPage'
import MillProductionReport from './pages/MillProductionReport'
import UpahBersihDetailPage from './pages/UpahBersihDetailPage'

// Development/Test Pages
const ComponentMetadataTestPage = lazy(() => import('./pages/ComponentMetadataTestPage'))

// Wrapper for Operational Report
const OperationalReportWrapper = () => {
  const {
    division, setDivision,
    gang, setGang,
    month, year, setMonth, setYear,
    allDivisions, gangs,
    gangLoading, isAdminUser, isLockedMode
  } = useReport();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fontSize, setFontSize] = useState(100);
  const [exportHandler, setExportHandler] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [taxDomExportLoading, setTaxDomExportLoading] = useState(false);
  const [domEmployeesData, setDomEmployeesData] = useState([]);
  const [domPremiKeys, setDomPremiKeys] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [useHistoryDb, setUseHistoryDb] = useState(false);
  const [gangPrefix, setGangPrefix] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'attendance' | 'overtime' | 'employee-directory'
  const [hrSearchNik, setHrSearchNik] = useState('');

  // Employee sorting state
  const [employeeSortBy, setEmployeeSortBy] = useState('name'); // 'name' | 'emp_code' | 'nik'
  const [employeeSortOrder, setEmployeeSortOrder] = useState('asc'); // 'asc' | 'desc'

  // Seed data state
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedingStatus, setSeedingStatus] = useState('');

  // Using location.pathname as key FORCES remount when navigating, solving 'stuck' UI
  // Note: We return the actual content here, or wrap it.
  
  // Reset gangPrefix when division changes
  useEffect(() => {
    setGangPrefix('');
  }, [division]);

  // Sync state with global context if props were passed (usually via SummaryReportWrapper style logic)
  // but here it's a direct route component.

  // Helper to extract Group number from gang code
  const getAsistensi = useCallback((gangCode) => {
    if (!gangCode) return null;
    const gc = gangCode.trim().toUpperCase();
    if (gc.startsWith('K2')) return '1';
    const match = gc.match(/\d/);
    return match ? match[0] : null;
  }, []);

  // Filter gangs by group prefix
  const filteredGangs = useMemo(() => {
    if (!gangPrefix) return gangs;
    return gangs.filter(g => getAsistensi(g.gang_code) === gangPrefix);
  }, [gangs, gangPrefix, getAsistensi]);

  // Available asistensi prefixes from loaded gangs
  const availablePrefixes = useMemo(() => {
    if (!gangs || gangs.length === 0) return [];
    const prefixes = new Set();
    gangs.forEach(g => {
      const a = getAsistensi(g.gang_code);
      if (a) prefixes.add(a);
    });
    return Array.from(prefixes).sort((a, b) => Number(a) - Number(b));
  }, [gangs, getAsistensi]);

  // Reset gangPrefix when division changes
  useEffect(() => {
      // [OPTIMIZATION] Set to the first available group automatically instead of 'SEMUA GROUP'
      const targetPrefix = availablePrefixes.length > 0 ? availablePrefixes[0] : '';
      if (gangPrefix !== targetPrefix) {
          setGangPrefix(targetPrefix);
      }
  }, [availablePrefixes, division, setGangPrefix]);

  // Layout state for selectors
  // If not admin and locked mode, division is read-only
  const canChangeDivision = isAdminUser || !isLockedMode;

  const handleFontIncrease = () => setFontSize(prev => Math.min(prev + 10, 150))
  const handleFontDecrease = () => setFontSize(prev => Math.max(prev - 10, 60))
  const handleFontReset = () => setFontSize(100)
  
  const handleEmployeeSort = (field) => {
    if (employeeSortBy === field) {
      setEmployeeSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setEmployeeSortBy(field)
      setEmployeeSortOrder('asc')
    }
  }

  const handleExportExcel = async () => {
    if (!exportHandler) {
      alert('Data belum siap untuk di-export')
      return
    }
    setExportLoading(true)
    try {
      await exportHandler()
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportTaxExcel = async () => {
    setTaxExportLoading(true)
    try {
      await downloadTaxReportExcel(token, year, month, division, gang, gangPrefix, useHistoryDb)
    } catch (err) {
      alert('Gagal mengunduh pajak: ' + (err.message || 'Unknown error'))
    } finally {
      setTaxExportLoading(false)
    }
  }

  const handleExportTaxExcelDom = async () => {
    if (!domEmployeesData || domEmployeesData.length === 0) {
      alert('Data Daftar Upah belum siap atau kosong.');
      return;
    }
    setTaxDomExportLoading(true);
    try {
      await downloadMonthlyTaxReportExcelFromDOM(token, year, month, division, gang, gangPrefix, domEmployeesData, domPremiKeys);
    } catch (err) {
      alert('Gagal mengunduh pajak DOM: ' + (err.message || 'Unknown error'));
    } finally {
      setTaxDomExportLoading(false);
    }
  }

  const handleOpenTaxReport = () => {
    const params = new URLSearchParams({
      division: division || '',
      month: String(month),
      year: String(year),
      gang: gang || '',
      gangPrefix: gangPrefix || '',
      use_history: useHistoryDb ? 'true' : 'false'
    });
    const taxPath = buildAppPath(`/report-pajak?${params.toString()}`);
    window.open(taxPath, '_blank', 'noopener,noreferrer');
  }

  const handleToggleEmployeeSelection = (nik) => {
    setSelectedEmployees(prev => {
      if (prev.includes(nik)) {
        return prev.filter(code => code !== nik);
      } else {
        return [...prev, nik];
      }
    });
  };

  const handleSelectAllEmployees = (employeeNikList) => {
    setSelectedEmployees(employeeNikList);
  };

  const handleClearSelection = () => {
    setSelectedEmployees([]);
  };

  const handlePrintPayslips = () => {
    if (selectedEmployees.length === 0) {
      alert('Pilih minimal 1 karyawan untuk mencetak slip gaji');
      return;
    }

    const params = new URLSearchParams({
      emp_codes: selectedEmployees.join(','),
      month: month,
      year: year,
      division: division,
      use_history: useHistoryDb ? 'true' : 'false'
    });

    const printPath = buildAppPath(`/payslip-print?${params.toString()}`);
    window.open(printPath, '_blank', 'noopener,noreferrer');
  };

  const handleViewEmployeeDetail = (employeeData) => {
    console.log('[OperationalReport] Opening detail tab for employee:', employeeData)

    // Prefer emp_code (Plantware code like B0075) over NIK (KTP number)
    const empCode = employeeData.emp_code || employeeData.EmpCode || employeeData.nik || employeeData.NIK
    if (!empCode) {
      console.error('[OperationalReport] Cannot view detail: emp_code is missing', employeeData)
      return
    }

    // Open in new tab with params for EmployeeDetailRoute
    const params = new URLSearchParams({
      nik: empCode,
      month: month,
      year: year,
      division: division
    })

    // Use buildAppPath to add base path (/upah) in proxy mode
    const detailPath = buildAppPath(`/employee/detail?${params.toString()}`)
    window.open(detailPath, '_blank', 'noopener,noreferrer')
  }

  const handleOpenHrProfile = (employeeData) => {
    console.log('[OperationalReport] Context Menu: Opening HR Profile tab for employee:', employeeData);
    const empCode = employeeData.emp_code || employeeData.EmpCode || employeeData.nik || employeeData.NIK;
    if (empCode) {
        const params = new URLSearchParams({ nik: empCode });
        const hrPath = buildAppPath(`/hr-info?${params.toString()}`);
        window.open(hrPath, '_blank', 'noopener,noreferrer');
    } else {
        console.error('[OperationalReport] Cannot view HR Profile: emp_code is missing');
    }
  };

  // Seed data handler
  const handleSeedData = async () => {
    if (!token) return
    if (!window.confirm(`Seed data PERSIS seperti yang tampil di UI untuk ${MONTHS[month-1]} ${year}?`)) return

    setIsSeeding(true)
    setSeedingStatus('Extracting data from UI...')

    try {
      const response = await fetch('/payroll/aggregation/seed-ui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          division: division || 'ALL',
          month,
          year,
          gangCode: gang || null,
          gangPrefix: gangPrefix || null
        })
      })

      const result = await response.json()

      if (result.success) {
        const gangCount = result.data?.total_gangs || 0
        const empCount = result.data?.total_employees || 0
        setSeedingStatus(`Success! ${gangCount} gangs, ${empCount} employees seeded`)

        // Show breakdown in console
        if (result.data?.results) {
          console.log('Seeded gangs:', result.data.results.map(r => `${r.gang_code}: ${r.upah_bersih.toLocaleString('id-ID')}`).join(', '))
        }

        setTimeout(() => {
          setSeedingStatus('')
        }, 3000)
      } else {
        setSeedingStatus(`Error: ${result.error || 'Unknown error'}`)
      }
    } catch (e) {
      console.error('UI Seed error:', e)
      setSeedingStatus(`Error: ${e.message}`)
    } finally {
      setIsSeeding(false)
    }
  }

  // Generate last 3 months for quick select
  const previousPeriods = useMemo(() => {
    const periods = [];
    const currentDate = new Date(year, month - 1, 1); // month is 1-indexed in our state

    for (let i = 1; i <= 3; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setMonth(currentDate.getMonth() - i);
      periods.push({
        month: prevDate.getMonth() + 1, // 1-indexed
        year: prevDate.getFullYear(),
        label: prevDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      });
    }
    return periods;
  }, [month, year]);

  if (!division) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <h3>Belum ada divisi yang dipilih</h3>
        <p>Silakan kembali ke <a href="/" style={{ color: '#3b82f6', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigate('/'); }}>Dashboard</a>.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar - Professional Header */}
      <div style={{
        padding: '0 1.25rem',
        borderBottom: '1px solid #e2e8f0',
        background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        flexShrink: 0
      }}>

        {/* Seeding Status Indicator */}
        {seedingStatus && (
          <div style={{
            padding: '0.5rem 0',
            backgroundColor: seedingStatus.includes('Success') || seedingStatus.includes('berhasil') ? '#d1fae5' : seedingStatus.includes('Error') || seedingStatus.includes('Gagal') ? '#fee2e2' : '#fef3c7',
            borderBottom: `1px solid ${seedingStatus.includes('Success') || seedingStatus.includes('berhasil') ? '#10b981' : seedingStatus.includes('Error') || seedingStatus.includes('Gagal') ? '#ef4444' : '#f59e0b'}`,
            fontWeight: '600',
            fontSize: '0.85rem',
            color: seedingStatus.includes('Success') || seedingStatus.includes('berhasil') ? '#065f46' : seedingStatus.includes('Error') || seedingStatus.includes('Gagal') ? '#991b1b' : '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {seedingStatus.includes('berhasil') ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            ) : seedingStatus.includes('Gagal') || seedingStatus.includes('Error') ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {seedingStatus}
          </div>
        )}

        {/* Top Row: Title & Right Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 0',
          borderBottom: gang ? '1px solid #f1f5f9' : 'none'
        }}>
          {/* Left: Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                padding: '6px',
                borderRadius: '6px',
                transition: 'all 0.15s'
              }}
              title="Kembali ke Dashboard"
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: '700',
                boxShadow: '0 2px 4px rgba(30,64,175,0.25)'
              }}>
                📋
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0f172a', lineHeight: '1.2' }}>
                  Daftar Upah
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '500' }}>
                  {division || '-'} {gang && gang !== 'ALL' ? `› ${gang}` : ''}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></div>

            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '0 12px',
                  height: '30px',
                  border: 'none',
                  background: viewMode === 'table' ? 'white' : 'transparent',
                  color: viewMode === 'table' ? '#1e40af' : '#64748b',
                  fontWeight: viewMode === 'table' ? '600' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                💰 Daftar Upah
              </button>
              <button
                onClick={() => setViewMode('attendance')}
                style={{
                  padding: '0 12px',
                  height: '30px',
                  border: 'none',
                  background: viewMode === 'attendance' ? 'white' : 'transparent',
                  color: viewMode === 'attendance' ? '#059669' : '#64748b',
                  fontWeight: viewMode === 'attendance' ? '600' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: viewMode === 'attendance' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                📅 Absensi
              </button>
              <button
                onClick={() => setViewMode('overtime')}
                style={{
                  padding: '0 12px',
                  height: '30px',
                  border: 'none',
                  background: viewMode === 'overtime' ? 'white' : 'transparent',
                  color: viewMode === 'overtime' ? '#d97706' : '#64748b',
                  fontWeight: viewMode === 'overtime' ? '600' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: viewMode === 'overtime' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                ⏰ Lembur
              </button>
              <button
                onClick={() => setViewMode('employee-directory')}
                style={{
                  padding: '0 12px',
                  height: '30px',
                  border: 'none',
                  background: viewMode === 'employee-directory' ? 'white' : 'transparent',
                  color: viewMode === 'employee-directory' ? '#0f766e' : '#64748b',
                  fontWeight: viewMode === 'employee-directory' ? '600' : '500',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: viewMode === 'employee-directory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                👥 Info Karyawan
              </button>
            </div>

            {/* Sort Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>Sort:</span>
              {[
                ['name', 'Nama'],
                ['emp_code', 'EmpCode'],
                ['nik', 'NIK']
              ].map(([field, label]) => {
                const isActive = employeeSortBy === field
                return (
                  <button
                    key={field}
                    onClick={() => handleEmployeeSort(field)}
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                      border: `1px solid ${isActive ? '#1e40af' : '#e2e8f0'}`,
                      background: isActive ? '#1e40af' : '#f8fafc',
                      color: isActive ? '#ffffff' : '#475569'
                    }}
                    title={`Sort by ${label} ${isActive ? (employeeSortOrder === 'asc' ? '↑' : '↓') : ''}`}
                  >
                    {label}
                    {isActive && (
                      <span style={{ fontSize: '9px', marginLeft: '2px' }}>
                        {employeeSortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></div>
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Seed Data Button */}
            <button
              onClick={handleSeedData}
              disabled={isSeeding}
              style={{
                height: '34px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: isSeeding ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: isSeeding ? '#92400e' : '#ffffff',
                border: `1px solid ${isSeeding ? '#fde68a' : '#047857'}`,
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: isSeeding ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                opacity: isSeeding ? 0.7 : 1
              }}
              onMouseOver={(e) => { if (!isSeeding) { e.currentTarget.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)'; } }}
              onMouseOut={(e) => { if (!isSeeding) { e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'; } }}
            >
              {isSeeding ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg> Seeding...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22V8" />
                    <path d="M5 12l7-8 7 8" />
                    <rect x="3" y="16" width="18" height="6" rx="2" />
                  </svg> Seed Data
                </>
              )}
            </button>

            {/* Font Controls */}
            <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <button onClick={handleFontDecrease} style={{ padding: '0.4rem 0.6rem', background: 'white', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' }}>A-</button>
              <button onClick={handleFontReset} style={{ padding: '0.4rem 0.6rem', background: 'white', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' }}>Reset</button>
              <button onClick={handleFontIncrease} style={{ padding: '0.4rem 0.6rem', background: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' }}>A+</button>
            </div>

            {/* DB Mode Toggle */}
            <button
              onClick={() => setUseHistoryDb(!useHistoryDb)}
              style={{
                background: useHistoryDb ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#f8fafc',
                color: useHistoryDb ? '#ffffff' : '#64748b',
                border: `1px solid ${useHistoryDb ? '#7c3aed' : '#e2e8f0'}`,
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s'
              }}
              title={useHistoryDb ? "Kembali ke Database Origin" : "Gunakan Database History"}
            >
              <span>{useHistoryDb ? '📚' : '⚡'}</span>
              {useHistoryDb ? 'History DB' : 'Origin DB'}
            </button>

            {/* Edit Mode Toggle */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              style={{
                background: isEditMode ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#f8fafc',
                color: isEditMode ? '#ffffff' : '#64748b',
                border: `1px solid ${isEditMode ? '#d97706' : '#e2e8f0'}`,
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s'
              }}
              title={isEditMode ? "Matikan Edit Mode" : "Aktifkan Edit Mode"}
            >
              <span>{isEditMode ? '🔓' : '🔒'}</span>
              {isEditMode ? 'Edit Aktif' : 'Edit Mode'}
            </button>

            {/* Payslip Print */}
            <button
              onClick={handlePrintPayslips}
              disabled={selectedEmployees.length === 0}
              style={{
                padding: '0.4rem 0.85rem',
                backgroundColor: selectedEmployees.length > 0 ? '#3b82f6' : '#f1f5f9',
                color: selectedEmployees.length > 0 ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.78rem',
                cursor: selectedEmployees.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s'
              }}
              title={selectedEmployees.length > 0 ? `Cetak slip gaji ${selectedEmployees.length} karyawan` : 'Pilih karyawan terlebih dahulu'}
            >
              🖨️ Slip Gaji {selectedEmployees.length > 0 && `(${selectedEmployees.length})`}
            </button>

            {/* Export */}
            <button
              onClick={handleExportExcel}
              disabled={!exportHandler || exportLoading}
              style={{
                padding: '0.4rem 0.85rem',
                backgroundColor: exportHandler && !exportLoading ? '#10b981' : '#f1f5f9',
                color: exportHandler && !exportLoading ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.78rem',
                cursor: exportHandler && !exportLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s'
              }}
            >
              {exportLoading ? '...' : '⬇️ Export'}
            </button>

            {/* Lihat Laporan Pajak */}
            <button
              onClick={handleOpenTaxReport}
              style={{
                padding: '0.4rem 0.85rem',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fbbf24',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s'
              }}
              title="Buka halaman laporan pajak lengkap dengan kalkulasi PPH21"
            >
              🔍 Pajak
            </button>
          </div>
        </div>

        {/* Bottom Row: Filters */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 0',
          flexWrap: 'wrap'
        }}>
          {/* Division */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Divisi</label>
            <select
              value={division}
              onChange={(e) => canChangeDivision && setDivision(e.target.value)}
              disabled={!canChangeDivision}
              style={{
                height: '30px',
                padding: '0 1.75rem 0 0.6rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#334155',
                backgroundColor: !canChangeDivision ? '#f8fafc' : 'white',
                cursor: !canChangeDivision ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.4rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '0.9em',
                minWidth: '80px'
              }}
            >
              {allDivisions.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
          </div>

          {/* Group */}
          {availablePrefixes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group</label>
              <select
                value={gangPrefix}
                onChange={(e) => {
                  setGangPrefix(e.target.value);
                  setGang('ALL');
                }}
                style={{
                  height: '30px',
                  padding: '0 1.75rem 0 0.6rem',
                  border: `1px solid ${gangPrefix ? '#3b82f6' : '#e2e8f0'}`,
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  color: '#334155',
                  backgroundColor: gangPrefix ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  fontWeight: '500',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.4rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '0.9em',
                  minWidth: '100px'
                }}
              >
                <option value="">Semua Group</option>
                {availablePrefixes.map(prefix => (
                  <option key={prefix} value={prefix}>Group {prefix}</option>
                ))}
              </select>
            </div>
          )}

          {/* Gang */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kemandoran
              {gang && gang !== 'ALL' && filteredGangs.find(g => g.gang_code === gang) && (
                <span style={{ color: '#3b82f6', marginLeft: '4px', fontWeight: '600' }}>
                  [{filteredGangs.find(g => g.gang_code === gang)?.description || gang}]
                </span>
              )}
            </label>
            <select
              value={gang || ""}
              onChange={(e) => {
                const selectedGang = e.target.value;
                setGang(selectedGang);
                // Auto-update group when selecting specific gang
                if (selectedGang !== 'ALL') {
                  setGangPrefix(getAsistensi(selectedGang) || '');
                }
              }}
              disabled={gangLoading}
              style={{
                height: '30px',
                padding: '0 1.75rem 0 0.6rem',
                border: `1px solid ${gang && gang !== 'ALL' ? '#10b981' : '#e2e8f0'}`,
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#334155',
                backgroundColor: gangLoading ? '#f8fafc' : 'white',
                cursor: gangLoading ? 'wait' : 'pointer',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.4rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '0.9em',
                minWidth: '140px',
                maxWidth: '200px'
              }}
            >
              {gangLoading ? <option>Memuat...</option> : (
                <>
                  <option value="ALL">🌐 Semua Gang</option>
                  {filteredGangs.map(g => (
                    <option key={g.gang_code} value={g.gang_code}>{g.gang_code} — {g.description || '-'}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '30px', backgroundColor: '#e2e8f0', margin: '0 4px' }}></div>

          {/* Period: Month */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              style={{
                height: '30px',
                padding: '0 1.75rem 0 0.6rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#334155',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.4rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '0.9em',
                minWidth: '110px'
              }}
            >
              {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((name, i) => (
                <option key={i+1} value={i+1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Period: Year */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              style={{
                height: '30px',
                padding: '0 1.75rem 0 0.6rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#334155',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.4rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '0.9em',
                minWidth: '80px'
              }}
            >
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Active filter indicator */}
          {gang && gang !== 'ALL' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.25rem 0.6rem',
              background: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#065f46',
              fontWeight: '600'
            }}>
              ✅ {gang} {gangPrefix ? `(Group ${gangPrefix})` : ''}
            </div>
          )}
          {gang === 'ALL' && gangPrefix && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.25rem 0.6rem',
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#1e40af',
              fontWeight: '600'
            }}>
              📂 Group {gangPrefix}
            </div>
          )}

          {/* Centered Export Pajak DOM Button */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <button
              onClick={handleExportTaxExcelDom}
              disabled={taxDomExportLoading}
              style={{
                marginLeft: '10px',
                padding: '0.4rem 1.2rem',
                backgroundColor: taxDomExportLoading ? '#f1f5f9' : '#059669',
                color: taxDomExportLoading ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.78rem',
                cursor: taxDomExportLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
              }}
              title="Unduh Kalkulasi Pajak PPH21 (versi DOM sesuai UI)"
            >
              {taxDomExportLoading ? '⏳' : '📥'}
              {taxDomExportLoading ? '...' : 'Export Pajak DOM'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'table' ? (
          <CustomPayrollTable
            token={token}
            division={division}
            gangCode={gang}
            month={month}
            year={year}
            fontSize={fontSize}
            onExportReady={setExportHandler}
            onViewEmployeeDetail={handleViewEmployeeDetail}
            onOpenHrProfile={handleOpenHrProfile}
            selectedEmployees={selectedEmployees}
            onToggleEmployeeSelection={handleToggleEmployeeSelection}
            onSelectAllEmployees={handleSelectAllEmployees}
            onDataReady={setDomEmployeesData}
            onDataLoaded={(meta) => setDomPremiKeys(meta.dynamic_premi_headers || [])}
            isEditMode={isEditMode}
            useHistoryDb={useHistoryDb}
            gangPrefix={gangPrefix || null}
            sortBy={employeeSortBy}
            sortOrder={employeeSortOrder}
          />
        ) : viewMode === 'employee-directory' ? (
          <GangEmployeeInfo
            token={token}
            gangCodes={gang === 'ALL' ? (filteredGangs.length > 0 ? filteredGangs : gangs).map(g => g.gang_code) : [gang]}
            month={month}
            year={year}
            division={division}
            onViewEmployeeDetail={handleViewEmployeeDetail}
            sortBy={employeeSortBy}
            sortOrder={employeeSortOrder}
            onSortChange={handleEmployeeSort}
          />
        ) : viewMode === 'attendance' ? (
          <GangAttendanceMatrix
            token={token}
            gangCodes={gang === 'ALL' ? ( gangs.map(g => g.gang_code)) : [gang]}
            month={month}
            year={year}
            division={division}
          />
        ) : (
          <GangOvertimeMatrix
            token={token}
            gangCodes={gang === 'ALL' ? ( gangs.map(g => g.gang_code)) : [gang]}
            month={month}
            year={year}
            division={division}
          />
        )}
      </div>
    </div>
  );
};

OperationalReportWrapper.displayName = 'OperationalReportWrapper';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function AppInner() {
  const { isAuthenticated, loading, isKeraniUser } = useAuth()
  const inProdMode = isProdMode()

  const navigate = useNavigate()
  const location = useLocation()

  // URL Path Management & Role Redirects
  useEffect(() => {
    console.log('[AppInner] location changed:', location.pathname, 'key:', location.key);
    if (!loading) {
      // Use location.pathname from React Router to get path relative to basename
      const currentPath = location.pathname
      const isLoginPath = currentPath === '/login' || currentPath.endsWith('/login')

      // 1. PROXY MODE: Redirect to gateway if not authenticated
      if (inProdMode && !isAuthenticated && !isLoginPath) {
        console.log('[App] Proxy mode: Not authenticated, redirecting to gateway login')
        redirectToExternalLogin()
        return
      }

      // 2. DEV MODE: External Login Redirect
      if (!isAuthenticated && !isLoginPath && !inProdMode) {
        console.log('[App] Dev mode: Not authenticated, redirecting to login')
        navigate('/login')
        return
      }

      // 2. KERANI Role Redirect
      // Kerani can ONLY access: /operational, /employee/detail, /payslip-print, /hr-info, /report-pajak, /employee-directory, /pendapatan-tidak-tetap
      if (isAuthenticated && isKeraniUser) {
        const allowedPaths = [
          '/',
          '/operational',
          '/employee/detail',
          '/payslip-print',
          '/hr-info',
          '/login',
          '/report-pajak',
          '/employee-directory',
          '/pendapatan-tidak-tetap'
        ];
        const isAllowed = allowedPaths.some(p => currentPath === p || currentPath.startsWith(p));

        if (!isAllowed) {
          console.log('[App] Kerani user restricted to Operational page. Redirecting from:', currentPath);
          navigate('/operational', { replace: true });
        }
      }
    }
  }, [isAuthenticated, loading, inProdMode, isKeraniUser, navigate, location])

  if (loading) {
    return <LoadingScreen isLoading={true} message="Menyiapkan sistem..." />
  }

  console.log('[AppInner] rendering Routes for location:', location.pathname);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat halaman..." />}>
        <Routes>
          {/* Internal Login Route - ONLY for DEV mode, NOT for proxy mode */}
          {!inProdMode && <Route path="/login" element={<LoginPage />} />}

          {/* Employee Detail Route - From Daftar Upah (Operational: payslip, attendance matrix) */}
          <Route path="/employee/detail" element={
            <ProtectedRoute>
              <div style={{ height: '100vh', width: '100vw' }}>
                <EmployeeDetailRoute />
              </div>
            </ProtectedRoute>
          } />

          {/* HR Info Route - From Employee Directory (Managerial: profile, career history) */}
          <Route path="/hr-info" element={
            <ProtectedRoute>
              <div style={{ height: '100vh', width: '100vw', overflow: 'auto', backgroundColor: '#f8fafc' }}>
                <HrInfoRoute />
              </div>
            </ProtectedRoute>
          } />

          {/* Payslip Print Route */}
          <Route path="/payslip-print" element={
            <ProtectedRoute>
              <PayslipPrintPage />
            </ProtectedRoute>
          } />

          {/* Gang Comparison Report Route */}
          <Route path="/gang-comparison-report" element={
            <ProtectedRoute>
              <GangComparisonReportPage />
            </ProtectedRoute>
          } />

          {/* Dashboard Layout Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardHome key={location.pathname + location.search} />} />

            <Route path="operational" element={<OperationalReportWrapper key={location.pathname + location.search} />} />
            <Route path="employee-directory" element={<SummaryReportWrapper component={EmployeeDirectoryPage} />} />

            <Route path="summary" element={<SummaryReportWrapper component={SummaryReportPage} />} />
            <Route path="wages-rebinmas" element={<SummaryReportWrapper component={WagesSummaryRebinmasPage} />} />
            <Route path="wages-ijl" element={<SummaryReportWrapper component={WagesSummaryIJLPage} />} />
            <Route path="analysis" element={<SummaryReportWrapper component={AnalysisReportPage} />} />
            <Route path="comprehensive" element={<SummaryReportWrapper component={PayrollAnalysisPage} />} />
            <Route path="impact" element={<SummaryReportWrapper component={ImpactReportPage} />} />
            <Route path="executive" element={<SummaryReportWrapper component={ExecutivePayrollPage} />} />
            <Route path="seed" element={<SummaryReportWrapper component={AggregationSeederPage} />} />
            <Route path="spreadsheet-sync" element={<SummaryReportWrapper component={SpreadsheetSyncPage} />} />
            <Route path="wages-comparison" element={<SummaryReportWrapper component={WagesComparisonPage} />} />
            <Route path="pendapatan-tidak-tetap" element={<SummaryReportWrapper component={OtherIncomesPage} />} />
            <Route path="report-pajak" element={<SummaryReportWrapper component={TaxReportPage} />} />
            <Route path="productivity" element={<SummaryReportWrapper component={ProductivityReportPage} />} />
            <Route path="detailed-salary" element={<SummaryReportWrapper component={DetailedSalaryAnalysisPage} />} />
            <Route path="mill-production" element={<SummaryReportWrapper component={MillProductionReport} />} />
            <Route path="detail-upah-bersih" element={<SummaryReportWrapper component={UpahBersihDetailPage} />} />

            {/* Development/Test Pages */}
            <Route path="test/components" element={<SummaryReportWrapper component={ComponentMetadataTestPage} />} />

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

// Wrapper to pass context values to existing pages
const SummaryReportWrapper = ({ component: Component }) => {
  const { month, year, division } = useReport();
  const navigate = useNavigate();
  const location = useLocation();

  // Existing pages have onBack prop. We can map it to navigate(-1) or navigate('/')
  const handleBack = () => navigate('/');

  // Using location.pathname + search as key FORCES remount when navigating, 
  // solving the 'stuck UI' bug even when query params change
  return <Component
    key={location.pathname + location.search}
    onBack={handleBack}
    initialMonth={month}
    initialYear={year}
    initialDivision={division}
  />
}

export default function App() {
  // Get base path for proxy mode: '/upah' when accessed via proxy, '' otherwise
  const basename = getBasePath();

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ReportProvider>
          <AppInner />
        </ReportProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
