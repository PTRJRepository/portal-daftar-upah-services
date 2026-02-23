import axios from 'axios';

/**
 * Fetch monthly PPH21 tax report
 */
export async function fetchMonthlyTaxReport(token, year, month, division, gang) {
    const params = { year, month };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;

    // axios interceptor automatically sets the Authorization header
    // if using the auth interceptor, otherwise we can pass it here. 
    // Usually other services pass it directly like this:
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/monthly', { params, headers });
    return response.data;
}

/**
 * Fetch annual tax report (penghasilan setahun + perhitungan pajak)
 */
export async function fetchAnnualTaxReport(token, year, division, gang) {
    const params = { year };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/annual', { params, headers });
    return response.data;
}

/**
 * Fetch annual ASTEK & BPJS report
 */
export async function fetchAnnualAstekBpjsReport(token, year, division, gang) {
    const params = { year };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/astek-bpjs', { params, headers });
    return response.data;
}
