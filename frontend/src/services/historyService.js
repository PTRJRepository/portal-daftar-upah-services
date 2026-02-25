/**
 * History Service
 * Service functions for payroll history management
 * Supports both direct backend access and proxy mode
 */

// Detect if we're in proxy mode (accessed via proxy gateway)
const isProxyMode = import.meta.env.VITE_PROXY_MODE === 'true' ||
    import.meta.env.NODE_ENV === 'production' ||
    (import.meta.env.VITE_BACKEND_HOST && import.meta.env.VITE_BACKEND_HOST !== 'localhost');

// Use relative URLs in proxy mode, absolute URLs in direct mode
const getBackendUrl = () => {
    if (isProxyMode) {
        return ''; // Empty string means use relative URLs
    } else {
        return import.meta.env.VITE_BACKEND_BASE || 'http://localhost:8002';
    }
};

/**
 * Check health of history database connection
 * @param {string} token - Auth token
 */
export async function checkHistoryHealth(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/health`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to check history health: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Seed payroll history data for a specific period and division
 * @param {string} token - Auth token
 * @param {number} periodMonth - Month (1-12)
 * @param {number} periodYear - Year (e.g., 2026)
 * @param {string} divisionCode - Division code (optional)
 * @param {string} gangCode - Gang code (optional)
 * @param {boolean} force - Force seeding even if data exists
 */
export async function seedPayrollHistory(token, periodMonth, periodYear, divisionCode = null, gangCode = null, force = false, seederMode = 'PAYROLL') {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/seed`;

    const body = {
        period_month: periodMonth,
        period_year: periodYear,
        ...(divisionCode && { division_code: divisionCode }),
        ...(gangCode && { gang_code: gangCode }),
        force,
        seederMode
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to seed history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get seeder progress (polling endpoint)
 * @param {string} token - Auth token
 */
export async function getSeederProgress(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/seed/progress`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) return null;
    return response.json();
}

/**
 * Update PTKP Tax for a period year
 * @param {string} token - Auth token
 * @param {number} periodYear - Year to update
 */
export async function updatePtkpTax(token, periodYear) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/ptkp/update`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ period_year: periodYear }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to update PTKP: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Preview PTKP Tax update
 * @param {string} token - Auth token
 * @param {number} periodYear - Year to preview
 */
export async function previewPtkpTax(token, periodYear) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/ptkp/preview/${periodYear}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to preview PTKP: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch payroll history list
 * @param {string} token - Auth token
 * @param {number} periodMonth - Month filter (optional)
 * @param {number} periodYear - Year filter (optional)
 * @param {string} divisionCode - Division filter (optional)
 * @param {string} gangCode - Gang filter (optional)
 */
export async function fetchPayrollHistory(token, periodMonth = null, periodYear = null, divisionCode = null, gangCode = null) {
    const baseUrl = getBackendUrl();
    const params = new URLSearchParams();
    if (periodMonth) params.append('period_month', periodMonth);
    if (periodYear) params.append('period_year', periodYear);
    if (divisionCode) params.append('division_code', divisionCode);
    if (gangCode) params.append('gang_code', gangCode);

    const url = `${baseUrl}/payroll/history?${params.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch payroll history detail by history_id
 * @param {string} token - Auth token
 * @param {string} historyId - History ID
 */
export async function fetchPayrollHistoryDetail(token, historyId) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/${historyId}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch history detail: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Delete payroll history
 * @param {string} token - Auth token
 * @param {string} historyId - History ID to delete
 */
export async function deletePayrollHistory(token, historyId) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/${historyId}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to delete history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Lock payroll history
 * @param {string} token - Auth token
 * @param {string} historyId - History ID to lock
 * @param {string} reason - Lock reason
 */
export async function lockPayrollHistory(token, historyId, reason) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/${historyId}/lock`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to lock history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch audit trail
 * @param {string} token - Auth token
 * @param {Object} filters - Filter options
 * @param {string} filters.historyId - History ID filter (optional)
 * @param {string} filters.operation - Operation filter (optional)
 * @param {string} filters.performedBy - Performed by filter (optional)
 * @param {string} filters.startDate - Start date filter (optional)
 * @param {string} filters.endDate - End date filter (optional)
 */
export async function fetchAuditTrail(token, filters = {}) {
    const baseUrl = getBackendUrl();
    const params = new URLSearchParams();
    if (filters.historyId) params.append('history_id', filters.historyId);
    if (filters.operation) params.append('operation', filters.operation);
    if (filters.performedBy) params.append('performed_by', filters.performedBy);
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);

    const url = `${baseUrl}/payroll/history/audit/trail?${params.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch audit trail: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch available periods from history
 * @param {string} token - Auth token
 */
export async function fetchHistoryPeriods(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/periods/available`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch history periods: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Format month name
 * @param {number} month - Month number (1-12)
 * @returns {string} Month name in Indonesian
 */
export function formatMonthName(month) {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || '';
}

/**
 * Format currency
 * @param {number} value - Number to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * Format number
 * @param {number} value - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(value) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('id-ID').format(value);
}

/**
 * Get current period information
 * @param {string} token - Auth token
 */
export async function getCurrentPeriod(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/current-period`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get current period: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Check if a period is historical
 * @param {string} token - Auth token
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 */
export async function isHistoricalPeriod(token, month, year) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/history/is-historical/${month}/${year}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to check period: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get employee history timeline
 * NOTE: This function now redirects to the correct endpoint in employee.ts
 * @param {string} token - Auth token
 * @param {string} empCode - Employee code
 * @param {Object} options - Query options
 * @param {number} options.months - Number of months to fetch (default: 12)
 * @param {boolean} options.includeCurrent - Include current period (default: false)
 * @deprecated Use getEmployeeHistory from employeeDetailService.js instead
 */
export async function getEmployeeHistory(token, empCode, options = {}) {
    const baseUrl = getBackendUrl();
    const params = new URLSearchParams();

    // Use new endpoint parameters
    if (options.months) params.append('months', options.months.toString());
    if (options.includeCurrent !== undefined) params.append('include_current', options.includeCurrent.toString());

    // CORRECTED: Use the proper endpoint that exists in employee.ts
    const url = `${baseUrl}/payroll/employee/${empCode}/history?${params.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch employee history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get employee detail for specific period
 * NOTE: This function now redirects to the correct endpoint in employee.ts
 * @param {string} token - Auth token
 * @param {string} empCode - Employee code
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @deprecated Use getEmployeeCheckroll from employeeDetailService.js instead
 */
export async function getEmployeeDetailForPeriod(token, empCode, month, year) {
    const baseUrl = getBackendUrl();
    const params = new URLSearchParams();
    params.append('month', month.toString());
    params.append('year', year.toString());

    // CORRECTED: Use the proper checkroll endpoint that exists in employee.ts
    const url = `${baseUrl}/payroll/employee/${empCode}/checkroll?${params.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch employee detail: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get gang history for specific period
 * NOTE: This endpoint is not yet implemented. Use main payroll endpoint instead.
 * @param {string} token - Auth token
 * @param {string} gangCode - Gang code
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @deprecated This endpoint is not yet implemented. Use /payroll/report with gang filter instead.
 */
export async function getGangHistoryForPeriod(token, gangCode, month, year) {
    throw new Error('Gang history endpoint is not yet implemented. Use /payroll/report with gang_code parameter instead.');
    // Original endpoint (not working):
    // const url = `${baseUrl}/payroll/history/gang/${gangCode}/period/${month}/${year}`;
}
