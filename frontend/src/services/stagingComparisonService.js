import axios from 'axios';
import { buildBackendUrl } from '../utils/apiBase';

const get = async (path, params = {}, token) => {
  const url = buildBackendUrl(path);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(url, { params, headers });
  if (res.data?.success === false) throw new Error(res.data.error || 'Request failed');
  return res.data?.data;
};

export const fetchAttendanceCompare = (token, { date, limit = 50, gang, division }) =>
  get('/api/staging/compare/attendance', { date, limit, gang, division }, token);

export const fetchOvertimeCompare = (token, { date, limit = 50, gang, division }) =>
  get('/api/staging/compare/overtime', { date, limit, gang, division }, token);

export const fetchLoosefruitCompare = (token, { date, limit = 50, gang, division }) =>
  get('/api/staging/compare/loosefruit', { date, limit, gang, division }, token);

export const fetchDailyAttendance = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-attendance', { month, year, top }, token);

export const fetchDailyOvertime = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-overtime', { month, year, top }, token);

export const fetchDailyLoosefruit = (token, { month, year, top = 31 }) =>
  get('/api/staging/compare/daily-loosefruit', { month, year, top }, token);

export const fetchLoosefruitAnomalies = (token, { limit = 100 } = {}) =>
  get('/api/staging/compare/loosefruit-anomaly', { limit }, token);
