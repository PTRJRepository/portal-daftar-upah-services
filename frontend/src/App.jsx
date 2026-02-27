import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ReportProvider, useReport } from './context/ReportContext'
import LoadingScreen from './components/common/LoadingScreen'
import ErrorBoundary from './components/common/ErrorBoundary'
import { isProdMode, getUserDivision, redirectToExternalLogin, buildAppPath, getBasePath } from './utils/prodModeUtils'
import DashboardLayout from './layouts/DashboardLayout'
import ReportToolbar from './components/common/ReportToolbar'
import './styles/print-overrides.css'

// Lazy load pages
const DashboardHome = lazy(() => import('./pages/DashboardHome'))
const EmployeeDetailRoute = lazy(() => import('./pages/EmployeeDetailRoute'))
const HrInfoRoute = lazy(() => import('./pages/HrInfoRoute'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PayslipPrintPage = lazy(() => import('./pages/PayslipPrintPage'))

// Report Pages
const CustomPayrollTable = lazy(() => import('./components/CustomPayrollTable'))
const EmployeeDirectoryPage = lazy(() => import('./pages/EmployeeDirectoryPage'))
const SummaryReportPage = lazy(() => import('./pages/SummaryReportPage'))
const WagesSummaryRebinmasPage = lazy(() => import('./pages/WagesSummaryRebinmasPage'))
const WagesSummaryIJLPage = lazy(() => import('./pages/WagesSummaryIJLPage'))
const AnalysisReportPage = lazy(() => import('./pages/AnalysisReportPage'))
const AggregationSeederPage = lazy(() => import('./pages/AggregationSeederPage'))
const SpreadsheetSyncPage = lazy(() => import('./pages/SpreadsheetSyncPage'))
const PayrollAnalysisPage = lazy(() => import('./pages/PayrollAnalysisPage'))
const ExecutivePayrollPage = lazy(() => import('./pages/ExecutivePayrollPage'))
const GangComparisonReportPage = lazy(() => import('./pages/GangComparisonReportPage'))
const WagesComparisonPage = lazy(() => import('./pages/WagesComparisonPage'))
const TaxReportPage = lazy(() => import('./pages/TaxReportPage'))
const OtherIncomesPage = lazy(() => import('./pages/OtherIncomesPage'))

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

  const [fontSize, setFontSize] = useState(100);
  const [exportHandler, setExportHandler] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [useHistoryDb, setUseHistoryDb] = useState(false);

  // Layout state for selectors
  // If not admin and locked mode, division is read-only
  const canChangeDivision = isAdminUser || !isLockedMode;

  const handleFontIncrease = () => setFontSize(prev => Math.min(prev + 10, 150))
  const handleFontDecrease = () => setFontSize(prev => Math.max(prev - 10, 60))
  const handleFontReset = () => setFontSize(100)

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
      division: division
    });

    const printPath = buildAppPath(`/payslip-print?${params.toString()}`);
    window.open(printPath, '_blank', 'noopener,noreferrer');
  };

  const handleViewEmployeeDetail = (employeeData) => {
    console.log('[OperationalReport] Opening detail tab for employee:', employeeData)

    const nik = employeeData.nik || employeeData.NIK
    if (!nik) {
      console.error('[OperationalReport] Cannot view detail: NIK is missing', employeeData)
      return
    }

    // Open in new tab with params for EmployeeDetailRoute
    const params = new URLSearchParams({
      nik: nik,
      month: month,
      year: year,
      division: division
    })

    // Use buildAppPath to add base path (/upah) in proxy mode
    const detailPath = buildAppPath(`/employee/detail?${params.toString()}`)
    window.open(detailPath, '_blank', 'noopener,noreferrer')
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
      {/* Toolbar */}
      {/* Toolbar - Compact Single Line */}
      <div style={{
        height: '56px', // Fixed height for consistency
        padding: '0 1rem',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexShrink: 0
      }}>
        {/* Left Side: Navigation & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          {/* Back & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
              title="Dashboard"
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#1e293b', whiteSpace: 'nowrap' }}>
              Operational
            </span>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#cbd5e1', margin: '0 0.25rem' }}></div>
          </div>

          {/* Selectors Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Division */}
            <select
              value={division}
              onChange={(e) => canChangeDivision && setDivision(e.target.value)}
              disabled={!canChangeDivision}
              title={!canChangeDivision ? "Locked" : "Division"}
              style={{
                height: '32px',
                padding: '0 2rem 0 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#334155',
                backgroundColor: !canChangeDivision ? '#f8fafc' : 'white',
                cursor: !canChangeDivision ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1em 1em',
                minWidth: '80px'
              }}
            >
              {allDivisions.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>

            {/* Gang */}
            <select
              value={gang || ""}
              onChange={(e) => setGang(e.target.value)}
              disabled={gangLoading}
              style={{
                height: '32px',
                padding: '0 2rem 0 0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                color: '#334155',
                backgroundColor: gangLoading ? '#f8fafc' : 'white',
                cursor: gangLoading ? 'wait' : 'pointer',
                fontWeight: '500',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1em 1em',
                maxWidth: '160px',
                textOverflow: 'ellipsis'
              }}
            >
              {gangLoading ? <option>Loading...</option> : (
                <>
                  <option value="ALL">All Gangs</option>
                  {gangs.map(g => (
                    <option key={g.gang_code} value={g.gang_code}>{g.gang_code} - {g.description || ''}</option>
                  ))}
                </>
              )}
            </select>

            {/* Current Period Badge */}
            <div style={{
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 0.75rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              color: '#1d4ed8',
              fontWeight: '600',
              fontSize: '0.85rem',
              whiteSpace: 'nowrap'
            }}>
              {month}-{year}
            </div>

            {/* Quick Period Buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {previousPeriods.slice(0, 3).map((p) => (
                <button
                  key={`${p.month}-${p.year}`}
                  onClick={() => { setMonth(p.month); setYear(p.year); }}
                  style={{
                    height: '32px',
                    padding: '0 0.75rem',
                    fontSize: '0.75rem',
                    color: '#475569',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#94a3b8';
                    e.currentTarget.style.color = '#0f172a';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Font Controls */}
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={handleFontDecrease} style={{ padding: '0.4rem 0.8rem', background: 'white', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem' }}>A-</button>
            <button onClick={handleFontReset} style={{ padding: '0.4rem 0.8rem', background: 'white', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem' }}>Reset</button>
            <button onClick={handleFontIncrease} style={{ padding: '0.4rem 0.8rem', background: 'white', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>A+</button>
          </div>

          {/* Payslip Print Button */}
          <button
            onClick={handlePrintPayslips}
            disabled={selectedEmployees.length === 0}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: selectedEmployees.length > 0 ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: selectedEmployees.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            title={selectedEmployees.length > 0 ? `Cetak slip gaji ${selectedEmployees.length} karyawan` : 'Pilih karyawan terlebih dahulu'}
          >
            🖨️ Print Slip Gaji {selectedEmployees.length > 0 && `(${selectedEmployees.length})`}
          </button>

          {/* DB Mode Toggle */}
          <button
            onClick={() => setUseHistoryDb(!useHistoryDb)}
            style={{
              background: useHistoryDb ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'white',
              color: useHistoryDb ? '#ffffff' : '#334155',
              border: '1px solid #cbd5e1',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              height: '36px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            title={useHistoryDb ? "Kembali ke Database Origin" : "Gunakan Database History"}
          >
            <span>{useHistoryDb ? '📚' : '⚡'}</span>
            <span>{useHistoryDb ? 'History DB' : 'Origin DB'}</span>
          </button>

          {/* Edit Mode Toggle Button */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            style={{
              background: isEditMode ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'white',
              color: isEditMode ? '#ffffff' : '#334155',
              border: '1px solid #cbd5e1',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              height: '36px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            title={isEditMode ? "Matikan Edit Mode" : "Aktifkan Edit Mode"}
          >
            <span>{isEditMode ? '🔓' : '🔒'}</span>
            <span>{isEditMode ? 'Edit Aktif' : 'Edit Mode'}</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={!exportHandler || exportLoading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: (!exportHandler || exportLoading) ? 'not-allowed' : 'pointer',
              opacity: (!exportHandler || exportLoading) ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {exportLoading ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <CustomPayrollTable
          token={token}
          division={division}
          gangCode={gang}
          month={month}
          year={year}
          fontSize={fontSize}
          onExportReady={setExportHandler}
          onViewEmployeeDetail={handleViewEmployeeDetail}
          selectedEmployees={selectedEmployees}
          onToggleEmployeeSelection={handleToggleEmployeeSelection}
          onSelectAllEmployees={handleSelectAllEmployees}
          isEditMode={isEditMode}
          useHistoryDb={useHistoryDb}
        />
      </div>
    </div>
  )
}

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
    if (!loading) {
      // Use location.pathname from React Router to get path relative to basename
      const currentPath = location.pathname
      const isLoginPath = currentPath === '/login' || currentPath.endsWith('/login')

      // 1. External Login Redirect (Prod Mode)
      if (!isAuthenticated && !isLoginPath) {
        console.log('[App] Not authenticated, redirecting to login')
        if (!window.location.host.includes('localhost') && !window.location.host.includes('127.0.0.1')) {
          redirectToExternalLogin()
        }
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

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat halaman..." />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

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
            <Route index element={<DashboardHome />} />

            <Route path="operational" element={<OperationalReportWrapper />} />
            <Route path="employee-directory" element={<SummaryReportWrapper component={EmployeeDirectoryPage} />} />

            <Route path="summary" element={<SummaryReportWrapper component={SummaryReportPage} />} />
            <Route path="wages-rebinmas" element={<SummaryReportWrapper component={WagesSummaryRebinmasPage} />} />
            <Route path="wages-ijl" element={<SummaryReportWrapper component={WagesSummaryIJLPage} />} />
            <Route path="analysis" element={<SummaryReportWrapper component={AnalysisReportPage} />} />
            <Route path="comprehensive" element={<SummaryReportWrapper component={PayrollAnalysisPage} />} />
            <Route path="executive" element={<SummaryReportWrapper component={ExecutivePayrollPage} />} />
            <Route path="seed" element={<SummaryReportWrapper component={AggregationSeederPage} />} />
            <Route path="spreadsheet-sync" element={<SummaryReportWrapper component={SpreadsheetSyncPage} />} />
            <Route path="wages-comparison" element={<SummaryReportWrapper component={WagesComparisonPage} />} />
            <Route path="pendapatan-tidak-tetap" element={<SummaryReportWrapper component={OtherIncomesPage} />} />
            <Route path="report-pajak" element={<TaxReportPage />} />

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

  // Existing pages have onBack prop. We can map it to navigate(-1) or navigate('/')
  const handleBack = () => navigate('/');

  return <Component
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
