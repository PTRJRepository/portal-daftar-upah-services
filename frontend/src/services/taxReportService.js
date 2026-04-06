import axios from 'axios';

/**
 * Helper to handle blob processes (checks for 0-byte, handles errors returned in blobs)
 */
async function processBlobResponse(response, defaultFileName) {
    const blob = response.data;
    
    // 1. Basic validation
    if (!(blob instanceof Blob)) {
        throw new Error('Server returned unexpected response type. Expected blob.');
    }

    if (blob.size === 0) {
        throw new Error('Server returned an empty file (0 bytes).');
    }

    // 2. Check if the "blob" is actually a JSON error (can happen if backend returns 200 with JSON but Axios expects blob)
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
        const text = await blob.text();
        try {
            const errorJson = JSON.parse(text);
            throw new Error(errorJson.error || errorJson.message || 'Server error');
        } catch (e) {
            throw new Error(text || 'Server returned JSON error');
        }
    }

    // 3. Extract filename from Content-Disposition
    let fileName = defaultFileName;
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
            fileName = matches[1].replace(/['"]/g, '');
        }
    }

    // 4. Create and trigger download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();

    // 5. Cleanup
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    }, 100);
}

/**
 * Fetch monthly PPH21 tax report
 */
export async function fetchMonthlyTaxReport(token, year, month, division, gang, gangPrefix, useHistory) {
    const params = { year, month };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;
    if (useHistory !== undefined) params.use_history = useHistory.toString();

    // Axios defaults handle auth if interceptor is present
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await axios.get('/tax-report/monthly', { params, headers, timeout: 120000 });
    return response.data;
}

/**
 * Fetch annual tax report
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
 * Common error handler for blob requests
 */
async function handleBlobError(error, defaultMessage) {
    if (error.response && error.response.data instanceof Blob) {
        try {
            const text = await error.response.data.text();
            try {
                const json = JSON.parse(text);
                throw new Error(json.error || json.message || defaultMessage);
            } catch {
                throw new Error(text || defaultMessage);
            }
        } catch (e) {
            throw new Error(e.message || defaultMessage);
        }
    }
    throw error;
}

/**
 * Download monthly PPH21 tax report as Excel Document (Tax Report Page)
 * Uses direct fetch to port 8002 like Daftar Upah export
 */
export async function downloadMonthlyTaxReportExcel(token, year, month, division, gang, gangPrefix, useHistory) {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (division) params.append('division', division);
    if (gang && gang !== 'ALL') params.append('gang', gang);
    if (gangPrefix && gangPrefix !== 'ALL') params.append('gangPrefix', gangPrefix);
    if (useHistory !== undefined) params.append('use_history', useHistory.toString());

    try {
        const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`;
        const response = await fetch(`${backendUrl}/tax-report/monthly/excel?${params.toString()}`, {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const json = await response.json();
                errorMessage = json.error || json.message || errorMessage;
            } catch {}
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Server returned empty file');

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `PPH21_${division || 'ALL'}_${month}_${year}.xlsx`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak Bulanan');
    }
}

/**
 * Download December tax report as Excel Document
 */
export async function downloadDecemberTaxReportExcel(token, year, division, gang, gangPrefix) {
    const params = { year };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;

    try {
        const response = await axios.get('/tax-report/december/excel', {
            params,
            responseType: 'blob',
            timeout: 180000
        });
        await processBlobResponse(response, `PAJAK_DESEMBER_${division || 'ALL'}_${year}.xlsx`);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak Desember');
    }
}

/**
 * Export PPh21 TER + PPh21 Input JSON by gang
 */
export async function exportPajakJson(token, year, month, gang, div, gangPrefix, useHistory) {
    const params = { year: String(year), month: String(month) };
    if (gang && gang !== 'ALL') params.gang = gang;
    if (div) params.div = div;
    if (gangPrefix && gangPrefix !== 'ALL') params.gang_prefix = gangPrefix;
    if (useHistory !== undefined) params.use_history = useHistory.toString();

    try {
        const response = await axios.get('/payroll/export/pajak', {
            params,
            responseType: 'blob',
            timeout: 120000,
        });
        await processBlobResponse(response, `PAJAK_${gang || 'ALL'}_${month}_${year}.json`);
    } catch (error) {
        await handleBlobError(error, 'Gagal export JSON Pajak');
    }
}

/**
 * Download tax report (PPH21) Excel from Operational page (App.jsx)
 * Uses direct fetch to port 8002 like Daftar Upah export
 */
export async function downloadTaxReportExcel(token, year, month, division, gang, gangPrefix, useHistory) {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (division) params.append('division', division);
    if (gang && gang !== 'ALL') params.append('gang', gang);
    if (gangPrefix && gangPrefix !== 'ALL') params.append('gangPrefix', gangPrefix);
    if (useHistory !== undefined) params.append('use_history', useHistory.toString());

    try {
        const backendUrl = `${window.location.protocol}//${window.location.hostname}:8002`;
        const response = await fetch(`${backendUrl}/tax-report/monthly/excel?${params.toString()}`, {
            headers: { Authorization: token ? `Bearer ${token}` : '' }
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const json = await response.json();
                errorMessage = json.error || json.message || errorMessage;
            } catch {}
            throw new Error(errorMessage);
        }

        const blob = await response.blob();
        if (blob.size === 0) throw new Error('Server returned empty file');

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `PPH21_${division || 'ALL'}_${month}_${year}.xlsx`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak');
    }
}
