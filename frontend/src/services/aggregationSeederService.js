/**
 * Aggregation Seeder Service
 * Service functions for aggregation seeding to extend_db_ptrj
 * Supports both direct backend access and proxy mode
 */

// Detect if we're in proxy mode (accessed via proxy gateway)
const isProxyMode = import.meta.env.VITE_PROXY_MODE === 'true' ||
                       import.meta.env.NODE_ENV === 'production' ||
                       (import.meta.env.VITE_BACKEND_HOST && import.meta.env.VITE_BACKEND_HOST !== 'localhost');

// Use relative URLs in proxy mode, absolute URLs in direct mode
// This allows the same build to work both locally and via proxy
const getBackendUrl = () => {
    if (isProxyMode) {
        // In proxy mode, use relative URLs - the Vite proxy will forward them
        return ''; // Empty string means use relative URLs like '/payroll/aggregation/health'
    } else {
        // In direct mode, use the absolute backend URL
        return import.meta.env.VITE_BACKEND_BASE || 'http://localhost:8002';
    }
};

/**
 * Check health of extend_db_ptrj connection
 * @param {string} token - Auth token
 */
export async function checkAggregationHealth(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/aggregation/health`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to check aggregation health: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Seed aggregation data for a specific period and division
 * @param {string} token - Auth token
 * @param {number} month - Month (1-12)
 * @param {number} year - Year (e.g., 2026)
 * @param {string} division - Division code (optional, if not provided processes all divisions)
 * @param {boolean} force - Force seeding even if no active employees
 */
export async function seedAggregation(token, month, year, division = null, force = false) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/aggregation/seed`;

    const body = {
        month,
        year,
        ...(division && { division }),
        force
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
        throw new Error(error.error || `Failed to seed aggregation: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch aggregation history
 * @param {string} token - Auth token
 * @param {number} month - Month filter (optional)
 * @param {number} year - Year filter (optional)
 * @param {string} division - Division filter (optional)
 */
export async function fetchAggregationHistory(token, month = null, year = null, division = null) {
    const baseUrl = getBackendUrl();
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    if (division) params.append('division', division);

    const url = `${baseUrl}/payroll/aggregation/history?${params.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch aggregation history: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch aggregation summary by division
 * @param {string} token - Auth token
 * @param {number} month - Month
 * @param {number} year - Year
 */
export async function fetchAggregationSummary(token, month, year) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/aggregation/summary?month=${month}&year=${year}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch aggregation summary: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch available divisions with aggregation data
 * @param {string} token - Auth token
 */
export async function fetchAggregationDivisions(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/aggregation/divisions`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch aggregation divisions: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch available periods with aggregation data
 * @param {string} token - Auth token
 */
export async function fetchAggregationPeriods(token) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/aggregation/periods`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch aggregation periods: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Sync data to Google Spreadsheet
 * @param {string} token - Auth token
 * @param {number} month - Month
 * @param {number} year - Year
 * @param {string} division - Division (optional)
 */
export async function syncSpreadsheet(token, month, year, division = null, syncType = 'DAFTAR_UPAH') {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/spreadsheet/sync`;

    const body = {
        month,
        year,
        ...(division && { division }),
        syncType
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
        throw new Error(error.error || `Failed to sync spreadsheet: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch aggregation status for a specific period
 * @param {string} token - Auth token
 * @param {number} month - Month
 * @param {number} year - Year
 */
export async function fetchAggregationStatus(token, month, year) {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/payroll/aggregation/status/${month}/${year}`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch aggregation status: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Format month number to Indonesian month name
 * @param {number} month - Month number (1-12)
 */
export function formatMonthName(month) {
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return monthNames[month - 1] || '';
}

/**
 * Format currency to Indonesian Rupiah
 * @param {number} value - Value to format
 */
export function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value || 0);
}

/**
 * Format number with thousand separator
 * @param {number} value - Value to format
 */
export function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(value || 0);
}
