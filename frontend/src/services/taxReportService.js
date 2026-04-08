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
    const response = await axios.get('tax-report/monthly', { params, headers, timeout: 120000 });
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
            timeout: 120000 // 2 minutes - much faster with direct history query
        });
        await processBlobResponse(response, `PPH21_${division || 'ALL'}_${gang || gangPrefix || 'ALL'}_${month}_${year}.xlsx`);
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

    try {
        const response = await axios.get('tax-report/monthly/excel/fast', {
            params,
            responseType: 'blob',
            timeout: 120000 // 2 minutes - much faster with direct history query
        });
        await processBlobResponse(response, `PPH21_${division || 'ALL'}_${gang || gangPrefix || 'ALL'}_${month}_${year}.xlsx`);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak Bulanan');
    }
}

/**
 * Download tax report (PPH21) Excel directly using data from UI (Daftar Upah)
 * Matches UI calculations exactly to prevent any DB read deviations
 */
export async function downloadTaxReportExcelFromUI(token, year, month, division, gang, gangPrefix, uiData) {
    const strippedEmployees = uiData.map(r => ({
        emp_name: r.name || r.nama || r.emp_name,
        emp_code: r.emp_code,
        nik: r.nik,
        new_nik: r.new_nik,
        npwp: r.npwp,
        alamat: r.alamat,
        jabatan: r.jabatan,
        gender: r.gender,
        status_ptkp: r.status_keluarga || r.status_ptkp || r.ptkp_status,
        kategori_ter: r.kategori_ter,
        hk: Number(r.jumlah_hk || r.hk || 0),
        upah_dasar: Number(r.upah_dasar || 0),
        gaji_pokok_ideal: Number(r.gaji_pokok_ideal || 0),
        gaji_pokok_aktual: Number(r.gaji_pokok_aktual || 0),
        koreksi_hk: Number(r.koreksi_hk || 0),
        tunjangan_beras: Number(r.tunjangan_beras || 0),
        tunjangan_jabatan: Number(r.tunjangan_jabatan || 0),
        tunjangan_lembur: Number(r.tunjangan_lembur || 0),
        premi_detail: r.premi_detail || {},
        total_premi: Number(r.total_premi || r.premi || 0),
        pot_koreksi: Number(r.pot_koreksi || 0),
        thr_amount: Number(r.thr_amount || r.pendapatan_thr || 0),
        exgratia_amount: Number(r.exgratia_amount || r.kontan || 0),
        bpjs_kes_majikan: Number(r.bpjs_kes_majikan || 0),
        astek_jht_majikan: Number(r.astek_jht_majikan || 0),
        upah_kotor: Number(r.upah_kotor || r.jumlah_upah_kotor || 0),
        penghasilan_bruto: Number(r.penghasilan_bruto || r.bruto || 0),
        tarif_pajak_ter: Number(r.tarif_pajak_ter || 0),
        pph21_ter: Number(r.pph21_ter || r.pot_pph21 || 0),
        gang_code: r.gang_code
    }));

    // Axios configuration with token if present
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    try {
        const response = await axios.post('tax-report/monthly/excel/from-ui', 
            { year: String(year), month: String(month), division, gang, gangPrefix, employees: strippedEmployees },
            { headers, responseType: 'blob', timeout: 120000, maxContentLength: Infinity, maxBodyLength: Infinity }
        );
        await processBlobResponse(response, `PPH21_${division || 'ALL'}_${gang || gangPrefix || 'ALL'}_${month}_${year}.xlsx`);
    } catch (error) {
        await handleBlobError(error, 'Gagal mengunduh Excel Pajak dari UI');
    }
}
