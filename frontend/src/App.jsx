import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import axios from 'axios'
// Lazy load pages for better startup performance
const MainPage = lazy(() => import('./pages/MainPage'))
const LockedMainPage = lazy(() => import('./pages/LockedMainPage'))
const EmployeeDetailRoute = lazy(() => import('./pages/EmployeeDetailRoute'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const HighEarnerReportPage = lazy(() => import('./pages/HighEarnerReportPage'))

import { AuthProvider, useAuth } from './context/AuthContext'
import LoadingScreen from './components/common/LoadingScreen'
import { isProdMode, getUserDivision, redirectToExternalLogin } from './utils/prodModeUtils'

/**
 * Get URL parameters from current location
 */
function useUrlParams() {
  const [params, setParams] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)
    return {
      div: urlParams.get('div'),
      // Add more params here if needed
    }
  })

  useEffect(() => {
    // Listen for URL changes (for SPA navigation)
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search)
      setParams({
        div: urlParams.get('div'),
      })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return params
}

function AppInner() {
  const { isAuthenticated, loading, isExternalAuth, lockedDivision, user } = useAuth()
  const urlParams = useUrlParams()
  const inProdMode = isProdMode()

  // Check if user is admin (admin users are not locked to a division)
  // Admin = role is ADMIN or divisi is ALL
  const isAdminUser = user?.isAdmin === true ||
    (user?.role && user.role.toUpperCase() === 'ADMIN') ||
    (user?.divisi && user.divisi.toUpperCase() === 'ALL')

  // Determine if division should be locked
  // Priority: Prod Mode localStorage > URL param > token division claim
  // Admin users are NEVER locked to a single division
  const lockedDiv = useMemo(() => {
    // Admin users are never locked
    if (isAdminUser) {
      console.log('[App] Admin user detected, no locked division')
      return null
    }

    // In production mode, ALWAYS use division from localStorage
    if (inProdMode) {
      const prodDivision = getUserDivision()
      console.log(`[App] Prod mode: division from localStorage = ${prodDivision}`)
      return prodDivision || lockedDivision || urlParams.div || null
    }
    // Dev mode: URL param > token claim
    return urlParams.div || lockedDivision || null
  }, [inProdMode, urlParams.div, lockedDivision, isAdminUser])

  // REMOVED: Backend connection check to speed up initial load
  // Connection issues will be caught by individual API calls

  // URL Path Management - Different behavior for prod mode
  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname

      if (!isAuthenticated) {
        // ALWAYS Redirect to external login (relative path on same origin)
        // We no longer use the internal LoginPage.jsx
        console.log('[App] Not authenticated, redirecting to external login')

        // Prevent infinite loop if we are already at the root /login
        // Note: In prod (/upah base), currentPath will be /upah/..., so this check passes and we redirect.
        if (currentPath !== '/login') {
          redirectToExternalLogin()
        }
      } else {
        if (currentPath === '/login') {
          // Redirect to / if authenticated but on login page
          window.history.replaceState(null, '', '/' + window.location.search)
        }
      }
    }
  }, [isAuthenticated, loading, inProdMode])

  // Show loading while checking authentication
  if (loading) {
    return <LoadingScreen isLoading={true} message="Menyiapkan sistem..." />
  }

  // Not authenticated
  if (!isAuthenticated) {
    // If we are explicitly at the login page, render it!
    const isLoginPath = window.location.pathname === '/login' || window.location.pathname === '/upah/login'

    if (isLoginPath) {
      return (
        <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat halaman login..." />}>
          <LoginPage />
        </Suspense>
      )
    }

    // Show loading while redirecting
    return <LoadingScreen isLoading={true} message="Mengalihkan ke halaman login..." />
  }

  // Check for specific routes (after authentication)
  // Normalize pathname by removing /upah prefix for consistent route matching
  const rawPathname = window.location.pathname
  // Handle employee detail route
  const isEmployeeDetail = rawPathname.includes('/employee/detail')

  if (isEmployeeDetail) {
    return (
      <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat detail karyawan..." />}>
        <EmployeeDetailRoute />
      </Suspense>
    )
  }

  // Handle high earners report route
  const isHighEarnersReport = rawPathname.includes('/report/high-earners')

  if (isHighEarnersReport) {
    return (
      <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat laporan..." />}>
        <HighEarnerReportPage />
      </Suspense>
    )
  }

  // Decide which MainPage to render
  let MainContent
  if (isAdminUser) {
    // Admin users: ALWAYS use MainPage (not locked) even in prod mode
    console.log('[App] Rendering MainPage for Admin')
    MainContent = <MainPage />
  } else if (inProdMode || lockedDiv) {
    // Production mode OR authenticated with locked division
    const divToUse = lockedDiv || getUserDivision() || ''
    console.log(`[App] Rendering LockedMainPage with division: ${divToUse}`)
    MainContent = <LockedMainPage lockedDiv={divToUse} />
  } else {
    // Dev mode: Normal authenticated user with no locked division
    MainContent = <MainPage />
  }

  return (
    <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat modul dashboard..." />}>
      {MainContent}
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

