// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildBackendUrl, resolveBackendBaseUrl } from './apiBase';

describe('apiBase', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_BACKEND_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('VITE_BACKEND_BASE', '');
    vi.stubEnv('VITE_PROXY_MODE', '');
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
  });

  it('uses relative backend paths for normal local access', () => {
    expect(resolveBackendBaseUrl({ env: {}, location: { pathname: '/', port: '5175' } })).toBe('');
    expect(buildBackendUrl('/payroll/report')).toBe('/payroll/report');
  });

  it('routes /upah app paths through the proxy backend prefix', () => {
    expect(resolveBackendBaseUrl({ env: {}, location: { pathname: '/upah/operational', port: '' } })).toBe('/backend/upah');
  });

  it('routes gateway port 3001 through the proxy backend prefix', () => {
    expect(resolveBackendBaseUrl({ env: {}, location: { pathname: '/', port: '3001' } })).toBe('/backend/upah');
  });

  it('routes explicit proxy mode through the proxy backend prefix', () => {
    expect(resolveBackendBaseUrl({ env: { VITE_PROXY_MODE: 'true' }, location: { pathname: '/', port: '5175' } })).toBe('/backend/upah');
  });

  it('prefers explicit backend URL envs and trims trailing slashes', () => {
    expect(resolveBackendBaseUrl({ env: { VITE_BACKEND_URL: 'http://10.0.0.5:8002/' }, location: { pathname: '/upah', port: '' } })).toBe('http://10.0.0.5:8002');
  });
});