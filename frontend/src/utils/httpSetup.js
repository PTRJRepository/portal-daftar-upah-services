import axios from 'axios'

const TEST_MODE = (import.meta.env?.VITE_DEV_MODE === 'true') || (import.meta.env?.DEV_MODE === 'true')

// Get backend URL based on access mode
const getBackendURL = () => {
  // 1. Explicit VITE_BACKEND_URL from environment
  if (import.meta.env?.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL
  }

  // 1.5. Explicit proxy mode from environment (dev:proxy script)
  if (import.meta.env?.VITE_PROXY_MODE === 'true') {
    console.log('🔀 Explicit proxy mode enabled via VITE_PROXY_MODE, using relative path /backend/upah')
    return '/backend/upah'
  }

  // 2. Check if accessed via proxy gateway (port 3001 or path contains /upah/)
  const isProxyGateway = window.location.port === '3001' || window.location.pathname.startsWith('/upah')

  if (isProxyGateway) {
    // Use relative path that goes through proxy gateway
    // Proxy routes: /backend/upah -> localhost:8002
    console.log('🔀 Proxy gateway detected, using relative path /backend/upah')
    return '/backend/upah'
  }

  // 3. Default: Use relative path
  // This allows requests to go through the configured Proxy (Vite or Nginx)
  // which is safer and avoids CORS/host binding issues.
  // The Vite proxy is configured to forward /auth, /payroll, etc. to the backend.
  console.log('🔗 using relative backend path (via proxy)')
  return ''
}

const _url = getBackendURL()
axios.defaults.baseURL = _url

console.log('🔗 HTTP Setup - Backend URL:', _url)
console.log('🌐 Current Frontend Host:', window.location.hostname)

// Enable credentials for all requests (important for cookies)
axios.defaults.withCredentials = true

axios.interceptors.request.use(async (config) => {
  try {
    const start = Date.now()
    config.meta = Object.assign({}, config.meta, { start })
    const u = (config.baseURL || '') + (config.url || '')
    const m = (config.method || 'get').toUpperCase()
    const p = config.params || {}
    console.log(`[HTTP] -> ${m} ${u}`, { params: p, headers: Object.keys(config.headers || {}) })
  } catch (_) { }
  return config
})

axios.interceptors.response.use(
  (res) => {
    try {
      const start = res.config?.meta?.start || Date.now()
      const dur = Date.now() - start
      const u = (res.config?.baseURL || '') + (res.config?.url || '')
      const m = (res.config?.method || 'get').toUpperCase()
      console.log(`[HTTP] <- ${m} ${u} ${res.status} ${dur}ms`, { length: Array.isArray(res.data) ? res.data.length : undefined })
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
      console.error(`[HTTP] !! ${m} ${u} ${error?.response?.status || 'ERR'} ${dur}ms`, { message: error.message })
    } catch (_) { }
    return Promise.reject(error)
  }
)


