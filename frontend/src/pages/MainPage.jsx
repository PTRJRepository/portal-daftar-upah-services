import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchGangs, fetchDivisions } from '../services/gangService'
import { getLockedGangs } from '../services/lockedDivisionService'
import CustomPayrollTable from '../components/CustomPayrollTable'
import LoadingScreen from '../components/common/LoadingScreen'
import MonthSelector from '../components/common/MonthSelector'
import ReportToolbar from '../components/common/ReportToolbar'
import SummaryReportPage from './SummaryReportPage'
import WagesSummaryRebinmasPage from './WagesSummaryRebinmasPage'
import WagesSummaryIJLPage from './WagesSummaryIJLPage'
import AnalysisReportPage from './AnalysisReportPage'
import { isProdMode, getUserDivision, buildAppPath } from '../utils/prodModeUtils'

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

  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
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
  const [rowCount, setRowCount] = useState(0)
  const [fontSize, setFontSize] = useState(100) // Default 100% font size
  const [exportHandler, setExportHandler] = useState(null) // Export function from CustomPayrollTable
  const [exportLoading, setExportLoading] = useState(false)

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
    // Priority 3: Try first division from API list
    else if (allDivisions.length > 0) {
      initialDivision = allDivisions[0]
    }
    // Priority 4: Fallback to user divisions if API not loaded yet
    else if (user?.divisions?.length > 0) {
      initialDivision = user.divisions[0]
    }
    // Priority 5: Try from user prop (divisi string - single division)
    else if (user?.divisi) {
      initialDivision = user.divisi
    }

    if (initialDivision && !division) {
      setDivision(initialDivision)
    }
  }, [user, inProdMode, prodDivision, externalLockedDiv, allDivisions])

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

  // -- SELECTION SCREEN (Initial View) --
  if (!isReportGenerated) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        background: 'linear-gradient(to bottom, #f0fdf4, #ffffff)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="card" style={{
          width: '100%',
          maxWidth: '480px',
          padding: '2.5rem',
          borderTop: '4px solid var(--primary-500)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img src="/images/rebinmas.webp" alt="PT Rebinmas Jaya" style={{ height: '64px', marginBottom: '1rem' }} />
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary-900)' }}>
              Sistem Daftar Upah
            </h2>
            <div style={{
              backgroundColor: 'var(--primary-50)',
              padding: '0.75rem',
              borderRadius: '6px',
              marginTop: '1rem',
              border: '1px solid var(--primary-200)',
              fontSize: '0.85rem',
              color: 'var(--primary-800)',
              textAlign: 'left'
            }}>
              <strong>💡 Petunjuk:</strong><br />
              Pilih <strong>Periode</strong>, <strong>Divisi</strong>, dan <strong>Gang</strong> di bawah ini untuk memulai. Deskripsi gang diambil dari database HR untuk memudahkan identifikasi.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {/* Periode - Calendar Style */}
            <MonthSelector
              month={month}
              year={year}
              onChange={(m, y) => { setMonth(m); setYear(y); }}
            />

            {/* Division */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="form-label" style={{
                fontWeight: '600',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.1rem' }}>{isLockedMode ? '🔒' : '🏢'}</span>
                Divisi {isLockedMode && <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>(Terkunci)</span>}
              </label>
              <select
                className="input-field"
                style={{
                  height: '48px',
                  fontSize: '1rem',
                  borderColor: isLockedMode ? '#fcd34d' : 'var(--neutral-300)',
                  borderRadius: '8px',
                  cursor: isLockedMode ? 'not-allowed' : 'pointer',
                  backgroundColor: isLockedMode ? '#fef3c7' : undefined
                }}
                value={division}
                onChange={e => !isLockedMode && handleDivisionChange(e.target.value)}
                disabled={isLockedMode}
              >
                <option value="">-- Pilih Divisi --</option>
                {allDivisions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
                {/* Show locked division if not in allDivisions */}
                {isLockedMode && externalLockedDiv && !allDivisions.includes(externalLockedDiv) && (
                  <option key={externalLockedDiv} value={externalLockedDiv}>{externalLockedDiv}</option>
                )}
              </select>
            </div>

            {/* Gang */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="form-label" style={{
                fontWeight: '600',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.1rem' }}>👥</span>
                Gang / Kemandoran
              </label>
              <select
                className="input-field"
                style={{
                  height: '48px',
                  fontSize: '1rem',
                  borderColor: 'var(--neutral-300)',
                  borderRadius: '8px',
                  cursor: gangLoading ? 'not-allowed' : 'pointer',
                  opacity: gangLoading ? 0.7 : 1
                }}
                value={gang}
                onChange={e => setGang(e.target.value)}
                disabled={gangLoading}
              >
                {gangLoading ? (
                  <option>Memuat data gang...</option>
                ) : gangs.length === 0 ? (
                  <option>Pilih divisi terlebih dahulu</option>
                ) : (
                  <>
                    <option value="">-- Pilih Gang --</option>
                    <option value="ALL">-- SEMUA GANG --</option>
                    {gangs.map(g => (
                      <option key={g.gang_code} value={g.gang_code}>
                        {g.gang_code} - {g.description || '(Tidak ada deskripsi)'}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <button
              className="btn btn-primary"
              style={{
                padding: '1rem',
                fontSize: '1.1rem',
                fontWeight: '700',
                borderRadius: '8px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
              onClick={handleGenerate}
              disabled={!division || !gang || gangLoading}
            >
              <span style={{ fontSize: '1.2rem' }}>🚀</span>
              {gangLoading ? 'Memuat Data...' : 'Tampilkan Laporan'}
            </button>

            {/* Summary Report Button - Only visible in DEV_MODE (admin mode) */}
            {DEV_MODE && division && (
              <button
                className="btn btn-secondary"
                style={{
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  borderRadius: '8px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  marginTop: '0.5rem',
                  border: '2px dashed var(--primary-400)',
                  background: 'var(--primary-50)',
                  color: 'var(--primary-700)'
                }}
                onClick={handleShowSummaryReport}
                title="Lihat Summary Report (Grand Total per Gang)"
              >
                <span style={{ fontSize: '1rem' }}>📊</span>
                Generate Summary Report
              </button>
            )}

            {/* Wages Rebinmas Report Button - Only visible in DEV_MODE */}
            {DEV_MODE && (
              <>
                <button
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    borderRadius: '8px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    marginTop: '0.5rem',
                    border: '2px dashed #1a365d',
                    background: '#eef2f7',
                    color: '#1a365d'
                  }}
                  onClick={handleShowWagesRebinmas}
                  title="Lihat Wages Rebinmas Report (Total Premi per Divisi)"
                >
                  <span style={{ fontSize: '1rem' }}>💰</span>
                  Wages Rebinmas Report
                </button>

                {/* Wages IJL Report Button */}
                <button
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    borderRadius: '8px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    marginTop: '0.5rem',
                    border: '2px dashed #065f46',
                    background: '#ecfdf5',
                    color: '#065f46'
                  }}
                  onClick={handleShowWagesIJL}
                  title="Lihat Wages Report - PT. Impian Jaya Lestari"
                >
                  <span style={{ fontSize: '1rem' }}>🌴</span>
                  Wages Report (IJL)
                </button>

                {/* Analysis Report Button */}
                <button
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    borderRadius: '8px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                    marginTop: '0.5rem',
                    border: '2px dashed #7c3aed',
                    background: '#f5f3ff',
                    color: '#7c3aed'
                  }}
                  onClick={handleShowAnalysisReport}
                  title="Lihat Analysis OT & Premi Report"
                >
                  <span style={{ fontSize: '1rem' }}>📈</span>
                  Analysis OT & Premi
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--neutral-500)' }}>
          Logged in as <strong style={{ color: 'var(--neutral-700)' }}>{user?.username}</strong> •
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--danger-700)', cursor: 'pointer', marginLeft: '0.5rem', textDecoration: 'underline' }}>Logout</button>
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