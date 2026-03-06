import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReportTable from '../components/common/ReportTable';
import { useReport } from '../context/ReportContext';
import { otherIncomesService } from '../services/otherIncomesService';
import { Save, Trash2, Plus, RefreshCw, AlertCircle, Calculator, Download, Settings, X, Filter, Printer, Eye } from 'lucide-react';

const INCOME_TYPES = ['THR', 'Bonus', 'Custom'];

const OtherIncomesPage = ({ onBack, initialMonth, initialYear, initialDivision }) => {
    const { division, gang, month, year, setDivision, setGang, setMonth, setYear, allDivisions, gangs, gangLoading, gangPrefix, setGangPrefix } = useReport();

    useEffect(() => {
        if (initialMonth !== undefined && initialMonth !== month) setMonth(initialMonth);
        if (initialYear !== undefined && initialYear !== year) setYear(initialYear);
        if (initialDivision !== undefined && initialDivision !== division) setDivision(initialDivision);
    }, [initialMonth, initialYear, initialDivision]);

    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [exportType, setExportType] = useState('TOTAL');
    const [filterReligion, setFilterReligion] = useState('ALL');
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [printOrientation, setPrintOrientation] = useState('landscape');
    const [reportView, setReportView] = useState('MAIN'); // 'MAIN' or 'BANK_LIST'

    const RELIGION_OPTIONS = [
        { value: 'ALL', label: 'Semua Agama' },
        { value: '01 Islam', label: '01 Islam' },
        { value: '02 Katolik', label: '02 Katolik' },
        { value: '03 Protestan', label: '03 Protestan' },
        { value: '04 Hindu', label: '04 Hindu' },
        { value: '05 Budha', label: '05 Budha' },
        { value: '06 Konghucu', label: '06 Konghucu' }
    ];

    const getMonthName = (m) => {
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        return months[m - 1] || "";
    };

    // Helper to extract asistensi group from gang code (middle digit)
    const getAsistensi = useCallback((gangCode) => {
        if (!gangCode || gangCode.length < 2) return null;
        const match = gangCode.match(/[A-Za-z](\d)/); // e.g. G1H -> "1"
        return match ? match[1] : null;
    }, []);

    // Available asistensi groups from loaded gangs
    const availablePrefixes = useMemo(() => {
        const prefixes = new Set();
        gangs.forEach(g => {
            const a = getAsistensi(g.gang_code);
            if (a) prefixes.add(a);
        });
        return [...prefixes].sort();
    }, [gangs, getAsistensi]);

    // Filter gang list by asistensi prefix
    const filteredGangs = useMemo(() => {
        if (!gangPrefix) return gangs;
        return gangs.filter(g => getAsistensi(g.gang_code) === gangPrefix);
    }, [gangs, gangPrefix, getAsistensi]);

    const fetchIncomes = useCallback(async () => {
        if (!division || gangLoading) return;
        setLoading(true);
        setError(null);
        try {
            const data = await otherIncomesService.getIncomes(year, month, division, gang);
            setRowData(data);
        } catch (err) {
            console.error('Failed to fetch incomes:', err);
            setError('Gagal memuat data pendapatan.');
        } finally {
            setLoading(false);
        }
    }, [year, month, division, gang, gangLoading]);

    useEffect(() => {
        fetchIncomes();
    }, [fetchIncomes]);

    const handleCellValueChanged = async (params) => {
        const updatedRow = params.data;
        if (!updatedRow.id) return;
        try {
            await otherIncomesService.updateIncome(updatedRow.id, updatedRow);
        } catch (err) {
            alert('Gagal update data.');
        }
    };

    const handleDelete = async (data) => {
        if (!data.id) {
            setRowData(prev => prev.filter(r => r !== data));
            return;
        }
        if (window.confirm(`Hapus data ${data.emp_name}?`)) {
            try {
                await otherIncomesService.deleteIncome(data.id);
                setRowData(prev => prev.filter(r => r.id !== data.id));
            } catch (err) { alert('Gagal menghapus.'); }
        }
    };

    const handleAddRow = () => {
        const newRow = {
            nik: '', emp_name: '', division_code: division === 'ALL' ? '' : division,
            gang_code: gang === 'ALL' ? '' : gang,
            period_year: year, period_month: month, income_type: 'Custom', income_name: '', amount: 0,
            is_paid_in_thp: true, is_taxable: true, isNew: true
        };
        setRowData(prev => [newRow, ...prev]);
    };

    const handleSaveNew = async (data) => {
        setIsSaving(true);
        try {
            const result = await otherIncomesService.addIncome({
                ...data,
                period_year: year,
                period_month: month,
                division_code: data.division_code || division
            });
            setRowData(prev => prev.map(r => r === data ? { ...result, isNew: false } : r));
            alert('Berhasil disimpan.');
        } catch (err) { alert('Gagal simpan.'); }
        finally { setIsSaving(false); }
    };

    const handleCalculateTHR = async () => {
        if (!window.confirm(`Kalkulasi THR untuk Divisi ${division} Gang ${gang}?`)) return;
        setIsCalculating(true);
        setError(null);
        try {
            const result = await otherIncomesService.calculateTHR(year, month, division, gang);
            if (result.success) {
                // Clear rowData to force a visible refresh
                setRowData([]);
                await fetchIncomes();
                alert(`Berhasil mengkalkulasi ${result.count} data THR.`);
            }
            else alert('Gagal: ' + result.message);
        } catch (err) {
            console.error('Calculation error:', err);
            alert('Kesalahan server saat kalkulasi.');
        }
        finally { setIsCalculating(false); }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID').format(val || 0);

    const getReportHTML = (data, orientation = 'landscape') => {
        const mName = getMonthName(month);
        const isPortrait = orientation === 'portrait';
        const baseFontSize = isPortrait ? '7px' : '9px';
        const headerFontSize = isPortrait ? '5.5px' : '7.5px';
        const footerFontSize = isPortrait ? '7px' : '10px';

        // Calculate Totals
        const totalKaryawan = data.length;
        const totalKotor = data.reduce((a, c) => a + (c.amount || 0), 0);
        const totalPajak = data.reduce((a, c) => a + (c.is_taxable ? Math.round(c.amount * 0.05) : 0), 0);
        const totalBersih = totalKotor - totalPajak;
        const totalBeras = data.reduce((a, c) => a + ((c.details?.variables?.BERAS_RATE || 0) * 30), 0);
        const totalMasaKerja = data.reduce((a, c) => a + (c.details?.variables?.MASA_KERJA_JUMLAH || 0), 0);

        return `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                body { 
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                    padding: 0; 
                    margin: 0;
                    font-size: ${baseFontSize}; 
                    background-color: white;
                    color: #1e293b;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .report-container {
                    width: 100%;
                    padding: 8mm;
                }
                
                .header-section {
                    text-align: center;
                    margin-bottom: 12px;
                    border-bottom: 2.5px solid #000;
                    padding-bottom: 8px;
                }
                
                .company-name { 
                    font-size: 13px; 
                    font-weight: 700; 
                    color: #000; 
                    margin: 0;
                    text-align: left;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .report-title { 
                    font-size: 16px; 
                    font-weight: 800; 
                    margin: 4px 0; 
                    color: #000; 
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .meta-grid {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 6px;
                    font-size: 9px;
                    font-weight: 600;
                    color: #333;
                }
                
                .meta-grid b { color: #000; }
                
                .summary-cards {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .sum-card {
                    flex: 1;
                    min-width: 120px;
                    border: 1px solid #000;
                    padding: 6px 10px;
                    background-color: #f8fafc;
                    border-left: 4px solid #1a1a2e;
                }
                
                .sum-title {
                    font-size: ${isPortrait ? '8px' : '9px'};
                    color: #475569;
                    font-weight: 700;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }
                
                .sum-val {
                    font-size: ${isPortrait ? '11px' : '13px'};
                    font-weight: 800;
                    color: #000;
                }
                
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    table-layout: fixed;
                    border: 1.5px solid #000;
                }
                
                th, td { 
                    border: 1px solid #666; 
                    padding: 3px 2px; 
                    text-align: left; 
                    word-wrap: break-word;
                    overflow: hidden;
                    font-size: ${baseFontSize};
                }
                
                thead th { 
                    background-color: #1a1a2e !important; 
                    color: white !important; 
                    text-align: center; 
                    text-transform: uppercase; 
                    font-size: ${headerFontSize}; 
                    font-weight: 700;
                    border: 0.5px solid #ccc;
                    padding: 4px 2px;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                tbody tr:nth-child(even) { background-color: #f5f5f5; }
                tbody tr:hover { background-color: #eef; }
                
                tfoot th, tfoot td { 
                    background-color: #1a1a2e !important; 
                    color: #ffd700 !important; 
                    font-weight: 800; 
                    font-size: ${footerFontSize};
                    border-top: 2.5px solid #000;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .text-right { text-align: right; padding-right: 3px; }
                .text-center { text-align: center; }
                .font-bold { font-weight: 700; }
                
                .proporsi-tag { 
                    color: #c00; 
                    font-weight: 700; 
                    font-size: 6px; 
                    background: #ffe0e0;
                    padding: 1px 3px; 
                    border-radius: 2px; 
                    display: inline-block;
                    border: 0.5px solid #c00;
                    margin-top: 1px;
                }
                
                .kelayakan-tag {
                    font-size: 6.5px;
                    font-weight: 700;
                    color: #b45309;
                    background: #fef3c7;
                    padding: 1px 3px;
                    border-radius: 2px;
                    display: inline-block;
                    border: 0.5px solid #d97706;
                }
                
                .emp-info {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.2;
                }
                .emp-name { font-weight: 700; color: #000; }
                .emp-sub { font-size: 0.85em; color: #555; }
                
                .signature-section { 
                    margin-top: 30px; 
                    display: flex; 
                    justify-content: space-between;
                    page-break-inside: avoid;
                }
                
                .sig-box { 
                    text-align: center; 
                    width: 28%;
                }
                
                .sig-title { font-weight: 600; color: #333; font-size: 9px; margin-bottom: 50px; }
                .sig-name { font-weight: 700; border-bottom: 1.5px solid #000; display: inline-block; min-width: 85%; color: #000; }
                .sig-role { font-size: 8px; font-weight: 600; color: #555; margin-top: 2px; }

                .col-no { width: 3%; }
                .col-sex { width: 2.5%; }
                .col-name { width: 15%; }
                .col-agama { width: 6.5%; }
                .col-tgl { width: 7.5%; }
                .col-hk { width: 3%; }
                .col-updasar { width: 8%; }
                .col-uppokok { width: 8%; }
                .col-brate { width: 5%; }
                .col-bjml { width: 7%; }
                .col-mkthn { width: 3.5%; }
                .col-mkjml { width: 7%; }
                .col-kotor { width: 8%; }
                .col-pajak { width: 6.5%; }
                .col-kelayakan { width: 9%; }
                .col-bersih { width: 9%; }
                
                @media print { 
                    .no-print { display: none; } 
                    @page { size: ${orientation}; margin: 6mm; } 
                    .report-container { padding: 0; }
                    body { font-size: ${baseFontSize}; }
                }
            </style>
            <div class="report-container">
                <div class="header-section">
                    <div class="company-name">PT REBINMAS JAYA</div>
                    <div class="report-title">Daftar Pembayaran Tunjangan Hari Raya (THR)</div>
                    <div class="meta-grid">
                        <div>PERIODE: <b>${mName} ${year}</b></div>
                        <div>DIVISI: <b>${division === 'ALL' ? 'SEMUA UNIT' : division}</b></div>
                        <div style="text-align:right">GANG: <b>${gang === 'ALL' ? 'SEMUA GANG' : gang}</b></div>
                    </div>
                </div>
                
                <div class="summary-cards">
                    <div class="sum-card">
                        <div class="sum-title">Total Karyawan</div>
                        <div class="sum-val">${totalKaryawan} Orang</div>
                    </div>
                    <div class="sum-card">
                        <div class="sum-title">Total THR (Kotor)</div>
                        <div class="sum-val">Rp ${formatCurrency(totalKotor)}</div>
                    </div>
                    <div class="sum-card">
                        <div class="sum-title">Total THR (Bersih)</div>
                        <div class="sum-val">Rp ${formatCurrency(totalBersih)}</div>
                    </div>
                    <div class="sum-card">
                        <div class="sum-title">Total Beras</div>
                        <div class="sum-val">Rp ${formatCurrency(totalBeras)}</div>
                    </div>
                    <div class="sum-card">
                        <div class="sum-title">Total Masa Kerja</div>
                        <div class="sum-val">Rp ${formatCurrency(totalMasaKerja)}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th rowspan="3" class="col-no">NO</th>
                            <th rowspan="3" class="col-sex">L/P</th>
                            <th rowspan="3" class="col-name">NAMA KARYAWAN<br/>NIK / CODE</th>
                            <th rowspan="3" class="col-agama">AGAMA</th>
                            <th rowspan="3" class="col-tgl">TGL<br/>MASUK</th>
                            <th rowspan="3" class="col-hk">HK</th>
                            <th rowspan="3" class="col-updasar">UPAH<br/>DASAR</th>
                            <th rowspan="3" class="col-uppokok">UPAH<br/>POKOK</th>
                            <th colspan="2">BERAS</th>
                            <th colspan="2">MASA KERJA</th>
                            <th rowspan="3" class="col-kotor">UPAH<br/>KOTOR</th>
                            <th rowspan="3" class="col-pajak">PAJAK<br/>THR</th>
                            <th rowspan="3" class="col-kelayakan">KELAYAKAN<br/>THR</th>
                            <th rowspan="3" class="col-bersih">UPAH<br/>BERSIH</th>
                        </tr>
                        <tr>
                            <th colspan="2">TUNJANGAN</th>
                            <th colspan="2">PENGABDIAN</th>
                        </tr>
                        <tr>
                            <th class="col-brate">RATE</th>
                            <th class="col-bjml">JUMLAH</th>
                            <th class="col-mkthn">THN</th>
                            <th class="col-mkjml">JUMLAH</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((row, index) => {
            const vars = row.details?.variables || {};
            const joinDate = vars.JOIN_DATE || row.join_date;
            const masaKerjaThn = vars.MASA_KERJA_TAHUN || 0;
            const upahKotor = row.amount || 0;
            const pajak = row.is_taxable ? Math.round(upahKotor * 0.05) : 0;
            const upahBersih = upahKotor - pajak;
            const empCode = row.emp_code || vars.EMP_CODE || '-';

            // Clean up religion string (remove "01 ", "02 ", etc.)
            const rawReligion = row.religion || vars.RELIGION || '-';
            const cleanReligion = rawReligion.replace(/^\d+\s+/, '');

            let propLabel = '';
            let kelayakanLabel = '';
            if (vars.PROPORTION_FACTOR && vars.PROPORTION_FACTOR !== '12/12') {
                propLabel = `<span class="proporsi-tag">PROP ${vars.PROPORTION_FACTOR}</span>`;
                const workingMonths = vars.WORKING_MONTHS || vars.PROPORTION_FACTOR.split('/')[0];
                kelayakanLabel = `<span class="kelayakan-tag">Proporsi ${workingMonths} bln (${vars.PROPORTION_FACTOR})</span>`;
            }

            return `
                            <tr>
                                <td class="text-center">${index + 1}</td>
                                <td class="text-center">${vars.SEX || 'L'}</td>
                                <td>
                                    <div class="emp-info">
                                        <span class="emp-name">${row.emp_name}</span>
                                        <span class="emp-sub">${row.nik} | ${empCode}</span>
                                        ${propLabel}
                                    </div>
                                </td>
                                <td class="text-center" style="font-size:0.85em">${cleanReligion}</td>
                                <td class="text-center">${joinDate ? new Date(joinDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                <td class="text-center">${vars.HK || 30}</td>
                                <td class="text-right">${formatCurrency(vars.UPAH_DASAR)}</td>
                                <td class="text-right">${formatCurrency(vars.GAJI_POKOK)}</td>
                                <td class="text-right">${formatCurrency(vars.BERAS_RATE)}</td>
                                <td class="text-right">${formatCurrency((vars.BERAS_RATE || 0) * 30)}</td>
                                <td class="text-center">${masaKerjaThn}</td>
                                <td class="text-right">${formatCurrency(vars.MASA_KERJA_JUMLAH)}</td>
                                <td class="text-right font-bold">${formatCurrency(upahKotor)}</td>
                                <td class="text-right">${formatCurrency(pajak)}</td>
                                <td class="text-center">${kelayakanLabel}</td>
                                <td class="text-right font-bold" style="color:#1a365d">${formatCurrency(upahBersih)}</td>
                            </tr>
                        `;
        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="12" class="text-right">TOTAL KESELURUHAN (IDR)</th>
                            <th class="text-right">${formatCurrency(data.reduce((a, c) => a + (c.amount || 0), 0))}</th>
                            <th class="text-right">${formatCurrency(data.reduce((a, c) => a + (c.is_taxable ? Math.round(c.amount * 0.05) : 0), 0))}</th>
                            <th class="text-right">${formatCurrency(data.reduce((a, c) => a + (c.amount - (c.is_taxable ? Math.round(c.amount * 0.05) : 0)), 0))}</th>
                        </tr>
                    </tfoot>
                </table>
                <div class="signature-section">
                    <div class="sig-box">
                        <div class="sig-title">Dibuat Oleh,</div>
                        <div class="sig-name"></div>
                        <div class="sig-role">KTU / Kerani</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-title">Diperiksa Oleh,</div>
                        <div class="sig-name"></div>
                        <div class="sig-role">Estate Manager</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-title">Disetujui Oleh,</div>
                        <div class="sig-name"></div>
                        <div class="sig-role">Senior Manager</div>
                    </div>
                </div>
            </div>
        `;
    };

    const handlePrintReport = () => {
        let printData = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
        if (gangPrefix) printData = printData.filter(r => getAsistensi(r.gang_code) === gangPrefix);
        if (printData.length === 0) return alert('Tidak ada data.');
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Laporan THR - ${division}</title></head><body>${getReportHTML(printData, printOrientation)}<script>window.onload = function() { window.print(); }</script></body></html>`);
        win.document.close();
    };

    const getBankListHTML = (data) => {
        const mName = getMonthName(month);
        const totalTransfer = data.reduce((a, c) => a + (c.amount - (c.is_taxable ? Math.round(c.amount * 0.05) : 0)), 0);

        const formatAmount = (val) => {
            return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
        };

        // Calculate total pages (approx 35 rows per page)
        const rowsPerPage = 35;
        const totalPages = Math.ceil(data.length / rowsPerPage);

        // Split data into pages
        const pages = [];
        for (let i = 0; i < data.length; i += rowsPerPage) {
            pages.push(data.slice(i, i + rowsPerPage));
        }

        return `
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                body { 
                    font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
                    padding: 0; 
                    margin: 0;
                    font-size: 11px; 
                    color: #000;
                }
                
                .page {
                    padding: 8mm 10mm;
                    page-break-after: always;
                }
                
                .page:last-child {
                    page-break-after: auto;
                }
                
                .header {
                    margin-bottom: 8px;
                }
                
                .division-name { 
                    font-size: 16px; 
                    font-weight: 700; 
                    text-align: center;
                    margin-bottom: 2px;
                }
                
                .header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    font-size: 11px;
                    font-weight: 600;
                }

                .header-row .period {
                    font-size: 13px;
                    font-weight: 700;
                }
                
                .page-info {
                    text-align: right;
                    font-size: 10px;
                    color: #333;
                }
                
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    table-layout: fixed;
                }
                
                th, td { 
                    border: 1px solid #999; 
                    padding: 4px 6px; 
                    text-align: left; 
                    word-wrap: break-word;
                    overflow: hidden;
                    font-size: 11px;
                }
                
                thead th { 
                    background-color: #e8e8e8 !important; 
                    font-weight: 700; 
                    text-align: left;
                    padding: 6px;
                    border: 1px solid #999;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                
                tfoot td, tfoot th { 
                    font-weight: 700; 
                    border-top: 2px solid #000;
                }

                .col-no { width: 4%; }
                .col-bankno { width: 22%; }
                .col-amount { width: 18%; }
                .col-name { width: 30%; }
                .col-bankcode { width: 12%; }
                .col-empcode { width: 14%; }
                
                @media print { 
                    @page { size: portrait; margin: 8mm; } 
                    body { padding: 0; }
                    .page { padding: 5mm 8mm; }
                }
            </style>
            ${pages.map((pageData, pageIndex) => {
            const startNo = pageIndex * rowsPerPage;
            return `
            <div class="page">
                <div class="header">
                    <div class="division-name">${division === 'ALL' ? 'SEMUA UNIT' : division}</div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline">
                        <div style="font-size:11px; font-weight:600">Dept: D1</div>
                        <div class="period">${mName} ${year}</div>
                        <div class="page-info">PAGE : ${pageIndex + 1} of ${totalPages}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th class="col-no">.</th>
                            <th class="col-bankno">Bank Acc. No.</th>
                            <th class="col-amount">Amount</th>
                            <th class="col-name">Employee Name</th>
                            <th class="col-bankcode">Bank Code</th>
                            <th class="col-empcode">Employee Code</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageData.map((row, index) => {
                const upahKotor = row.amount || 0;
                const pajak = row.is_taxable ? Math.round(upahKotor * 0.05) : 0;
                const upahBersih = upahKotor - pajak;
                const bankAcc = row.bank_acc_no || (row.details?.variables?.BANK_ACC_NO) || '';
                const bankName = row.bank_code || (row.details?.variables?.BANK_CODE) || 'BRI';
                const empCode = row.emp_code || (row.details?.variables?.EMP_CODE) || row.nik;

                return `
                        <tr>
                            <td class="text-center">${startNo + index + 1}</td>
                            <td>${bankAcc}</td>
                            <td class="text-right">${formatAmount(upahBersih)}</td>
                            <td>${row.emp_name}</td>
                            <td class="text-center">${bankName}</td>
                            <td class="text-center">${empCode}</td>
                        </tr>`;
            }).join('')}
                    </tbody>
                    ${pageIndex === pages.length - 1 ? `
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-right" style="font-weight:700">TOTAL</td>
                            <td class="text-right" style="font-weight:700">${formatAmount(totalTransfer)}</td>
                            <td colspan="3" style="font-weight:700">${data.length} Karyawan</td>
                        </tr>
                    </tfoot>` : ''}
                </table>
            </div>`;
        }).join('')}
        `;
    };

    const handlePrintBankList = () => {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Bank List - THR</title></head><body>${getBankListHTML(displayData)}<script>window.onload = function() { window.print(); }</script></body></html>`);
        win.document.close();
    };

    // ReportTable column definitions — matching the DAFTAR THR layout
    const reportColumns = useMemo(() => [
        { field: '_no', headers: ['NO.\nURUT', null, null], w: 60, className: 'text-center', sticky: true, left: 0, valueGetter: (row) => row._no },
        { field: 'sex', headers: ['L/P', null, null], w: 45, className: 'text-center', sticky: true, left: 60, valueGetter: (row) => row.details?.variables?.SEX || 'L' },
        {
            field: 'emp_name', headers: ['NAMA KARYAWAN', null, null], w: 200, className: 'text-left', sticky: true, left: 105,
            render: (row) => (
                <div>
                    <div style={{ fontWeight: 'bold' }}>{row.emp_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{row.nik} {row.emp_code ? `| ${row.emp_code}` : ''}</div>
                </div>
            )
        },
        {
            field: 'income_name', headers: ['TIPE & DESKRIPSI', null, null], w: 180, className: 'text-left',
            render: (row) => (
                <div>
                    <span style={{ fontSize: '0.75rem', padding: '2px 4px', backgroundColor: row.income_type === 'THR' ? '#fef3c7' : '#f1f5f9', borderRadius: '4px', marginRight: '4px' }}>{row.income_type}</span>
                    <span style={{ fontSize: '0.8rem' }}>{row.income_name}</span>
                </div>
            )
        },
        {
            field: 'join_date', headers: ['TANGGAL MASUK\nKERJA', null, null], w: 120, className: 'text-center',
            valueGetter: (row) => {
                const jd = row.details?.variables?.JOIN_DATE || row.join_date;
                return jd ? new Date(jd).toLocaleDateString('id-ID') : '-';
            }
        },
        { field: 'hk', headers: ['HARI\nKERJA', null, null], w: 60, className: 'text-center', valueGetter: () => 30 },
        { field: 'details.variables.UPAH_DASAR', headers: ['UPAH\nDASAR\n(Rp)', null, null], w: 120, className: 'text-right', format: 'currency' },
        {
            field: 'upah_pokok', headers: ['UPAH\nPOKOK\n(Rp)', null, null], w: 120, className: 'text-right', format: 'currency',
            valueGetter: (row) => row.details?.variables?.GAJI_POKOK || 0
        },
        // TUNJANGAN / PREMI > BERAS
        { field: 'details.variables.BERAS_RATE', headers: ['TUNJANGAN / PREMI', 'BERAS', '(Rp)/\nHK'], w: 90, className: 'text-right', format: 'currency' },
        {
            field: 'beras_jml', headers: ['TUNJANGAN / PREMI', 'BERAS', 'Jumlah\n(Rp)'], w: 110, className: 'text-right', format: 'currency',
            valueGetter: (row) => (row.details?.variables?.BERAS_RATE || 0) * 30
        },
        // TUNJANGAN / PREMI > masa
        { field: 'details.variables.MASA_KERJA_TAHUN', headers: ['TUNJANGAN / PREMI', 'masa', 'THN'], w: 55, className: 'text-center' },
        { field: 'details.variables.MASA_KERJA_JUMLAH', headers: ['TUNJANGAN / PREMI', 'masa', 'JUMLAH\n(Rp)'], w: 110, className: 'text-right', format: 'currency' },
        // Totals
        { field: 'amount', headers: ['JUMLAH\nUPAH KOTOR\n(Rp)', null, null], w: 140, className: 'text-right font-bold', format: 'currency' },
        {
            field: 'pajak_thr', headers: ['PAJAK\nTHR', null, null], w: 100, className: 'text-right', format: 'currency',
            valueGetter: (row) => row.is_taxable ? Math.round((row.amount || 0) * 0.05) : 0
        },
        {
            field: 'kelayakan', headers: ['KELAYAKAN\nTHR', null, null], w: 130, className: 'text-center',
            render: (row) => {
                const vars = row.details?.variables || {};
                if (vars.PROPORTION_FACTOR && vars.PROPORTION_FACTOR !== '12/12') {
                    const workingMonths = vars.WORKING_MONTHS || vars.PROPORTION_FACTOR.split('/')[0];
                    return (
                        <span style={{ fontSize: '0.7rem', padding: '2px 5px', backgroundColor: '#fef3c7', borderRadius: '4px', border: '1px solid #d97706', color: '#b45309', fontWeight: 600 }}>
                            Proporsi {workingMonths} bln ({vars.PROPORTION_FACTOR})
                        </span>
                    );
                }
                return '';
            }
        },
        {
            field: 'upah_bersih', headers: ['JUMLAH\nUPAH BERSIH\n(Rp)', null, null], w: 150, className: 'text-right font-bold', format: 'currency',
            valueGetter: (row) => (row.amount || 0) - (row.is_taxable ? Math.round((row.amount || 0) * 0.05) : 0)
        },
        // Aksi
        {
            field: '_aksi', headers: ['AKSI', null, null], w: 60, className: 'text-center',
            render: (row) => (
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    {row.isNew && <button onClick={() => handleSaveNew(row)} style={{ border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={14} /></button>}
                    <button onClick={() => handleDelete(row)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
            )
        }
    ], []);

    // Prepare display data with row numbers
    const displayData = useMemo(() => {
        console.log('[DEBUG] rowData count:', rowData.length);
        let filtered = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
        console.log('[DEBUG] after religion filter:', filtered.length, 'Filter:', filterReligion);

        // Filter by gang group (asistensi)
        if (gangPrefix) {
            filtered = filtered.filter(r => {
                const asistensi = getAsistensi(r.gang_code);
                return asistensi === gangPrefix;
            });
            console.log('[DEBUG] after group filter:', filtered.length, 'Group:', gangPrefix);
        }

        const mapped = filtered.map((row, i) => ({ ...row, _no: i + 1, _id: row.id || `row-${i}` }));
        console.log('[DEBUG] Final displayData count:', mapped.length);
        return mapped;
    }, [rowData, filterReligion, gangPrefix, getAsistensi]);

    // Footer totals
    const footerData = useMemo(() => {
        const totalKotor = displayData.reduce((a, c) => a + (c.amount || 0), 0);
        const totalPajak = displayData.reduce((a, c) => a + (c.is_taxable ? Math.round((c.amount || 0) * 0.05) : 0), 0);
        return {
            amount: totalKotor,
            pajak_thr: totalPajak,
            upah_bersih: totalKotor - totalPajak,
        };
    }, [displayData]);

    return (
        <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            {reportView === 'BANK_LIST' ? (
                <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button onClick={() => setReportView('MAIN')} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <X size={16} /> Kembali ke Laporan Utama
                            </button>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Preview List Pembayaran Bank</h2>
                        </div>
                        <button onClick={handlePrintBankList} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            <Printer size={16} /> Cetak List Bank
                        </button>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '2rem', backgroundColor: '#f3f4f6' }}>
                        <div style={{
                            backgroundColor: 'white',
                            padding: '3rem',
                            width: '900px',
                            margin: '0 auto',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                            dangerouslySetInnerHTML={{ __html: getBankListHTML(displayData) }}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Laporan THR</h1>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Daftar Pembayaran Tunjangan Hari Raya</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: '4px' }}>
                                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Bulan {i + 1}</option>)}
                            </select>
                            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '0.4rem', width: '80px', borderRadius: '4px' }} />
                        </div>
                    </div>

                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <select value={division} onChange={e => { setDivision(e.target.value); setGangPrefix(''); }} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    <option value="ALL">SEMUA DIVISI</option>
                                    {allDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                    value={gangPrefix}
                                    onChange={e => setGangPrefix(e.target.value)}
                                    style={{
                                        padding: '0.4rem', borderRadius: '4px',
                                        border: `1px solid ${gangPrefix ? '#93c5fd' : '#cbd5e1'}`,
                                        backgroundColor: gangPrefix ? '#eff6ff' : 'white',
                                        fontWeight: gangPrefix ? 600 : 400
                                    }}
                                >
                                    <option value="">SEMUA GROUP</option>
                                    {availablePrefixes.map(p => <option key={p} value={p}>Group {p}</option>)}
                                </select>
                                <select value={gang} onChange={e => setGang(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    <option value="ALL">SEMUA GANG{gangPrefix ? ` (Group ${gangPrefix})` : ''}</option>
                                    {filteredGangs.map(g => <option key={g.gang_code} value={g.gang_code}>{g.gang_code}</option>)}
                                </select>
                                <select value={filterReligion} onChange={e => setFilterReligion(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                    {RELIGION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    value={printOrientation}
                                    onChange={e => setPrintOrientation(e.target.value)}
                                    style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                                    title="Print Orientation"
                                >
                                    <option value="landscape">Landscape</option>
                                    <option value="portrait">Portrait</option>
                                </select>
                                <button onClick={() => setIsPreviewModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
                                    <Eye size={16} /> Preview
                                </button>
                                <button onClick={() => setReportView('BANK_LIST')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    <Printer size={16} /> Tampilkan List Bank
                                </button>
                                <button onClick={handlePrintReport} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    <Printer size={16} /> Print PDF
                                </button>
                                <button onClick={handleCalculateTHR} disabled={loading || isCalculating} style={{ padding: '0.4rem 0.8rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: (loading || isCalculating) ? 'not-allowed' : 'pointer', opacity: (loading || isCalculating) ? 0.6 : 1 }}>
                                    <Calculator size={16} /> {isCalculating ? 'Mengkalkulasi...' : 'Kalkulasi THR'}
                                </button>
                                <button onClick={fetchIncomes} disabled={loading || isCalculating} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
                                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                                </button>
                                <button onClick={handleAddRow} style={{ padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    <Plus size={16} /> Tambah
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            {isCalculating && (
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                    <RefreshCw size={48} className="spin" style={{ color: '#f59e0b', marginBottom: '1rem' }} />
                                    <h3 style={{ margin: 0 }}>Sedang Menghitung THR...</h3>
                                    <p style={{ color: '#64748b' }}>Mohon tunggu sebentar.</p>
                                </div>
                            )}
                            <ReportTable
                                columns={reportColumns}
                                data={displayData}
                                footerData={displayData.length > 0 ? footerData : null}
                                footerLabel="TOTAL KESELURUHAN"
                                footerLabelColSpan={12}
                                statusBar={<><strong>Total:</strong> {displayData.length} karyawan</>}
                            />
                        </div>
                    </div>

                    {/* Modal Preview Web */}
                    {isPreviewModalOpen && (() => {
                        let previewData = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
                        if (gangPrefix) previewData = previewData.filter(r => getAsistensi(r.gang_code) === gangPrefix);
                        return (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', padding: '2rem' }}>
                                <div style={{ backgroundColor: 'white', flex: 1, borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                    <div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <h2 style={{ margin: 0 }}>Preview Laporan THR</h2>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Orientasi:</span>
                                                <select
                                                    value={printOrientation}
                                                    onChange={e => setPrintOrientation(e.target.value)}
                                                    style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}
                                                >
                                                    <option value="landscape">Landscape</option>
                                                    <option value="portrait">Portrait</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => {
                                                const win = window.open('', '_blank');
                                                win.document.write(`<html><head><title>Laporan THR - ${division}</title></head><body>${getReportHTML(previewData, printOrientation)}<script>window.onload = function() { window.print(); }</script></body></html>`);
                                                win.document.close();
                                            }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                                <Download size={16} /> Simpan PDF
                                            </button>
                                            <button onClick={handlePrintReport} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                                <Printer size={16} /> Cetak PDF
                                            </button>
                                            <button onClick={() => setIsPreviewModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, overflow: 'auto', padding: '1rem', backgroundColor: '#f3f4f6' }}>
                                        <div style={{
                                            backgroundColor: 'white',
                                            padding: '2rem',
                                            width: printOrientation === 'landscape' ? '1100px' : '800px',
                                            margin: '0 auto',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                            transition: 'width 0.3s ease'
                                        }}
                                            dangerouslySetInnerHTML={{ __html: getReportHTML(previewData, printOrientation) }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};

export default OtherIncomesPage;
