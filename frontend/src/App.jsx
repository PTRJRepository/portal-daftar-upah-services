import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import MainPage from './pages/MainPage'
import LockedMainPage from './pages/LockedMainPage'
import LoginPage from './pages/LoginPage'
import EmployeeDetailRoute from './pages/EmployeeDetailRoute'
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

  // Check backend connection on mount
  useEffect(() => {
    ; (async () => {
      try {
        await axios.get('/dev-mode', { timeout: 5000 })
      } catch (e) {
        console.warn('Backend connection check failed:', e)
      }
    })()
  }, [])

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
    // In prod mode, we've already redirected to external login
    // Show a loading screen while redirecting
    if (inProdMode) {
      return <LoadingScreen isLoading={true} message="Mengalihkan ke halaman login..." />
    }
    // Dev mode: show internal login page
    return <LoginPage />
  }

  // Check for specific routes (after authentication)
  // Normalize pathname by removing /upah prefix for consistent route matching
  const rawPathname = window.location.pathname
  const pathname = rawPathname.startsWith('/upah') ? rawPathname.replace('/upah', '') : rawPathname

  // Handle employee detail route
  if (pathname.startsWith('/employee/detail')) {
    return <EmployeeDetailRoute />
  }

  // Admin users: ALWAYS use MainPage (not locked) even in prod mode
  if (isAdminUser) {
    console.log('[App] Admin user: Rendering MainPage with full access')
    return <MainPage />
  }

  // Production mode OR authenticated with locked division
  // In prod mode, ALWAYS use LockedMainPage regardless of lockedDiv value
  if (inProdMode || lockedDiv) {
    const divToUse = lockedDiv || getUserDivision() || ''
    console.log(`[App] Rendering LockedMainPage with division: ${divToUse} (Prod Mode: ${inProdMode})`)
    return <LockedMainPage lockedDiv={divToUse} />
  }

  // Dev mode: Normal authenticated user with no locked division
  return <MainPage />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

