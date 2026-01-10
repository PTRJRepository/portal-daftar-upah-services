/**
 * Summary Report Service
 * Fetches aggregation data from /payroll/summary endpoints
 */

import axios from 'axios';

// Use relative path to leverage Vite Proxy (or httpSetup default)
const getBackendBase = () => {
    // Return empty string to allow axios to use relative path (e.g. /payroll/...)
    // This allows the request to go through the Vite Proxy (in dev) or Nginx (in prod)
    // which handles the redirection to the correct backend port (8002).
    return ''
}
const BACKEND_BASE = getBackendBase();

/**
 * Fetch summary data for a division
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {string} [params.division] - Division code filter
 * @param {number} [params.month] - Month filter (1-12)
 * @param {number} [params.year] - Year filter
 * @returns {Promise<Object>} Summary data response
 */
export async function fetchDivisionSummary(token, { division, month, year }) {
    const params = new URLSearchParams();

    if (division) params.append('division', division);
    if (month) params.append('month', month.toString());
    if (year) params.append('year', year.toString());

    const url = `${BACKEND_BASE}/payroll/summary/division?${params.toString()}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch available periods
 * @param {string} token - Auth token
 * @param {string} [division] - Optional division filter
 * @returns {Promise<Object>} Periods data
 */
export async function fetchAvailablePeriods(token, division = null) {
    const params = division ? `?division=${division}` : '';
    const url = `${BACKEND_BASE}/payroll/summary/periods${params}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch divisions with available data
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Divisions data
 */
export async function fetchDivisionsWithData(token) {
    const url = `${BACKEND_BASE}/payroll/summary/divisions`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Health check for summary service
 * @param {string} token - Auth token
 * @returns {Promise<Object>} Health status
 */
export async function checkSummaryHealth(token) {
    const url = `${BACKEND_BASE}/payroll/summary/health`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch gangs for a specific LocCode (division) with descriptions
 * @param {string} token - Auth token
 * @param {string} locCode - LocCode/Division to fetch gangs for
 * @returns {Promise<Object>} Gangs data with descriptions
 */
export async function fetchGangsByLocCode(token, locCode) {
    const url = `${BACKEND_BASE}/payroll/summary/gangs/${encodeURIComponent(locCode)}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch aggregated premi totals for all divisions for a specific period
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @returns {Promise<Object>} All divisions summary data
 */
export async function fetchAllDivisionsTotals(token, { month, year }) {
    const url = `${BACKEND_BASE}/payroll/summary/all-divisions?month=${month}&year=${year}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch comparison summary data (Current vs Previous Month)
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @returns {Promise<Object>} Comparison data
 */
export async function fetchComparisonSummary(token, { month, year }) {
    const url = `${BACKEND_BASE}/payroll/summary/comparison?month=${month}&year=${year}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch Impact Report data (3-table structure with HK analysis)
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @returns {Promise<Object>} Impact Report data
 */
export async function fetchImpactReport(token, { month, year }) {
    const url = `${BACKEND_BASE}/payroll/summary/impact-report?month=${month}&year=${year}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

export default {
    fetchDivisionSummary,
    fetchAvailablePeriods,
    fetchDivisionsWithData,
    checkSummaryHealth,
    fetchGangsByLocCode,
    fetchAllDivisionsTotals,
    fetchComparisonSummary,
    fetchImpactReport,
    fetchAnalysisReport
};

/**
 * Fetch Analysis Report data (Premi & OT, Progressive Pruning)
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @returns {Promise<Object>} Analysis Report data
 */
export async function fetchAnalysisReport(token, { month, year, type = 'all' }) {
    const url = `${BACKEND_BASE}/payroll/summary/analysis-report?month=${month}&year=${year}&type=${type}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

