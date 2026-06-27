import axios from 'axios'
import { getBackendBaseUrl } from './apiBase'
import { getExternalLoginUrl, isProdMode } from './prodModeUtils'

const TEST_MODE = (import.meta.env?.VITE_DEV_MODE === 'true') || (import.meta.env?.DEV_MODE === 'true')

const _url = getBackendBaseUrl()
axios.defaults.baseURL = _url

console.log('🔗 HTTP Setup - Backend URL:', _url)
console.log('🌐 Current Frontend Host:', window.location.hostname)

// Enable credentials for all requests (important for cookies)
axios.defaults.withCredentials = true

axios.interceptors.request.use(async (config) => {
  try {
    const start = Date.now()
    config.meta = Object.assign({}, config.meta, { start })
    if (TEST_MODE) {
      const u = (config.baseURL || '') + (config.url || '')
      const m = (config.method || 'get').toUpperCase()
      const p = config.params || {}
      console.log(`[HTTP] -> ${m} ${u}`, { params: p, headers: Object.keys(config.headers || {}) })
    }
  } catch (_) { }
  return config
})

axios.interceptors.response.use(
  (res) => {
    try {
      if (TEST_MODE) {
        const start = res.config?.meta?.start || Date.now()
        const dur = Date.now() - start
        const u = (res.config?.baseURL || '') + (res.config?.url || '')
        const m = (res.config?.method || 'get').toUpperCase()
        console.log(`[HTTP] <- ${m} ${u} ${res.status} ${dur}ms`, { length: Array.isArray(res.data) ? res.data.length : undefined })
      }
    } catch (_) { }
    return res
  },
  async (error) => {
    try {
      const cfg = error.config || {}
      const u = (cfg.baseURL || '') + (cfg.url || '')
      const m = (cfg.method || 'get').toUpperCase()
      const start = cfg.meta?.start || Date.now()
      const dur = Date.now() - start

      const status = error?.response?.status
      console.error(`[HTTP] !! ${m} ${u} ${status || 'ERR'} ${dur}ms`, { message: error.message })

      // Auto-Logout on 401 (Invalid Token) ONLY. 
      // Do NOT logout on 403 (Forbidden permissions)
      // Do NOT logout if request was to /auth/login (just a failed login attempt)
      if (status === 401 && !u.includes('/auth/login')) {
        console.warn('[HTTP] 401 Unauthorized. Clearing session and redirecting to login.')

        // In PROD MODE, we don't clear localStorage as it is managed by the gateway
        // But for safety in this specific app context, we might just redirect.
        // However, the request was: "etia tokennya sudah expired saya inign ke halaman login yang versi proxy"

        // Force Redirect to Proxy Login (Relative Path)
        window.location.href = isProdMode() ? getExternalLoginUrl() : '/login'
      }

    } catch (_) { }
    return Promise.reject(error)
  }
)


