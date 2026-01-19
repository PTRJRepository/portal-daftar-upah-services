import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isDev = process.env.DEV_MODE === 'true' || process.env.VITE_DEV_MODE === 'true'

// Auto-detect local IP address for network access
const getLocalIP = () => {
  try {
    const { networkInterfaces } = require('os')
    const nets = networkInterfaces()

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip internal and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          // Prefer 10.0.0.x range (your main network)
          if (net.address.startsWith('10.0.0.')) {
            return net.address
          }
        }
      }
    }

    // Fallback to any non-internal IPv4 address
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address
        }
      }
    }

    return 'localhost'
  } catch (e) {
    return 'localhost'
  }
}

// Get backend host from environment variables or use default
const getBackendHost = () => {
  // Check for custom backend host in environment variables
  const customHost = process.env.VITE_BACKEND_HOST || process.env.BACKEND_HOST
  const customPort = process.env.VITE_BACKEND_PORT || process.env.BACKEND_PORT || '8002'

  if (customHost && customHost !== 'localhost') {
    return `http://${customHost}:${customPort}`
  }

  // Check if we're running in network mode (host is 0.0.0.0)
  const isNetworkMode = process.env.npm_config_host === '0.0.0.0' ||
    process.env.HOST === '0.0.0.0' ||
    process.argv.includes('--host') ||
    process.env.NODE_ENV === 'network'

  if (isNetworkMode) {
    const localIP = getLocalIP()
    console.log(`🌐 Network mode detected in test config, using IP: ${localIP}`)
    return `http://${localIP}:${customPort}`
  }

  // Check if VITE_BACKEND_URL is provided
  if (process.env.VITE_BACKEND_URL) {
    return process.env.VITE_BACKEND_URL
  }

  // For development, use localhost
  if (isDev) {
    return `http://localhost:${customPort}`
  }

  // Default to localhost with current backend port
  return `http://localhost:${customPort}`
}

const backendUrl = getBackendHost()

console.log('Test Config Proxy:', {
  isDev,
  backendUrl,
  envVars: {
    VITE_BACKEND_HOST: process.env.VITE_BACKEND_HOST,
    BACKEND_HOST: process.env.BACKEND_HOST,
    VITE_BACKEND_PORT: process.env.VITE_BACKEND_PORT,
    BACKEND_PORT: process.env.BACKEND_PORT,
    VITE_BACKEND_URL: process.env.VITE_BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,
    DEV_MODE: process.env.DEV_MODE,
    VITE_DEV_MODE: process.env.VITE_DEV_MODE
  }
})

// Gunakan port 5175 sesuai dengan kebutuhan Anda
export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5175,  // Ganti ke port 5175 agar sesuai dengan URL Anda
    strictPort: false, // Allow other ports if 5175 is occupied
    // Always enable proxy for backend routes
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
      '/auth': { target: backendUrl, changeOrigin: true },
      '/employees': { target: backendUrl, changeOrigin: true },
      '/payroll': { target: backendUrl, changeOrigin: true },
      '/reports': { target: backendUrl, changeOrigin: true },
      '/health': { target: backendUrl, changeOrigin: true }
    }
  }
})