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
    console.log(`🌐 Network mode detected, using IP: ${localIP}`)
    return `http://${localIP}:${customPort}`
  }

  // For development, use localhost
  if (isDev) {
    return `http://localhost:${customPort}`
  }

  // Default to localhost with current backend port
  return `http://localhost:${customPort}`
}

const backendTarget = getBackendHost()

// Check if running in external/proxy mode (accessed via proxy gateway)
const isProxyMode = process.env.VITE_BACKEND_HOST && process.env.VITE_BACKEND_HOST !== 'localhost'

console.log('Proxy configuration:', {
  isDev,
  backendTarget,
  isProxyMode,
  envVars: {
    VITE_BACKEND_HOST: process.env.VITE_BACKEND_HOST,
    BACKEND_HOST: process.env.BACKEND_HOST,
    VITE_BACKEND_PORT: process.env.VITE_BACKEND_PORT,
    BACKEND_PORT: process.env.BACKEND_PORT,
    DEV_MODE: process.env.DEV_MODE,
    VITE_DEV_MODE: process.env.VITE_DEV_MODE
  }
})

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  define: {
    // Force disable cache for development
    'process.env.VITE_DISABLE_CACHE': JSON.stringify('true'),
    'process.env.VITE_DEV_MODE': JSON.stringify('true')
  },
  // Base path: /upah/ for production build (proxy mode), / for development
  base: process.env.NODE_ENV === 'production' ? '/upah/' : '/',
  server: {
    host: '0.0.0.0', // Allow access from any IP
    port: 5175,
    strictPort: true,
    cors: true, // Enable CORS for all origins
    // HMR configuration for proxy gateway access
    // When accessed via proxy (port 3001), WebSocket cannot be forwarded properly
    // So we disable HMR in proxy mode - user needs to manually refresh browser
    hmr: isProxyMode ? false : true,
    headers: {
      // Disable browser caching for development
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Enable CORS headers for external access
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    proxy: {
      '/auth': {
        target: backendTarget,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/employees': {
        target: backendTarget,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
      '/payroll': {
        target: backendTarget,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      },
      '/reports': {
        target: backendTarget,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      }
    }
  }
})