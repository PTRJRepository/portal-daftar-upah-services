/**
 * Employee Detail Service - Fetches checkroll data for individual employees
 */
import axios from 'axios'
import { isProdMode } from '../utils/prodModeUtils'

// Base URL changes based on mode - use locked endpoint for proxy/prod mode (RS256 auth)
const getBaseUrl = () => {
    // Check for explicit backend URL in environment variables
    const backendHost = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL

    if (backendHost) {
        // Remove trailing slash if present
        const host = backendHost.endsWith('/') ? backendHost.slice(0, -1) : backendHost
        return `${host}/payroll/employee`
    }

    // Default: Bun backend uses standard routes relative to current origin
    return '/payroll/employee'
}

/**
 * Get employee checkroll detail with attendance and overtime matrices
 * @param {string} token - JWT token
 * @param {string} empCode - Employee code
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {string} division - Division code (optional)
 * @returns {Promise<Object>} Checkroll data with attendance and overtime matrices
 * 
 *
 * 
 * 
 */



export async function getEmployeeCheckroll(token, empCode, month, year, division = null) {
    try {
        const params = { month, year }
        if (division) {
            params.div = division
        }

        const baseUrl = getBaseUrl()
        console.log(`[EmployeeDetailService] Using endpoint: ${baseUrl}/${empCode}/checkroll`)

        const response = await axios.get(`${baseUrl}/${empCode}/checkroll`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        })
        return response.data
    } catch (error) {
        console.error('[EmployeeDetailService] Failed to get employee checkroll:', error)
        throw error
    }
}

/**
 * Get employee component breakdown with metadata
 * Uses the new unified component-based architecture
 * @param {string} token - JWT token
 * @param {string} empCode - Employee code
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {string} division - Division code (optional)
 * @returns {Promise<Object>} Component data with metadata for each payroll component
 */
export async function getEmployeeComponents(token, empCode, month, year, division = null) {
    try {
        const params = { month, year }
        if (division) {
            params.division = division
        }

        const baseUrl = getBaseUrl()
        console.log(`[EmployeeDetailService] Using endpoint: ${baseUrl}/${empCode}/components`)

        const response = await axios.get(`${baseUrl}/${empCode}/components`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        })
        return response.data
    } catch (error) {
        console.error('[EmployeeDetailService] Failed to get employee components:', error)
        throw error
    }
}
