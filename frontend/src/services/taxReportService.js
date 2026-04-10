import axios from 'axios';

/**
 * Helper to handle blob processes (checks for 0-byte, handles errors returned in blobs)
 */
async function processBlobResponse(response, defaultFileName) {
    const blob = response.data;

    console.log('[processBlobResponse] Input:', {
        blobType: blob?.constructor?.name,
        blobSize: blob?.size,
        blobMimeType: blob?.type,
        httpStatus: response.status,
        contentType: response.headers['content-type']
    });

    // 1. Basic validation
    if (!(blob instanceof Blob)) {
        throw new Error('Server returned unexpected response type. Expected blob.');
    }

    // 2. Check for empty blob FIRST - this is the main issue
    if (blob.size === 0) {
        console.error('[processBlobResponse] ⚠️ EMPTY BLOB RECEIVED!');
        console.error('[processBlobResponse] Response status:', response.status);
        console.error('[processBlobResponse] Response headers:', response.headers);
        
        // Try to determine if this is an error response
        if (response.status >= 400) {
            throw new Error(`Server error (${response.status}): No data available or export failed`);
        }
        
        // If status is 200 but blob is empty, it's still an error
        throw new Error('Server returned an empty file (0 bytes). Check backend logs for errors.');
    }

    // 3. Check if the "blob" is actually a JSON error (can happen if backend returns 200 with JSON but Axios expects blob)
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
        const text = await blob.text();
        try {
            const errorJson = JSON.parse(text);
            throw new Error(errorJson.error || errorJson.message || 'Server error');
        } catch (e) {
            if (e.message && !e.message.includes('Server returned JSON error')) {
                throw e; // Re-throw the parsed error
            }
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
    const response = await axios.get('tax-report/monthly', { params, headers, timeout: 300000 });
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
    const response = await axios.get('tax-report/annual', { params, headers, timeout: 120000 });
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
    const response = await axios.get('tax-report/astek-bpjs', { params, headers, timeout: 120000 });
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
    const response = await axios.get('tax-report/december', { params, headers, timeout: 120000 });
    return response.data;
}

/**
 * Common error handler for blob requests
 */
async function handleBlobError(error, defaultMessage) {
    console.error('[handleBlobError] Error occurred:', error);
    
    if (error.response) {
        console.error('[handleBlobError] Error response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            dataType: typeof error.response.data,
            dataSize: error.response.data?.size
        });
        
        if (error.response.data instanceof Blob) {
            try {
                const text = await error.response.data.text();
                console.error('[handleBlobError] Error blob content:', text.substring(0, 1000));
                
                try {
                    const json = JSON.parse(text);
                    console.error('[handleBlobError] Parsed error JSON:', json);
                    throw new Error(json.error || json.message || json.details || defaultMessage);
                } catch (parseError) {
                    // If it's already a thrown error from JSON.parse, re-throw it
                    if (parseError.message && parseError.message !== defaultMessage) {
                        throw parseError;
                    }
                    // Otherwise throw the text or default message
                    throw new Error(text || defaultMessage);
                }
            } catch (e) {
                // Don't wrap if it's already our error
                if (e.message && e.message !== defaultMessage) {
                    throw e;
                }
                throw new Error(e.message || defaultMessage);
            }
        } else if (typeof error.response.data === 'string') {
            // Direct string error
            console.error('[handleBlobError] Direct string error:', error.response.data);
            try {
                const json = JSON.parse(error.response.data);
                throw new Error(json.error || json.message || json.details || defaultMessage);
            } catch {
                throw new Error(error.response.data || defaultMessage);
            }
        } else if (typeof error.response.data === 'object') {
            // Direct JSON error
            console.error('[handleBlobError] Direct JSON error:', error.response.data);
            throw new Error(error.response.data.error || error.response.data.message || error.response.data.details || defaultMessage);
        }
    }
    
    // Network error or other
    console.error('[handleBlobError] Non-response error:', error.message);
    throw new Error(error.message || defaultMessage);
}

/**
 * Download monthly PPH21 tax report as Excel Document (Tax Report Page)
 * Uses FAST endpoint that reads directly from pre-computed history tables
 */
export async function downloadMonthlyTaxReportExcel(token, year, month, division, gang, gangPrefix, useHistory) {
    const params = { year: String(year), month: String(month) };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;
    if (useHistory !== undefined) params.use_history = useHistory.toString();

    try {
        const response = await axios.get('tax-report/monthly/excel/fast', {
            params,
            responseType: 'blob',
            timeout: 300000 // 5 minutes - ensure slow exports don't timeout
        });
        const isGroupOnly = gangPrefix && (!gang || gang === 'ALL');
        const displayGangLabel = isGroupOnly ? `G${gangPrefix}` : (gang || gangPrefix || 'ALL');
        await processBlobResponse(response, `PPH21_${division || 'ALL'}_${displayGangLabel}_${month}_${year}.xlsx`);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak Bulanan');
    }
}

/**
 * Download monthly PPH21 tax report as Excel Document using frontend DOM details
 */
export async function downloadMonthlyTaxReportExcelFromDOM(token, year, month, division, gang, gangPrefix, employeesData, premiKeys) {
    try {
        const payload = {
            year: String(year),
            month: String(month),
            division: division || 'ALL',
            gang: gang || 'ALL',
            gangPrefix: gangPrefix || 'ALL',
            employees: employeesData,
            premiKeys: premiKeys
        };

        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        // Need to pass headers to post if the axios instance needs it directly
        const response = await axios.post('tax-report/monthly/excel/dom', payload, {
            headers,
            responseType: 'blob',
            timeout: 300000 // 5 minutes
        });
        const isGroupOnly = gangPrefix && (!gang || gang === 'ALL');
        const displayGangLabel = isGroupOnly ? `G${gangPrefix}` : (gang || gangPrefix || 'ALL');
        await processBlobResponse(response, `PPH21_DOM_${division || 'ALL'}_${displayGangLabel}_${month}_${year}.xlsx`);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak dari DOM');
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
        const response = await axios.get('tax-report/december/excel', {
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
        const response = await axios.get('payroll/export/pajak', {
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
 * Uses FAST endpoint that reads directly from pre-computed history tables
 */
export async function downloadTaxReportExcel(token, year, month, division, gang, gangPrefix, useHistory) {
    const params = { year: String(year), month: String(month) };
    if (division) params.division = division;
    if (gang && gang !== 'ALL') params.gang = gang;
    if (gangPrefix && gangPrefix !== 'ALL') params.gangPrefix = gangPrefix;
    if (useHistory !== undefined) params.use_history = useHistory.toString();

    console.log('[downloadTaxReportExcel] Requesting:', {
        url: 'tax-report/monthly/excel/fast',
        params
    });

    try {
        const response = await axios.get('tax-report/monthly/excel/fast', {
            params,
            responseType: 'blob',
            timeout: 300000 // 5 minutes - ensure slow exports don't timeout
        });

        console.log('[downloadTaxReportExcel] Response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            dataSize: response.data?.size,
            dataType: response.data?.type
        });
        
        // If it's a blob, check if it's empty
        if (response.data instanceof Blob) {
            if (response.data.size === 0) {
                console.error('[downloadTaxReportExcel] ⚠️ RECEIVED EMPTY BLOB (0 bytes)');
                throw new Error('Server returned an empty file (0 bytes). This may happen if the request timed out or the data was lost during transmission.');
            }
            
            // Log a small chunk of text if it's text-based (to see if it's accidental HTML/JSON error)
            if (response.data.type.includes('json') || response.data.type.includes('text') || response.data.size < 2000) {
                const text = await response.data.text();
                if (text.startsWith('{') || text.includes('error') || text.includes('DOCTYPE')) {
                    console.warn('[downloadTaxReportExcel] ⚠️ Blob content looks like an error/HTML:', text.substring(0, 500));
                }
            }
        }

        const isGroupOnly = gangPrefix && (!gang || gang === 'ALL');
        const displayGangLabel = isGroupOnly ? `G${gangPrefix}` : (gang || gangPrefix || 'ALL');
        await processBlobResponse(response, `PPH21_${division || 'ALL'}_${displayGangLabel}_${month}_${year}.xlsx`);
    } catch (error) {
        console.error('[downloadTaxReportExcel] Error caught:', error);
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak Bulanan');
    }
}
