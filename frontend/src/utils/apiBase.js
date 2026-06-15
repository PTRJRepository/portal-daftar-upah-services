const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const readEnv = (env, ...keys) => {
  for (const key of keys) {
    const value = env?.[key];
    if (value && String(value).trim()) return trimTrailingSlash(value);
  }
  return '';
};

const isUpahPath = (pathname = '') => pathname === '/upah' || String(pathname || '').startsWith('/upah/');

export function resolveBackendBaseUrl({ env = import.meta.env, location = typeof window === 'undefined' ? null : window.location } = {}) {
  const explicit = readEnv(env, 'VITE_BACKEND_URL', 'VITE_API_URL', 'VITE_API_BASE_URL', 'VITE_BACKEND_BASE');
  if (explicit) return explicit;

  const isProxyMode = env?.VITE_PROXY_MODE === 'true';
  const isProxyPath = isUpahPath(location?.pathname || '');
  const isProxyPort = String(location?.port || '') === '3001';

  if (isProxyMode || isProxyPath || isProxyPort) {
    return '/backend/upah';
  }

  return '';
}

export function getBackendBaseUrl() {
  return resolveBackendBaseUrl();
}

export function buildBackendUrl(path = '') {
  const base = getBackendBaseUrl();
  const rawPath = String(path || '');
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}