/**
 * Payslip Service - Fetches batch payslip data for multiple employees
 */
import axios from 'axios'

// Base URL changes based on mode
const getBaseUrl = () => {
    const backendHost = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL

    if (backendHost) {
        const host = backendHost.endsWith('/') ? backendHost.slice(0, -1) : backendHost
        return `${host}/payroll/employee`
    }

    return '/payroll/employee'
}

/**
 * Get batch employee checkroll data for payslip printing
 * @param {string} token - JWT token
 * @param {string[]} empCodes - Array of employee codes
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Batch checkroll data
 */
export async function getBatchEmployeeCheckroll(token, empCodes, month, year) {
    try {
        if (!empCodes || empCodes.length === 0) {
            throw new Error('No employee codes provided')
        }

        const params = {
            emp_codes: empCodes.join(','),
            month,
            year
        }

        const baseUrl = getBaseUrl()
        console.log(`[PayslipService] Fetching batch checkroll for ${empCodes.length} employees`)

        const response = await axios.get(`${baseUrl}/batch-checkroll`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        })

        return response.data
    } catch (error) {
        console.error('[PayslipService] Failed to get batch checkroll:', error)
        throw error
    }
}

/**
 * Get single employee checkroll (wrapper for consistency)
 * @param {string} token - JWT token
 * @param {string} empCode - Employee code
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @returns {Promise<Object>} Checkroll data
 */
export async function getEmployeeCheckroll(token, empCode, month, year) {
    try {
        const params = { month, year }

        const baseUrl = getBaseUrl()
        const response = await axios.get(`${baseUrl}/${empCode}/checkroll`, {
            headers: { Authorization: `Bearer ${token}` },
            params
        })

        return response.data
    } catch (error) {
        console.error('[PayslipService] Failed to get employee checkroll:', error)
        throw error
    }
}
