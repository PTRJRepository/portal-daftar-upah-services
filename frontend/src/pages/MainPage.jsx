import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchGangs, fetchDivisions } from '../services/gangService'
import { getLockedGangs } from '../services/lockedDivisionService'
import { useCurrentPeriod } from '../hooks/useCurrentPeriod'
import CustomPayrollTable from '../components/CustomPayrollTable'
import LoadingScreen from '../components/common/LoadingScreen'
import MonthSelector from '../components/common/MonthSelector'
import ReportToolbar from '../components/common/ReportToolbar'
import SummaryReportPage from './SummaryReportPage'
import WagesSummaryRebinmasPage from './WagesSummaryRebinmasPage'
import WagesSummaryIJLPage from './WagesSummaryIJLPage'
import AnalysisReportPage from './AnalysisReportPage'
import AggregationSeederPage from './AggregationSeederPage'
import ComprehensivePerformancePage from './ComprehensivePerformancePage'
import { isProdMode, getUserDivision, buildAppPath } from '../utils/prodModeUtils'
import { checkReportAccess } from '../services/summaryReportService'

// Check if running in dev/test mode (admin mode)
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

export default function MainPage({ lockedDiv = null }) {
  const { user, token, logout, lockedDivision } = useAuth()

  // Detect production mode or external locked division
  const inProdMode = isProdMode()
  const prodDivision = inProdMode ? getUserDivision() : null

  // Check if user is admin (admin users are not locked to a division even in prod mode)
  // Admin = role is ADMIN or divisi is ALL
  const isAdminUser = user?.isAdmin === true ||
    (user?.role && user.role.toUpperCase() === 'ADMIN') ||
    (user?.divisi && user.divisi.toUpperCase() === 'ALL')

  // Determine if we're in locked mode (from prop, auth context, or prod mode)
  // Admin users are NOT in locked mode even if in production
  const externalLockedDiv = isAdminUser ? null : (lockedDiv || lockedDivision || null)
  const isLockedMode = !isAdminUser && !!(externalLockedDiv || prodDivision)

  // Use current period from API (calculated from PR_TASKREGLN_ARC latest date)
  const { month, setMonth, year, setYear } = useCurrentPeriod()
  const [division, setDivision] = useState('')
  const [gang, setGang] = useState('')

  const [gangs, setGangs] = useState([])
  const [gangLoading, setGangLoading] = useState(false)
  const [allDivisions, setAllDivisions] = useState([])

  const [gridLoading, setGridLoading] = useState(false)
  const [isReportGenerated, setIsReportGenerated] = useState(false)
  const [showSummaryReport, setShowSummaryReport] = useState(false)
  const [showWagesRebinmas, setShowWagesRebinmas] = useState(false)
  const [showWagesIJL, setShowWagesIJL] = useState(false)
  const [showAnalysisReport, setShowAnalysisReport] = useState(false)
  const [showAggregationSeeder, setShowAggregationSeeder] = useState(false)
  const [showComprehensivePerformance, setShowComprehensivePerformance] = useState(false)
  const [rowCount, setRowCount] = useState(0)
  const [fontSize, setFontSize] = useState(100) // Default 100% font size
  const [exportHandler, setExportHandler] = useState(null) // Export function from CustomPayrollTable
  const [exportLoading, setExportLoading] = useState(false)
  const [canAccessReports, setCanAccessReports] = useState(DEV_MODE) // Default to DEV_MODE, will be checked via API
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Refresh handler
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Font Size handlers (relative adjustment)
  const handleFontIncrease = () => setFontSize(prev => Math.min(prev + 10, 150))
  const handleFontDecrease = () => setFontSize(prev => Math.max(prev - 10, 60))
  const handleFontReset = () => setFontSize(100)

  // Export to Excel handler
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

  // Handler for viewing employee detail (called from PayrollGrid context menu)
  const handleViewEmployeeDetail = (employeeData) => {
    console.log('[MainPage] Opening detail tab for employee:', employeeData)

    const nik = employeeData.nik || employeeData.NIK
    if (!nik) {
      console.error('[MainPage] Cannot view detail: NIK is missing', employeeData)
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

  // Fetch divisions from API (database)
  useEffect(() => {
    async function loadDivisions() {
      if (!token) return
      try {
        const divisions = await fetchDivisions(token)
        setAllDivisions(divisions || [])
        console.log('[MainPage] Loaded divisions from API:', divisions)
      } catch (e) {
        console.error('[MainPage] Failed to load divisions from API:', e)
        setAllDivisions([])
      }
    }
    loadDivisions()
  }, [token])

  // Check report access for proxy mode
  // simplified report access check (no API call)
  useEffect(() => {
    // In Prod Mode, only admins can access additional reports
    if (inProdMode) {
      setCanAccessReports(isAdminUser)
    } else {
      // In Dev Mode, allow access by default
      setCanAccessReports(true)
    }
  }, [inProdMode, isAdminUser])


  // Initialize Division from User or first available
  useEffect(() => {
    let initialDivision = ''

    // Priority 1: External locked division (from prop or auth context)
    if (externalLockedDiv) {
      console.log(`[MainPage] Using external locked division = ${externalLockedDiv}`)
      initialDivision = externalLockedDiv
    }
    // Priority 2: PRODUCTION MODE - Division is LOCKED from localStorage
    else if (inProdMode && prodDivision) {
      console.log(`[MainPage] Prod mode: Using locked division = ${prodDivision}`)
      initialDivision = prodDivision
    }
    // Priority 3: Non-Admin User - Auto-select from Token/Profile (New Rule)
    else if (!isAdminUser && (user?.divisions?.length > 0 || user?.divisi)) {
      const userDiv = user?.divisions?.[0] || user?.divisi
      console.log(`[MainPage] Non-Admin: Auto-selecting user division = ${userDiv}`)
      initialDivision = userDiv
    }
    // Priority 4: Try first division from API list (Fallback for Admins)
    else if (allDivisions.length > 0) {
      initialDivision = allDivisions[0]
    }
    // Priority 5: General Fallback
    else if (user?.divisions?.length > 0) {
      initialDivision = user.divisions[0]
    }
    else if (user?.divisi) {
      initialDivision = user.divisi
    }

    // Only set if we have a value and it's different (or initial load)
    if (initialDivision && !division) {
      setDivision(initialDivision)
    }
  }, [user, inProdMode, prodDivision, externalLockedDiv, allDivisions, isAdminUser, division])

  // Load Gangs when Division changes
  useEffect(() => {
    async function load() {
      if (!division || !token) {
        setGangs([])
        setGang('')
        return
      }
      setGangLoading(true)
      try {
        // Use locked service endpoint when in locked mode
        let list
        if (isLockedMode) {
          console.log('[MainPage] Loading gangs using locked service for division:', division)
          list = await getLockedGangs(token, division)
        } else {
          list = await fetchGangs(token, division, null, true)
        }

        if (list && list.length > 0) {
          setGangs(list)
          // Auto-select first gang if not set or invalid
          const currentExists = list.some(g => g.gang_code === gang)
          if (!gang || !currentExists) {
            if (list[0]?.gang_code) setGang(list[0].gang_code)
          }
        } else {
          setGangs([])
          setGang('')
        }
      } catch (e) {
        console.error('Failed to load gangs:', e)
        // Note: 401 is handled by axios interceptor in AuthContext
        // Don't call logout() here as it would trigger redirect in prod mode
        if (e.response?.status !== 401 && !e.message?.includes('401')) {
          setGangs([])
          setGang('')
        }
      } finally {
        setGangLoading(false)
      }
    }
    load()
  }, [division, token, isLockedMode])

  // Reset gang when division changes
  const handleDivisionChange = (newDivision) => {
    setDivision(newDivision)
    setGang('') // Reset gang selection
    setGangs([]) // Clear gangs list
  }

  const handleMonthChange = (e) => {
    const val = e.target.value // "YYYY-MM"
    if (val) {
      const [y, m] = val.split('-')
      setYear(parseInt(y))
      setMonth(parseInt(m))
    }
  }

  const handleGenerate = () => {
    if (division && gang) {
      setIsReportGenerated(true)
    }
  }

  // Handler for Summary Report
  const handleShowSummaryReport = () => {
    setShowSummaryReport(true)
  }

  const handleBackFromSummary = () => {
    setShowSummaryReport(false)
  }

  // Handler for Wages Rebinmas Report
  const handleShowWagesRebinmas = () => {
    setShowWagesRebinmas(true)
  }

  const handleBackFromWagesRebinmas = () => {
    setShowWagesRebinmas(false)
  }

  // Handler for Wages IJL Report
  const handleShowWagesIJL = () => {
    setShowWagesIJL(true)
  }

  const handleBackFromWagesIJL = () => {
    setShowWagesIJL(false)
  }

  // Handler for Analysis Report
  const handleShowAnalysisReport = () => {
    setShowAnalysisReport(true)
  }

  const handleBackFromAnalysis = () => {
    setShowAnalysisReport(false)
  }

  // Handler for Aggregation Seeder
  const handleShowAggregationSeeder = () => {
    setShowAggregationSeeder(true)
  }

  const handleBackFromAggregationSeeder = () => {
    setShowAggregationSeeder(false)
  }

  // Handler for Comprehensive Performance Page
  const handleShowComprehensivePerformance = () => {
    setShowComprehensivePerformance(true)
  }

  const handleBackFromComprehensivePerformance = () => {
    setShowComprehensivePerformance(false)
  }

  // -- SHOW WAGES IJL REPORT PAGE --
  if (showWagesIJL) {
    return (
      <WagesSummaryIJLPage
        onBack={handleBackFromWagesIJL}
        initialMonth={month}
        initialYear={year}
      />
    )
  }

  // -- SHOW ANALYSIS REPORT PAGE --
  if (showAnalysisReport) {
    return (
      <AnalysisReportPage
        onBack={handleBackFromAnalysis}
        initialMonth={month}
        initialYear={year}
      />
    )
  }

  // -- SHOW AGGREGATION SEEDER PAGE --
  if (showAggregationSeeder) {
    return (
      <AggregationSeederPage
        onBack={handleBackFromAggregationSeeder}
      />
    )
  }

  // -- SHOW WAGES REBINMAS REPORT PAGE --
  if (showWagesRebinmas) {
    return (
      <WagesSummaryRebinmasPage
        onBack={handleBackFromWagesRebinmas}
        initialMonth={month}
        initialYear={year}
      />
    )
  }

  // -- SHOW SUMMARY REPORT PAGE --
  if (showSummaryReport) {
    return (
      <SummaryReportPage
        onBack={handleBackFromSummary}
        initialDivision={division}
        initialMonth={month}
        initialYear={year}
      />
    )
  }

  // -- SHOW COMPREHENSIVE PERFORMANCE PAGE --
  if (showComprehensivePerformance) {
    return (
      <ComprehensivePerformancePage
        onBack={handleBackFromComprehensivePerformance}
        initialMonth={month}
        initialYear={year}
        initialDivision={division}
      />
    )
  }

  // -- SELECTION SCREEN (Formal Professional Theme) --
  if (!isReportGenerated) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f8fafc', // Very light gray background
        fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        overflow: 'hidden',
        color: '#334155'
      }}>
        {/* SIDEBAR */}
        <div style={{
          width: '260px',
          backgroundColor: '#1e293b', // Dark Slate/Navy for Sidebar
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          boxShadow: '4px 0 10px rgba(0,0,0,0.05)'
        }}>
          {/* Sidebar Header */}
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #334155' }}>
            <img src="/images/rebinmas.webp" alt="PT Rebinmas Jaya" style={{ height: '40px', marginBottom: '1rem', display: 'block' }} />
            <div style={{ fontWeight: '600', fontSize: '0.9rem', letterSpacing: '0.05em', color: '#94a3b8', textTransform: 'uppercase' }}>Payroll System</div>
            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#ffffff' }}>PT Rebinmas Jaya</div>
          </div>

          {/* Navigation Links */}
          <div style={{ padding: '1.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#334155',
              color: '#ffffff',
              borderRadius: '6px',
              fontWeight: '500',
              fontSize: '0.9rem',
              cursor: 'default',
              borderLeft: '4px solid #3b82f6'
            }}>
              Dashboard
            </div>

            {/* Analisis Performa Link */}
            <div
              onClick={handleShowComprehensivePerformance}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                borderRadius: '6px',
                fontWeight: '500',
                fontSize: '0.9rem',
                cursor: 'pointer',
                borderLeft: '4px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#334155'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              Analisis Performa
            </div>
          </div>

          {/* User Profile & Logout */}
          <div style={{ padding: '1.5rem', borderTop: '1px solid #334155', backgroundColor: '#1e293b' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ffffff' }}>{user?.username}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{user?.role || 'Staff'}</div>
            </div>
            <button
              onClick={logout}
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid #475569',
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                borderRadius: '4px',
                fontWeight: '500',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
              onMouseOver={(e) => { e.target.style.borderColor = '#ef4444'; e.target.style.color = '#ef4444'; }}
              onMouseOut={(e) => { e.target.style.borderColor = '#475569'; e.target.style.color = '#cbd5e1'; }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Header / Hero Section */}
          <div style={{
            height: '160px',
            width: '100%',
            backgroundImage: 'url("/images/wallpaper_loading_screen.webp")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end'
          }}>
            {/* Dark Overlay for Text Readability */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.6)' // Darker overlay for formality
            }} />
            <div style={{ position: 'relative', padding: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '600', margin: 0, color: '#ffffff', letterSpacing: '-0.025em' }}>
                Selamat Datang, {user?.username}
              </h1>
              <p style={{ margin: '0.5rem 0 0', color: '#e2e8f0', fontSize: '0.95rem', fontWeight: '400' }}>
                Sistem Manajemen Data Upah dan Laporan Operasional
              </p>
            </div>
          </div>

          <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

            {/* FILTER SECTION CARD */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2.5rem',
              border: '1px solid #cbd5e1',
              borderTop: '5px solid #1e3a8a', // Navy Accent
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              marginBottom: '2.5rem',
              position: 'relative'
            }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: '700',
                color: '#1e3a8a',
                marginBottom: '2rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '2px solid #f1f5f9',
                paddingBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>⚙️</span> FILTER PARAMETER
              </h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'flex-start' }}>
                {/* Left Column: Calendar (Fixed Width) */}
                <div style={{ flex: '0 0 320px', minWidth: '280px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.75rem', letterSpacing: '0.025em' }}>
                    PERIODE LAPORAN
                  </label>
                  <MonthSelector
                    month={month}
                    year={year}
                    onChange={(m, y) => { setMonth(m); setYear(y); }}
                  />
                </div>

                {/* Right Column: Division & Gang (Flexible) */}
                <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Division Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem', letterSpacing: '0.025em' }}>
                      DIVISI {isLockedMode && <span style={{ color: '#d97706', fontSize: '0.75rem', marginLeft: '4px' }}>(LOCKED)</span>}
                    </label>
                    <select
                      className="input-field"
                      style={{
                        width: '100%',
                        height: '48px', // Slightly taller for better click area
                        padding: '0 1rem',
                        fontSize: '0.95rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        backgroundColor: isLockedMode ? '#fffbeb' : 'white',
                        cursor: isLockedMode ? 'not-allowed' : 'pointer',
                        color: '#334155',
                        outline: 'none',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      value={division}
                      onChange={e => !isLockedMode && handleDivisionChange(e.target.value)}
                      disabled={isLockedMode}
                      onFocus={(e) => { e.target.style.borderColor = '#1e3a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
                    >
                      <option value="">Pilih Divisi</option>
                      {allDivisions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      {isLockedMode && externalLockedDiv && !allDivisions.includes(externalLockedDiv) && (
                        <option key={externalLockedDiv} value={externalLockedDiv}>{externalLockedDiv}</option>
                      )}
                    </select>
                  </div>

                  {/* Gang Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem', letterSpacing: '0.025em' }}>
                      GANG / KEMANDORAN
                    </label>
                    <select
                      className="input-field"
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '0 1rem',
                        fontSize: '0.95rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: gangLoading ? 'wait' : 'pointer',
                        backgroundColor: gangLoading ? '#f8fafc' : 'white',
                        color: '#334155',
                        outline: 'none',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                      value={gang}
                      onChange={e => setGang(e.target.value)}
                      disabled={gangLoading}
                      onFocus={(e) => { e.target.style.borderColor = '#1e3a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
                    >
                      {gangLoading ? (
                        <option>Memuat data...</option>
                      ) : gangs.length === 0 ? (
                        <option>Menunggu pemilihan divisi...</option>
                      ) : (
                        <>
                          <option value="">Pilih Gang</option>
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

                </div>
              </div>
            </div>

            {/* REPORTS SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

              {/* Primary Report Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '2rem',
                border: '1px solid #cbd5e1',
                borderTop: '5px solid #0ea5e9', // Sky Blue Accent
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#0ea5e9' }}>📋</span> Laporan Operasional
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                    Akses detail upah harian, perhitungan premi, lembur, dan potongan per karyawan. Data ditampilkan dalam format grid interaktif.
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!division || !gang || gangLoading}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: (!division || !gang || gangLoading) ? '#e2e8f0' : '#0ea5e9', // Sky Blue Button
                    color: (!division || !gang || gangLoading) ? '#94a3b8' : 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                    cursor: (!division || !gang || gangLoading) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: (!division || !gang || gangLoading) ? 'none' : '0 4px 6px -1px rgba(14, 165, 233, 0.3)'
                  }}
                >
                  {gangLoading ? 'Memuat Data...' : 'TAMPILKAN DATA UPAH'}
                </button>
              </div>

              {/* Secondary Reports Card */}
              {canAccessReports && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '2rem',
                  border: '1px solid #cbd5e1',
                  borderTop: '5px solid #8b5cf6', // Violet Accent
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  height: '100%',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#8b5cf6' }}>📊</span> Laporan Analisis & Summary
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                    Rekapitulasi total upah, laporan financial wages (Rebinmas & IJL), dan analisis komparatif overtime/premi.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {division && (
                      <button
                        onClick={handleShowSummaryReport}
                        style={{
                          padding: '0.9rem',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#7c3aed'; e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                      >
                        Summary Report (Per Gang)
                        <span style={{ fontSize: '1.2em' }}>›</span>
                      </button>
                    )}

                    <button
                      onClick={handleShowWagesRebinmas}
                      style={{
                        padding: '0.9rem',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      Wages Rebinmas Report
                      <span style={{ fontSize: '1.2em' }}>›</span>
                    </button>

                    <button
                      onClick={handleShowWagesIJL}
                      style={{
                        padding: '0.9rem',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#059669'; e.currentTarget.style.backgroundColor = '#ecfdf5'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      Wages Report (IJL)
                      <span style={{ fontSize: '1.2em' }}>›</span>
                    </button>

                    <button
                      onClick={handleShowAnalysisReport}
                      style={{
                        padding: '0.9rem',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#ea580c'; e.currentTarget.style.backgroundColor = '#fff7ed'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      Analysis OT & Premi
                      <span style={{ fontSize: '1.2em' }}>›</span>
                    </button>

                    <button
                      onClick={handleShowAggregationSeeder}
                      style={{
                        padding: '0.9rem',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.backgroundColor = '#eef2ff'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                    >
                      Aggregation Seeder
                      <span style={{ fontSize: '1.2em' }}>›</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    )
  }

  // -- DASHBOARD SCREEN (Grid View) --
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-body)' }}>

      {/* Top Header Navigation */}
      <div style={{
        height: '50px',
        background: '#ffffff',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        zIndex: 50,
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>

        {/* Brand & Title */}
        <div className="flex-center gap-4">
          <img src="/images/rebinmas.webp" alt="Logo" style={{ height: '32px' }} onError={(e) => e.target.style.display = 'none'} />
          <div style={{ borderLeft: '1px solid var(--neutral-200)', paddingLeft: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary-900)', lineHeight: 1.1 }}>PT REBINMAS JAYA</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--neutral-500)', letterSpacing: '0.05em' }}>
              PAYROLL SYSTEM {isLockedMode && <span style={{ color: '#f59e0b' }}>• 🔒 {division}</span>}
            </div>
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex-center gap-4" style={{ flex: 1, justifyContent: 'center', maxWidth: '1000px', padding: '0 16px' }}>
          <ReportToolbar
            month={month}
            year={year}
            division={division}
            divisions={isLockedMode ? [division] : (allDivisions.length > 0 ? allDivisions : (user?.divisions || []))}
            gangCode={gang}
            gangs={gangs}  // Full gang objects with description
            onMonthYearChange={(m, y) => { setMonth(m); setYear(y); }}
            onDivisionChange={isLockedMode ? () => { } : handleDivisionChange}
            onGangChange={(g) => setGang(g)}
            disableControls={gridLoading || gangLoading}
            divisionLocked={isLockedMode}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Right Actions */}
        <div className="flex-center gap-4">
          {/* Row Count Badge */}
          {isReportGenerated && rowCount > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #1a365d 0%, #2d4a6f 100%)',
              color: '#ffffff',
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              <span>👥</span>
              <span>{rowCount} Karyawan</span>
            </div>
          )}

          {/* Font Size Controls */}
          {isReportGenerated && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#f3f4f6',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Aa</span>
              <button
                onClick={handleFontDecrease}
                disabled={fontSize <= 60}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: fontSize <= 60 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  padding: '2px 6px',
                  color: fontSize <= 60 ? '#9ca3af' : '#374151',
                  fontWeight: '600'
                }}
                title="Perkecil Font"
              >
                −
              </button>
              <button
                onClick={handleFontReset}
                style={{
                  background: fontSize === 100 ? '#1a365d' : '#ffffff',
                  color: fontSize === 100 ? '#ffffff' : '#374151',
                  border: '1px solid #d1d5db',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontWeight: '600',
                  minWidth: '45px'
                }}
                title="Reset ke 100%"
              >
                {fontSize}%
              </button>
              <button
                onClick={handleFontIncrease}
                disabled={fontSize >= 150}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: fontSize >= 150 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  padding: '2px 6px',
                  color: fontSize >= 150 ? '#9ca3af' : '#374151',
                  fontWeight: '600'
                }}
                title="Perbesar Font"
              >
                +
              </button>
            </div>
          )}

          {/* Export to Excel Button */}
          {isReportGenerated && (
            <button
              onClick={handleExportExcel}
              disabled={exportLoading || !exportHandler}
              style={{
                background: exportLoading ? '#6b7280' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                height: '36px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Export ke Excel"
            >
              <span>{exportLoading ? '⏳' : '📊'}</span>
              <span>{exportLoading ? 'Exporting...' : 'Export Excel'}</span>
            </button>
          )}

          <div style={{ textAlign: 'right', display: 'none', '@media (min-width: 768px)': { display: 'block' } }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>{user?.username || 'User'}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--primary-600)' }}>{user?.role || 'Staff'}</div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={logout}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: '36px' }}
            title="Logout"
          >
            🚪
          </button>
        </div>
      </div>

      {/* Main Content - Full Grid with Font Size Control */}
      <div style={{ flex: 1, width: '100%', position: 'relative', overflow: 'auto' }}>
        {division && gang ? (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            <CustomPayrollTable
              token={token}
              month={month}
              year={year}
              division={division}
              gangCode={gang}
              onViewEmployeeDetail={handleViewEmployeeDetail}
              fontSize={fontSize}
              onExportReady={(handler) => setExportHandler(() => handler)}
              refreshTrigger={refreshTrigger}
            />
          </div>
        ) : (
          <div className="flex-center h-full flex-col text-neutral-400">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👆</div>
            <div>Silakan pilih Divisi dan Gang di menu atas untuk menampilkan data</div>
          </div>
        )}

        {/* Loading Overlay for Grid Actions */}
        <LoadingScreen
          isLoading={gridLoading}
          message="Memproses Data..."
          gangCode={gang}
          month={month}
          year={year}
          steps={[
            { name: 'Sinkronisasi Database', duration: 1000 },
            { name: 'Hitung Premi & Potongan', duration: 1500 },
            { name: 'Finalisasi Laporan', duration: 800 }
          ]}
        />
      </div>
    </div>
  )
}