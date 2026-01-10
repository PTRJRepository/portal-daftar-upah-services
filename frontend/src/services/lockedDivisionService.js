/**
 * Locked Division Service
 * Services for division-locked payroll endpoints using external JWT tokens
 */
import axios from 'axios'

const BASE_URL = '/payroll/locked'

/**
 * Verify external token and get user claims
 * @param {string} token - External JWT token
 * @returns {Promise<object|null>} User claims if valid, null if invalid
 */
export async function verifyExternalToken(token) {
    try {
        const response = await axios.get(`${BASE_URL}/verify`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        return response.data
    } catch (error) {
        console.error('[LockedDivisionService] Token verification failed:', error)
        return null
    }
}

/**
 * Get locked division info
 * @param {string} token - JWT token
 * @param {string} div - Locked division code
 */
export async function getLockedInfo(token, div) {
    try {
        const response = await axios.get(`${BASE_URL}/info`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { div }
        })
        return response.data
    } catch (error) {
        console.error('[LockedDivisionService] Failed to get locked info:', error)
        throw error
    }
}

/**
 * Get gangs for locked division
 * @param {string} token - JWT token  
 * @param {string} div - Locked division code
 * @param {string} search - Optional search filter
 */
export async function getLockedGangs(token, div, search = null) {
    try {
        const params = { div }
        if (search) params.search = search

        const response = await axios.get(`${BASE_URL}/gangs`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        })
        return response.data
    } catch (error) {
        console.error('[LockedDivisionService] Failed to get locked gangs:', error)
        throw error
    }
}

/**
 * Get payroll report for locked division
 * @param {string} token - JWT token
 * @param {string} div - Locked division code
 * @param {string} gangCode - Gang code (or 'ALL')
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {number} skip - Pagination skip
 * @param {number} limit - Pagination limit
 */
export async function getLockedReport(token, div, gangCode, month, year, skip = 0, limit = 500) {
    try {
        const params = {
            div,
            month,
            year,
            skip,
            limit
        }
        if (gangCode && gangCode !== 'ALL') {
            params.gang_code = gangCode
        }

        const response = await axios.get(`${BASE_URL}/report`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        })
        return response.data
    } catch (error) {
        console.error('[LockedDivisionService] Failed to get locked report:', error)
        throw error
    }
}

/**
 * Get raw tree data for locked division
 * @param {string} token - JWT token
 * @param {string} div - Locked division code
 * @param {number} month - Month
 * @param {number} year - Year
 */
export async function getLockedRawTree(token, div, month, year) {
    try {
        const response = await axios.get(`${BASE_URL}/report/raw-tree`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { div, month, year }
        })
        return response.data
    } catch (error) {
        console.error('[LockedDivisionService] Failed to get locked raw tree:', error)
        throw error
    }
}

export default {
    verifyExternalToken,
    getLockedInfo,
    getLockedGangs,
    getLockedReport,
    getLockedRawTree
}
