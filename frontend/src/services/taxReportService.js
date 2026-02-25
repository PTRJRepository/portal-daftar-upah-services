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
export async function fetchAnnualTaxReport(token, year, month, division, gang) {
    const params = { year };
    if (month) params.month = month;
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/annual', { params, headers });
    return response.data;
}

/**
 * Fetch annual ASTEK & BPJS report
 */
export async function fetchAnnualAstekBpjsReport(token, year, month, division, gang) {
    const params = { year };
    if (month) params.month = month;
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/astek-bpjs', { params, headers });
    return response.data;
}

/**
 * Download monthly PPH21 tax report as Excel Document
 */
export async function downloadMonthlyTaxReportExcel(token, year, month, division, gang) {
    const params = { year, month };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    // Use responseType: 'blob' to handle binary data properly
    const response = await axios.get('/tax-report/monthly/excel', {
        params,
        headers,
        responseType: 'blob'
    });

    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    // Extract filename from Content-Disposition header if available
    let fileName = `PPH21_${division || 'ALL'}_${gang || 'ALL'}_${month}_${year}.xlsx`;
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
            fileName = matches[1].replace(/['"]/g, '');
        }
    }

    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
}
