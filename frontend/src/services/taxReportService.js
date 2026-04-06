import axios from 'axios';

/**
 * Fetch monthly PPH21 tax report
 */
export async function fetchMonthlyTaxReport(token, year, month, division, gang, gangPrefix) {
    const params = { year, month };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    // axios interceptor automatically sets the Authorization header
    // if using the auth interceptor, otherwise we can pass it here. 
    // Usually other services pass it directly like this:
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/monthly', { params, headers, timeout: 120000 });
    return response.data;
}

/**
 * Fetch annual tax report (penghasilan setahun + perhitungan pajak)
 */
export async function fetchAnnualTaxReport(token, year, month, division, gang, gangPrefix) {
    const params = { year };
    if (month) params.month = month;
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/annual', { params, headers, timeout: 120000 });
    return response.data;
}

/**
 * Fetch annual ASTEK & BPJS report
 */
export async function fetchAnnualAstekBpjsReport(token, year, month, division, gang, gangPrefix) {
    const params = { year };
    if (month) params.month = month;
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/astek-bpjs', { params, headers, timeout: 120000 });
    return response.data;
}

/**
 * Fetch December tax report
 */
export async function fetchDecemberTaxReport(token, year, division, gang, gangPrefix) {
    const params = { year };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const response = await axios.get('/tax-report/december', { params, headers, timeout: 120000 });
    return response.data;
}

/**
 * Download monthly PPH21 tax report as Excel Document
 */
export async function downloadMonthlyTaxReportExcel(token, year, month, division, gang, gangPrefix) {
    const params = { year, month };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
        // Use responseType: 'blob' to handle binary data properly
        const response = await axios.get('/tax-report/monthly/excel', {
            params,
            headers,
            responseType: 'blob'
        });

        // Check if response is actually a blob
        if (!(response.data instanceof Blob)) {
            throw new Error('Server returned unexpected response type. Expected blob.');
        }

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
    } catch (error) {
        // If error is from an error response (not network error), try to parse the error message
        if (error.response && error.response.data) {
            try {
                const errorText = await error.response.data.text();
                let errorMessage = 'Gagal mengunduh Excel';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                } catch {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            } catch (parseError) {
                throw new Error(parseError.message || 'Gagal mengunduh Excel: ' + error.message);
            }
        }
        throw error;
    }
}

/**
 * Download December tax report as Excel Document (includes Monthly Details Sheet)
 */
export async function downloadDecemberTaxReportExcel(token, year, division, gang, gangPrefix) {
    const params = { year };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
        // Use responseType: 'blob' to handle binary data properly
        const response = await axios.get('/tax-report/december/excel', {
            params,
            headers,
            responseType: 'blob'
        });

        // Check if response is actually a blob
        if (!(response.data instanceof Blob)) {
            throw new Error('Server returned unexpected response type. Expected blob.');
        }

        // Create a download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Extract filename from Content-Disposition header if available
        let fileName = `PAJAK_DESEMBER_${division || 'ALL'}_${gang || 'ALL'}_${year}.xlsx`;
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
    } catch (error) {
        // If error is from an error response (not network error), try to parse the error message
        if (error.response && error.response.data) {
            try {
                const errorText = await error.response.data.text();
                let errorMessage = 'Gagal mengunduh Excel';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                } catch {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            } catch (parseError) {
                throw new Error(parseError.message || 'Gagal mengunduh Excel: ' + error.message);
            }
        }
        throw error;
    }
}

/**
 * Export PPh21 TER + PPh21 Input JSON by gang
 * Downloads as JSON file automatically
 */
export async function exportPajakJson(token, year, month, gang) {
    const params = { year: String(year), month: String(month) };
    if (gang && gang !== 'ALL') params.gang = gang;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
        const response = await axios.get('/payroll/export/pajak', {
            params,
            headers,
            responseType: 'blob',
            timeout: 120000,
        });

        // Check if response is actually a blob
        if (!(response.data instanceof Blob)) {
            throw new Error('Server returned unexpected response type. Expected blob.');
        }

        // Extract filename from Content-Disposition header
        let fileName = `PAJAK_${gang || 'ALL'}_${month}_${year}.json`;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(contentDisposition);
            if (matches != null && matches[1]) {
                fileName = matches[1].replace(/['"]/g, '');
            }
        }

        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    } catch (error) {
        // If error is from an error response (not network error), try to parse the error message
        if (error.response && error.response.data) {
            try {
                const errorText = await error.response.data.text();
                let errorMessage = 'Gagal export JSON';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                } catch {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            } catch (parseError) {
                throw new Error(parseError.message || 'Gagal export JSON: ' + error.message);
            }
        }
        throw error;
    }
}

/**
 * Download tax report (PPH21) Excel from Operational page
 * Uses the same /tax-report/monthly/excel endpoint with gang/division from current context
 */
export async function downloadTaxReportExcel(token, year, month, division, gang, gangPrefix) {
    const params = { year, month };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
        const response = await axios.get('/tax-report/monthly/excel', {
            params,
            headers,
            responseType: 'blob',
            timeout: 120000,
        });

        // Check if response is actually a blob
        if (!(response.data instanceof Blob)) {
            throw new Error('Server returned unexpected response type. Expected blob.');
        }

        // Create a download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Extract filename from Content-Disposition header
        let fileName = `PPH21_${division || 'ALL'}_${gang || gangPrefix || 'ALL'}_${month}_${year}.xlsx`;
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
    } catch (error) {
        // If error is from an error response (not network error), try to parse the error message
        if (error.response && error.response.data) {
            try {
                const errorText = await error.response.data.text();
                let errorMessage = 'Gagal mengunduh Excel';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorMessage;
                } catch {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            } catch (parseError) {
                throw new Error(parseError.message || 'Gagal mengunduh Excel: ' + error.message);
            }
        }
        throw error;
    }
}
