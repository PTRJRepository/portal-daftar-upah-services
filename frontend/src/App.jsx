import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ReportProvider, useReport } from './context/ReportContext'
import LoadingScreen from './components/common/LoadingScreen'
import { isProdMode, getUserDivision, redirectToExternalLogin, buildAppPath } from './utils/prodModeUtils'
import DashboardLayout from './layouts/DashboardLayout'
import ReportToolbar from './components/common/ReportToolbar'
import './styles/print-overrides.css'

// Lazy load pages
const DashboardHome = lazy(() => import('./pages/DashboardHome'))
const EmployeeDetailRoute = lazy(() => import('./pages/EmployeeDetailRoute'))
const LoginPage = lazy(() => import('./pages/LoginPage'))

// Report Pages
const CustomPayrollTable = lazy(() => import('./components/CustomPayrollTable'))
const SummaryReportPage = lazy(() => import('./pages/SummaryReportPage'))
const WagesSummaryRebinmasPage = lazy(() => import('./pages/WagesSummaryRebinmasPage'))
const WagesSummaryIJLPage = lazy(() => import('./pages/WagesSummaryIJLPage'))
const AnalysisReportPage = lazy(() => import('./pages/AnalysisReportPage'))
const AggregationSeederPage = lazy(() => import('./pages/AggregationSeederPage'))
const SpreadsheetSyncPage = lazy(() => import('./pages/SpreadsheetSyncPage'))
const PayrollAnalysisPage = lazy(() => import('./pages/PayrollAnalysisPage'))
const ExecutivePayrollPage = lazy(() => import('./pages/ExecutivePayrollPage'))

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
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#64748b',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Kembali ke Dashboard"
          >
            ←
          </button>
          <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#0f172a' }}>
            Operational
          </div>

          {/* Division Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={division}
              onChange={(e) => canChangeDivision && setDivision(e.target.value)}
              disabled={!canChangeDivision}
              style={{
                padding: '0.4rem 2rem 0.4rem 0.8rem', // Extra padding for arrow
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.9rem',
                color: '#334155',
                backgroundColor: !canChangeDivision ? '#f1f5f9' : 'white',
                cursor: !canChangeDivision ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                maxWidth: '200px',
                appearance: 'none', // Remove default arrow
                backgroundImage: !canChangeDivision ? 'none' : `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em'
              }}
              title={!canChangeDivision ? "Anda tidak memiliki akses untuk mengganti divisi" : "Pilih Divisi"}
            >
              {allDivisions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <span style={{ color: '#cbd5e1' }}>/</span>

          {/* Gang Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              value={gang || ""} // Handle potentially null gang
              onChange={(e) => setGang(e.target.value)}
              disabled={gangLoading}
              style={{
                padding: '0.4rem 2rem 0.4rem 0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.9rem',
                color: '#334155',
                backgroundColor: gangLoading ? '#f1f5f9' : 'white',
                cursor: gangLoading ? 'wait' : 'pointer',
                fontWeight: '500',
                maxWidth: '250px',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em'
              }}
            >
              {gangLoading ? (
                <option>Memuat...</option>
              ) : (
                <>
                  <option value="ALL">SEMUA GANG</option>
                  {gangs.map(g => (
                    <option key={g.gang_code} value={g.gang_code}>
                      {g.gang_code} - {g.description || '-'}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div style={{
            fontSize: '0.9rem',
            color: '#64748b',
            fontWeight: '600',
            padding: '0.2rem 0.6rem',
            background: '#f1f5f9',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            border: '1px solid #e2e8f0'
          }}>
            {month}-{year}
          </div>

          {/* Quick Period Selectors */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {previousPeriods.map((p, idx) => (
              <button
                key={`${p.month}-${p.year}`}
                onClick={() => {
                  setMonth(p.month);
                  setYear(p.year);
                }}
                style={{
                  fontSize: '0.75rem',
                  color: '#3b82f6',
                  background: 'white',
                  border: '1px solid #bfdbfe',
                  borderRadius: '4px',
                  padding: '0.15rem 0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                title={`Lihat data ${p.label}`}
                onMouseOver={(e) => { e.target.style.background = '#eff6ff'; }}
                onMouseOut={(e) => { e.target.style.background = 'white'; }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Font Controls */}
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={handleFontDecrease} style={{ padding: '0.4rem 0.8rem', background: 'white', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem' }}>A-</button>
            <button onClick={handleFontReset} style={{ padding: '0.4rem 0.8rem', background: 'white', border: 'none', borderRight: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem' }}>Reset</button>
            <button onClick={handleFontIncrease} style={{ padding: '0.4rem 0.8rem', background: 'white', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>A+</button>
          </div>

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
        // Force remount when division/gang changes to ensure clean slate if needed
        // Although key based on division/gang is usually better handled inside 
        // CustomPayrollTable via useEffect, but adding key here ensures full remount 
        // which can be safer for complex state resets.
        // key={`${division}-${gang}-${month}-${year}`} 
        />
      </div>
    </div>
  )
}

function AppInner() {
  const { isAuthenticated, loading } = useAuth()
  const inProdMode = isProdMode()

  // URL Path Management
  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname

      if (!isAuthenticated) {
        // ALWAYS Redirect to external login (relative path on same origin)
        console.log('[App] Not authenticated, redirecting to external login/login page')

        // Prevent infinite loop if we are already at the root /login
        const isLoginPath = currentPath === '/login' || currentPath.endsWith('/login');

        if (!isLoginPath) {
          // If in Prod Mode and not authenticated, we usually redirect to external login
          if (!window.location.host.includes('localhost') && !window.location.host.includes('127.0.0.1')) {
            redirectToExternalLogin()
          }
        }
      }
    }
  }, [isAuthenticated, loading, inProdMode])

  if (loading) {
    return <LoadingScreen isLoading={true} message="Menyiapkan sistem..." />
  }

  // Protected Route Wrapper
  const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat halaman..." />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Employee Detail Route */}
        <Route path="/employee/detail" element={
          <ProtectedRoute>
            <div style={{ height: '100vh', width: '100vw' }}>
              <EmployeeDetailRoute />
            </div>
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

          <Route path="summary" element={<SummaryReportWrapper component={SummaryReportPage} />} />
          <Route path="wages-rebinmas" element={<SummaryReportWrapper component={WagesSummaryRebinmasPage} />} />
          <Route path="wages-ijl" element={<SummaryReportWrapper component={WagesSummaryIJLPage} />} />
          <Route path="analysis" element={<SummaryReportWrapper component={AnalysisReportPage} />} />
          <Route path="comprehensive" element={<SummaryReportWrapper component={PayrollAnalysisPage} />} />
          <Route path="executive" element={<SummaryReportWrapper component={ExecutivePayrollPage} />} />
          <Route path="seed" element={<SummaryReportWrapper component={AggregationSeederPage} />} />
          <Route path="spreadsheet-sync" element={<SummaryReportWrapper component={SpreadsheetSyncPage} />} />

          {/* Development/Test Pages */}
          <Route path="test/components" element={<SummaryReportWrapper component={ComponentMetadataTestPage} />} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReportProvider>
          <AppInner />
        </ReportProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
