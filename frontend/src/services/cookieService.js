// Cookie Service untuk menyimpan informasi login dan session
import Cookies from 'js-cookie'

const TOKEN_KEY = 'payroll_auth_token'
const USER_KEY = 'payroll_user_info'
const REMEMBER_KEY = 'payroll_remember_me'

// Cookie options
const COOKIE_OPTIONS = {
  expires: 30, // 30 hari default
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
}

export const cookieService = {
  // Save authentication token
  saveToken: (token, rememberMe = false) => {
    try {
      const options = { ...COOKIE_OPTIONS }
      if (rememberMe) {
        options.expires = 30 // 30 hari jika remember me
      } else {
        options.expires = 7 // 7 hari default (dari 1 hari)
      }
      Cookies.set(TOKEN_KEY, token, options)
      localStorage.setItem(REMEMBER_KEY, rememberMe)
      console.log('[CookieService] Token saved successfully with', options.expires, 'days expiration')
    } catch (error) {
      console.error('[CookieService] Failed to save token:', error)
    }
  },

  // Get authentication token
  getToken: () => {
    try {
      return Cookies.get(TOKEN_KEY)
    } catch (error) {
      console.error('[CookieService] Failed to get token:', error)
      return null
    }
  },

  // Save user information
  saveUser: (user) => {
    try {
      const userJson = JSON.stringify(user)
      Cookies.set(USER_KEY, userJson, COOKIE_OPTIONS)
      console.log('[CookieService] User info saved successfully:', { username: user.username, divisions: user.divisions?.length })
    } catch (error) {
      console.error('[CookieService] Failed to save user:', error)
    }
  },

  // Get user information
  getUser: () => {
    try {
      const userJson = Cookies.get(USER_KEY)
      return userJson ? JSON.parse(userJson) : null
    } catch (error) {
      console.error('[CookieService] Failed to get user:', error)
      return null
    }
  },

  // Save remember me preference
  saveRememberMe: (rememberMe) => {
    try {
      localStorage.setItem(REMEMBER_KEY, rememberMe)
      if (!rememberMe) {
        // Jika tidak remember me, hapus token yang ada
        cookieService.clearToken()
        cookieService.clearUser()
      }
    } catch (error) {
      console.error('[CookieService] Failed to save remember me:', error)
    }
  },

  // Get remember me preference
  getRememberMe: () => {
    try {
      return localStorage.getItem(REMEMBER_KEY) === 'true'
    } catch (error) {
      console.error('[CookieService] Failed to get remember me:', error)
      return false
    }
  },

  // Clear all authentication data
  clearAuth: () => {
    try {
      Cookies.remove(TOKEN_KEY, { path: '/' })
      Cookies.remove(USER_KEY, { path: '/' })
      localStorage.removeItem(REMEMBER_KEY)
      console.log('[CookieService] Authentication data cleared')
    } catch (error) {
      console.error('[CookieService] Failed to clear auth data:', error)
    }
  },

  // Clear token only
  clearToken: () => {
    try {
      Cookies.remove(TOKEN_KEY, { path: '/' })
    } catch (error) {
      console.error('[CookieService] Failed to clear token:', error)
    }
  },

  // Clear user info only
  clearUser: () => {
    try {
      Cookies.remove(USER_KEY, { path: '/' })
    } catch (error) {
      console.error('[CookieService] Failed to clear user:', error)
    }
  },

  // Check if user is logged in
  isLoggedIn: () => {
    const token = cookieService.getToken()
    const user = cookieService.getUser()
    return !!(token && user)
  },

  // Get authentication header
  getAuthHeader: () => {
    const token = cookieService.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },

  // ========== External Token Functions ==========
  // For tokens from external systems (e.g., gateway auth) stored in localStorage

  // External token key (from gateway/dashboard system)
  EXTERNAL_TOKEN_KEY: 'auth-token',

  // Get external token from localStorage (cross-origin shared token)
  getExternalToken: () => {
    try {
      return localStorage.getItem('auth-token')
    } catch (error) {
      console.error('[CookieService] Failed to get external token:', error)
      return null
    }
  },

  // Check if external token exists
  hasExternalToken: () => {
    try {
      const token = localStorage.getItem('auth-token')
      return !!(token && token.length > 0)
    } catch (error) {
      console.error('[CookieService] Failed to check external token:', error)
      return false
    }
  },

  // Get external user from localStorage
  getExternalUser: () => {
    try {
      const userJson = localStorage.getItem('user')
      return userJson ? JSON.parse(userJson) : null
    } catch (error) {
      console.error('[CookieService] Failed to get external user:', error)
      return null
    }
  },

  // Get authentication header for external token
  getExternalAuthHeader: () => {
    try {
      const token = localStorage.getItem('auth-token')
      return token ? { Authorization: `Bearer ${token}` } : {}
    } catch (error) {
      console.error('[CookieService] Failed to get external auth header:', error)
      return {}
    }
  }
}

export default cookieService