import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import axios from 'axios'
// Lazy load pages for better startup performance
const MainPage = lazy(() => import('./pages/MainPage'))
const LockedMainPage = lazy(() => import('./pages/LockedMainPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const EmployeeDetailRoute = lazy(() => import('./pages/EmployeeDetailRoute'))

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
        // In Prod Mode: Redirect to external login (relative path on same origin)
        if (inProdMode) {
          console.log('[App] Prod mode: Not authenticated, redirecting to external login')
          // Use relative path /login which will be handled by the proxy gateway
          if (!currentPath.includes('/login')) {
            redirectToExternalLogin()
          }
          return
        }

        // Dev mode: Show internal login page
        if (currentPath !== '/login') {
          window.history.replaceState(null, '', '/login' + window.location.search)
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
    // Show login page
    // In prod mode, the useEffect above handles redirection if not at /login
    // If we receive no token and are at /login, we render the login UI
    return (
      <Suspense fallback={<LoadingScreen isLoading={true} message="Memuat halaman login..." />}>
        <LoginPage />
      </Suspense>
    )
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

