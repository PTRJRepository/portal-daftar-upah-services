/**
 * Aggregation Seeder Service
 * Service functions for aggregation seeding to extend_db_ptrj
 */

const BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE || '';

/**
 * Check health of extend_db_ptrj connection
 * @param {string} token - Auth token
 */
export async function checkAggregationHealth(token) {
    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/health`, {
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
    const body = {
        month,
        year,
        ...(division && { division }),
        force
    };

    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/seed`, {
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
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    if (division) params.append('division', division);

    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/history?${params.toString()}`, {
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
    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/summary?month=${month}&year=${year}`, {
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
    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/divisions`, {
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
    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/periods`, {
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
export async function syncSpreadsheet(token, month, year, division = null) {
    const body = {
        month,
        year,
        ...(division && { division })
    };

    const response = await fetch(`${BACKEND_BASE}/spreadsheet/sync`, {
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
    const response = await fetch(`${BACKEND_BASE}/payroll/aggregation/status/${month}/${year}`, {
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
