/**
 * Dashboard Service
 * Fetches dashboard and analytics data from /payroll/dashboard endpoints
 */

import axios from 'axios';

const getBackendBase = () => {
    return ''; // Uses Vite Proxy/Nginx
};
const BACKEND_BASE = getBackendBase();

/**
 * Fetch gang comparison data (includes production/tonase)
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @param {string} [params.division_code] - Optional division filter
 * @returns {Promise<Object>} Gang comparison data
 */
export async function fetchGangComparison(token, { month, year, division_code }) {
    const params = new URLSearchParams();
    params.append('month', month.toString());
    params.append('year', year.toString());
    if (division_code) params.append('division_code', division_code);

    const url = `${BACKEND_BASE}/payroll/dashboard/gang-comparison?${params.toString()}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch detailed division data (employee list + breakdowns)
 * @param {string} token - Auth token
 * @param {Object} params - Query parameters
 * @param {number} params.month - Month (1-12)
 * @param {number} params.year - Year
 * @param {string} params.division_code - Division code
 * @returns {Promise<Object>} Division detail data
 */
export async function fetchDivisionDetailData(token, { month, year, division_code }) {
    const params = new URLSearchParams();
    params.append('month', month.toString());
    params.append('year', year.toString());
    params.append('division_code', division_code);

    const url = `${BACKEND_BASE}/payroll/dashboard/division-detail-data?${params.toString()}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

/**
 * Fetch available filter options
 * @param {string} token - Auth token
 * @param {number} month - Month
 * @param {number} year - Year
 * @returns {Promise<Object>} Filter options
 */
export async function fetchFilterOptions(token, month, year) {
    const url = `${BACKEND_BASE}/payroll/dashboard/filter-options?month=${month}&year=${year}`;

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
}

export default {
    fetchGangComparison,
    fetchDivisionDetailData,
    fetchFilterOptions
};
