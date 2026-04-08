/**
 * Dashboard Service
 * Fetches dashboard and analytics data from /payroll/dashboard endpoints
 * Standardized to use axios with relative paths for production proxy support.
 */

import axios from 'axios';

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
    const params = {};
    params.month = month.toString();
    params.year = year.toString();
    if (division_code) params.division_code = division_code;

    const response = await axios.get('payroll/dashboard/gang-comparison', {
        params,
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
    const params = {};
    params.month = month.toString();
    params.year = year.toString();
    params.division_code = division_code;

    const response = await axios.get('payroll/dashboard/division-detail-data', {
        params,
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
    const response = await axios.get('payroll/dashboard/filter-options', {
        params: { month, year },
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
