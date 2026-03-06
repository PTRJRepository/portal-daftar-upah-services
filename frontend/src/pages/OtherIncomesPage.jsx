import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReportTable from '../components/common/ReportTable';
import { useReport } from '../context/ReportContext';
import { otherIncomesService } from '../services/otherIncomesService';
import { Save, Trash2, Plus, RefreshCw, AlertCircle, Calculator, Download, Settings, X, Filter, Printer, Eye, FileSpreadsheet, Check } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
    const [isLivePreview, setIsLivePreview] = useState(false);
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

    const getAsistensi = useCallback((gangCode) => {
        if (!gangCode || gangCode.length < 2) return null;
        const match = gangCode.match(/[A-Za-z](\d)/);
        return match ? match[1] : null;
    }, []);

    const availablePrefixes = useMemo(() => {
        const prefixes = new Set();
        gangs.forEach(g => {
            const a = getAsistensi(g.gang_code);
            if (a) prefixes.add(a);
        });
        return [...prefixes].sort();
    }, [gangs, getAsistensi]);

    const filteredGangs = useMemo(() => {
        if (!gangPrefix) return gangs;
        return gangs.filter(g => getAsistensi(g.gang_code) === gangPrefix);
    }, [gangs, gangPrefix, getAsistensi]);

    const fetchIncomes = useCallback(async () => {
        if (!division || gangLoading) return;
        setLoading(true);
        setError(null);
        setIsLivePreview(false);
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

    const handleLivePreviewTHR = async () => {
        setIsCalculating(true);
        setError(null);
        try {
            const result = await otherIncomesService.previewTHR(year, month, division, gang);
            if (result.success) {
                const previewData = result.data.map(r => ({ ...r, isPreview: true }));
                setRowData(previewData);
                setIsLivePreview(true);
            }
            else alert('Gagal: ' + (result.error || result.message));
        } catch (err) {
            console.error('Preview error:', err);
            alert('Kesalahan server saat kalkulasi live.');
        }
        finally { setIsCalculating(false); }
    };

    const handleBulkSaveTHR = async () => {
        const previewRows = rowData.filter(r => r.isPreview);
        if (previewRows.length === 0) return;
        if (!window.confirm(`Simpan ${previewRows.length} data kalkulasi THR ke database? Data lama akan diperbarui.`)) return;
        setIsSaving(true);
        try {
            const result = await otherIncomesService.bulkSave(previewRows);
            if (result.success) {
                alert(`Berhasil menyimpan ${result.count} data THR.`);
                await fetchIncomes();
            } else {
                alert('Gagal menyimpan data.');
            }
        } catch (err) {
            console.error('Bulk save error:', err);
            alert('Kesalahan server saat menyimpan.');
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID').format(val || 0);

    const getReportHTML = (data, orientation = 'landscape') => {
        const mName = getMonthName(month);
        const isPortrait = orientation === 'portrait';
        const baseFontSize = isPortrait ? '7px' : '9px';
        const headerFontSize = isPortrait ? '5.5px' : '7.5px';
        const footerFontSize = isPortrait ? '7px' : '10px';

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
                body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 0; margin: 0; font-size: ${baseFontSize}; background-color: white; color: #1e293b; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .report-container { width: 100%; padding: 8mm; }
                .header-section { text-align: center; margin-bottom: 12px; border-bottom: 2.5px solid #000; padding-bottom: 8px; }
                .company-name { font-size: 13px; font-weight: 700; color: #000; margin: 0; text-align: left; text-transform: uppercase; letter-spacing: 1px; }
                .report-title { font-size: 16px; font-weight: 800; margin: 4px 0; color: #000; text-transform: uppercase; letter-spacing: 0.5px; }
                .meta-grid { display: flex; justify-content: space-between; margin-top: 6px; font-size: 9px; font-weight: 600; color: #333; }
                .summary-cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; }
                .sum-card { flex: 1; min-width: 120px; border: 1px solid #000; padding: 6px 10px; background-color: #f8fafc; border-left: 4px solid #1a1a2e; }
                .sum-title { font-size: ${isPortrait ? '8px' : '9px'}; color: #475569; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
                .sum-val { font-size: ${isPortrait ? '11px' : '13px'}; font-weight: 800; color: #000; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #000; }
                th, td { border: 1px solid #666; padding: 3px 2px; text-align: left; word-wrap: break-word; overflow: hidden; font-size: ${baseFontSize}; }
                thead th { background-color: #1a1a2e !important; color: white !important; text-align: center; text-transform: uppercase; font-size: ${headerFontSize}; font-weight: 700; border: 0.5px solid #ccc; padding: 4px 2px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                tbody tr:nth-child(even) { background-color: #f5f5f5; }
                tfoot th, tfoot td { background-color: #1a1a2e !important; color: #ffd700 !important; font-weight: 800; font-size: ${footerFontSize}; border-top: 2.5px solid #000; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .text-right { text-align: right; padding-right: 3px; }
                .text-center { text-align: center; }
                .font-bold { font-weight: 700; }
                .proporsi-tag { color: #c00; font-weight: 700; font-size: 6px; background: #ffe0e0; padding: 1px 3px; border-radius: 2px; display: inline-block; border: 0.5px solid #c00; margin-top: 1px; }
                .kelayakan-tag { font-size: 6.5px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 1px 3px; border-radius: 2px; display: inline-block; border: 0.5px solid #d97706; }
                .emp-info { display: flex; flex-direction: column; line-height: 1.2; }
                .emp-name { font-weight: 700; color: #000; }
                .emp-sub { font-size: 0.85em; color: #555; }
                .signature-section { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                .sig-box { text-align: center; width: 28%; }
                .sig-title { font-weight: 600; color: #333; font-size: 9px; margin-bottom: 50px; }
                .sig-name { font-weight: 700; border-bottom: 1.5px solid #000; display: inline-block; min-width: 85%; color: #000; }
                .sig-role { font-size: 8px; font-weight: 600; color: #555; margin-top: 2px; }
                .col-no { width: 2.5%; }
                .col-sex { width: 2%; }
                .col-name { width: 16%; }
                .col-agama { width: 5%; }
                .col-tgl { width: 6%; }
                .col-hk { width: 2.5%; }
                .col-updasar { width: 7.5%; white-space: nowrap; }
                .col-uppokok { width: 8.5%; white-space: nowrap; }
                .col-brate { width: 5%; white-space: nowrap; }
                .col-bjml { width: 6.5%; white-space: nowrap; }
                .col-mkthn { width: 3%; }
                .col-mkjml { width: 6.5%; white-space: nowrap; }
                .col-kotor { width: 7.5%; white-space: nowrap; }
                .col-pajak { width: 5%; white-space: nowrap; }
                .col-kelayakan { width: 8%; }
                .col-bersih { width: 8.5%; white-space: nowrap; }
                @media print { .no-print { display: none; } @page { size: ${orientation}; margin: 6mm; } .report-container { padding: 0; } body { font-size: ${baseFontSize}; } }
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
                    <div class="sum-card"><div class="sum-title">Total Karyawan</div><div class="sum-val">${totalKaryawan} Orang</div></div>
                    <div class="sum-card"><div class="sum-title">Total THR (Kotor)</div><div class="sum-val">Rp ${formatCurrency(totalKotor)}</div></div>
                    <div class="sum-card"><div class="sum-title">Total THR (Bersih)</div><div class="sum-val">Rp ${formatCurrency(totalBersih)}</div></div>
                    <div class="sum-card"><div class="sum-title">Total Beras</div><div class="sum-val">Rp ${formatCurrency(totalBeras)}</div></div>
                    <div class="sum-card"><div class="sum-title">Total Masa Kerja</div><div class="sum-val">Rp ${formatCurrency(totalMasaKerja)}</div></div>
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
                            <th rowspan="3" class="col-uppokok">UPAH POKOK<br/>(30 HK)</th>
                            <th colspan="2">TUNJANGAN</th>
                            <th colspan="2">PENGABDIAN</th>
                            <th rowspan="3" class="col-kotor">UPAH<br/>KOTOR</th>
                            <th rowspan="3" class="col-pajak">PAJAK<br/>THR</th>
                            <th rowspan="3" class="col-kelayakan">KELAYAKAN<br/>THR</th>
                            <th rowspan="3" class="col-bersih">UPAH<br/>BERSIH</th>
                        </tr>
                        <tr>
                            <th colspan="2">BERAS</th>
                            <th colspan="2">MASA KERJA</th>
                        </tr>
                        <tr>
                            <th class="col-brate">RATE</th>
                            <th class="col-bjml">JUMLAH</th>
                            <th class="col-mkthn">THN</th>
                            <th class="col-mkjml">JUMLAH</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(() => {
                const gangGroups = {};
                data.forEach(row => {
                    const gc = row.gang_code || 'TANPA GANG';
                    if (!gangGroups[gc]) gangGroups[gc] = [];
                    gangGroups[gc].push(row);
                });
                const gangKeys = Object.keys(gangGroups).sort();
                const hasMultipleGangs = gangKeys.length > 1;
                let globalNo = 0;
                return gangKeys.map(gangCode => {
                    const gangRows = gangGroups[gangCode];
                    const gangKotor = gangRows.reduce((a, c) => a + (c.amount || 0), 0);
                    const gangPajak = gangRows.reduce((a, c) => a + (c.is_taxable ? Math.round(c.amount * 0.05) : 0), 0);
                    const gangBersih = gangKotor - gangPajak;
                    const gangHeader = hasMultipleGangs ? `<tr><td colspan="16" style="background-color:#e2e8f0; font-weight:800; font-size:${isPortrait ? '7.5px' : '10px'}; padding:5px 8px; border:1px solid #666; color:#1e293b;">GANG: ${gangCode} &nbsp;&nbsp;(${gangRows.length} Karyawan)</td></tr>` : '';
                    const rows = gangRows.map(row => {
                        globalNo++;
                        const vars = row.details?.variables || {};
                        const joinDate = vars.JOIN_DATE || row.join_date;
                        const masaKerjaThn = vars.MASA_KERJA_TAHUN || 0;
                        const upahKotor = row.amount || 0;
                        const pajak = row.is_taxable ? Math.round(upahKotor * 0.05) : 0;
                        const upahBersih = upahKotor - pajak;
                        const empCode = row.emp_code || vars.EMP_CODE || '-';
                        const rawReligion = row.religion || vars.RELIGION || '-';
                        const cleanReligion = rawReligion.replace(/^\d+\s+/, '');
                        let propLabel = ''; let kelayakanLabel = '';
                        if (vars.PROPORTION_FACTOR && vars.PROPORTION_FACTOR !== '12/12') {
                            propLabel = `<span class="proporsi-tag">PROP ${vars.PROPORTION_FACTOR}</span>`;
                            const wm = vars.WORKING_MONTHS || vars.PROPORTION_FACTOR.split('/')[0];
                            kelayakanLabel = `<span class="kelayakan-tag">Proporsi ${wm} bln (${vars.PROPORTION_FACTOR})</span>`;
                        } else if (row.income_name && row.income_name.includes('Proporsi')) {
                            const match = row.income_name.match(/Proporsi (\d+\/\d+)/);
                            if (match) {
                                propLabel = `<span class="proporsi-tag">PROP ${match[1]}</span>`;
                                kelayakanLabel = `<span class="kelayakan-tag">${match[1]}</span>`;
                            }
                        }
                        const displayGajiPokok = (vars.UPAH_DASAR || 0) * 30;
                        const displayBerasJumlah = (vars.BERAS_RATE || 0) * 30;
                        const displayMasaKerjaJumlah = (vars.MASA_KERJA_JUMLAH || 0);
                        return `<tr>
                                <td class="text-center">${globalNo}</td>
                                <td class="text-center">${vars.SEX || 'L'}</td>
                                <td><div class="emp-info"><span class="emp-name">${row.emp_name}</span><span class="emp-sub">${row.nik} | ${empCode}</span>${propLabel}</div></td>
                                <td class="text-center" style="font-size:0.85em">${cleanReligion}</td>
                                <td class="text-center">${joinDate ? new Date(joinDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                                <td class="text-right">${formatCurrency(vars.UPAH_DASAR)}</td>
                                <td class="text-right">${formatCurrency(displayGajiPokok)}</td>
                                <td class="text-right">${formatCurrency(vars.BERAS_RATE)}</td>
                                <td class="text-right">${formatCurrency(displayBerasJumlah)}</td>
                                <td class="text-center">${masaKerjaThn}</td>
                                <td class="text-right">${formatCurrency(displayMasaKerjaJumlah)}</td>
                                <td class="text-right font-bold">${formatCurrency(upahKotor)}</td>
                                <td class="text-right">${formatCurrency(pajak)}</td>
                                <td class="text-center">${kelayakanLabel}</td>
                                <td class="text-right font-bold" style="color:#1a365d">${formatCurrency(upahBersih)}</td>
                            </tr>`;
                    }).join('');
                    const gangSubtotal = hasMultipleGangs ? `<tr style="background-color:#fef3c7; font-weight:700; border-top:2px solid #000;"><td colspan="12" class="text-right" style="font-size:${isPortrait ? '6.5px' : '8.5px'}; padding:4px 6px;">SUBTOTAL ${gangCode} (${gangRows.length} karyawan)</td><td class="text-right" style="font-weight:800">${formatCurrency(gangKotor)}</td><td class="text-right">${formatCurrency(gangPajak)}</td><td></td><td class="text-right" style="font-weight:800; color:#1a365d">${formatCurrency(gangBersih)}</td></tr>` : '';
                    return gangHeader + rows + gangSubtotal;
                }).join('');
            })()}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="12" class="text-right">TOTAL KESELURUHAN (${data.length} Karyawan)</th>
                            <th class="text-right">${formatCurrency(data.reduce((a, c) => a + (c.amount || 0), 0))}</th>
                            <th class="text-right">${formatCurrency(data.reduce((a, c) => a + (c.is_taxable ? Math.round(c.amount * 0.05) : 0), 0))}</th>
                            <th></th>
                            <th class="text-right">${formatCurrency(data.reduce((a, c) => a + (c.amount - (c.is_taxable ? Math.round(c.amount * 0.05) : 0)), 0))}</th>
                        </tr>
                    .sig-box { text-align: center; width: 23%; }
                    ...
                    <div class="signature-section">
                        <div class="sig-box"><div class="sig-title">Dibuat Oleh,</div><div class="sig-name"></div><div class="sig-role">KTU / Kerani</div></div>
                        <div class="sig-box"><div class="sig-title">Diperiksa Oleh,</div><div class="sig-name"></div><div class="sig-role">Asisten Manager</div></div>
                        <div class="sig-box"><div class="sig-title">Diketahui Oleh,</div><div class="sig-name"></div><div class="sig-role">Estate Manager</div></div>
                        <div class="sig-box"><div class="sig-title">Disetujui Oleh,</div><div class="sig-name"></div><div class="sig-role">Senior Manager</div></div>
                    </div>

            </div>
        `;
    };

    const handlePrintReport = () => {
        let printData = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
        if (gangPrefix) printData = printData.filter(r => { const gc = r.gang_code || r.details?.variables?.GANG_CODE; return getAsistensi(gc) === gangPrefix; });
        if (printData.length === 0) return alert('Tidak ada data.');
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Laporan THR - ${division}</title></head><body>${getReportHTML(printData, printOrientation)}<script>window.onload = function() { window.print(); }</script></body></html>`);
        win.document.close();
    };

    const getBankListHTML = (data) => {
        const mName = getMonthName(month);
        const totalTransfer = data.reduce((a, c) => a + (c.amount - (c.is_taxable ? Math.round(c.amount * 0.05) : 0)), 0);
        const formatAmount = (val) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);
        const rowsPerPage = 35; const totalPages = Math.ceil(data.length / rowsPerPage);
        const pages = []; for (let i = 0; i < data.length; i += rowsPerPage) pages.push(data.slice(i, i + rowsPerPage));
        return `
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 0; margin: 0; font-size: 11px; color: #000; }
                .page { padding: 8mm 10mm; page-break-after: always; }
                .page:last-child { page-break-after: auto; }
                .header { margin-bottom: 8px; }
                .division-name { font-size: 16px; font-weight: 700; text-align: center; margin-bottom: 2px; }
                .header-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: 600; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; word-wrap: break-word; overflow: hidden; font-size: 11px; }
                thead th { background-color: #e8e8e8 !important; font-weight: 700; text-align: left; padding: 6px; border: 1px solid #999; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                tfoot td, tfoot th { font-weight: 700; border-top: 2px solid #000; }
                .col-no { width: 4%; } .col-bankno { width: 22%; } .col-amount { width: 18%; } .col-name { width: 30%; } .col-bankcode { width: 12%; } .col-empcode { width: 14%; }
                .signature-section { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                .sig-box { text-align: center; width: 23%; }
                .sig-title { font-weight: 600; color: #333; font-size: 10px; margin-bottom: 50px; }
                .sig-name { font-weight: 700; border-bottom: 1.5px solid #000; display: inline-block; min-width: 85%; color: #000; }
                .sig-role { font-size: 9px; font-weight: 600; color: #555; margin-top: 2px; }
                @media print { @page { size: portrait; margin: 8mm; } body { padding: 0; } .page { padding: 5mm 8mm; } }
            </style>
            ${pages.map((pageData, pageIndex) => `
            <div class="page">
                <div class="header">
                    <div class="division-name">${division === 'ALL' ? 'SEMUA UNIT' : division}</div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline">
                        <div style="font-size:11px; font-weight:600">Dept: D1</div>
                        <div style="font-size:13px; font-weight:700">${mName} ${year}</div>
                        <div style="text-align:right; font-size:10px; color:#333;">PAGE : ${pageIndex + 1} of ${totalPages}</div>
                    </div>
                </div>
                <table>
                    <thead><tr><th class="col-no">.</th><th class="col-bankno">Bank Acc. No.</th><th class="col-amount">Amount</th><th class="col-name">Employee Name</th><th class="col-bankcode">Bank Code</th><th class="col-empcode">Employee Code</th></tr></thead>
                    <tbody>${pageData.map((row, index) => {
            const upahBersih = (row.amount || 0) - (row.is_taxable ? Math.round((row.amount || 0) * 0.05) : 0);
            return `<tr><td class="text-center">${pageIndex * rowsPerPage + index + 1}</td><td>${row.bank_acc_no || row.details?.variables?.BANK_ACC_NO || ''}</td><td class="text-right">${formatAmount(upahBersih)}</td><td>${row.emp_name}</td><td class="text-center">${row.bank_code || row.details?.variables?.BANK_CODE || 'BRI'}</td><td class="text-center">${row.emp_code || row.details?.variables?.EMP_CODE || row.nik}</td></tr>`;
        }).join('')}</tbody>
                    ${pageIndex === pages.length - 1 ? `<tfoot><tr><td colspan="2" class="text-right" style="font-weight:700">TOTAL</td><td class="text-right" style="font-weight:700">${formatAmount(totalTransfer)}</td><td colspan="3" style="font-weight:700">${data.length} Karyawan</td></tr></tfoot>` : ''}
                </table>
                ${pageIndex === pages.length - 1 ? `
                <div class="signature-section">
                    <div class="sig-box"><div class="sig-title">Dibuat Oleh,</div><div class="sig-name"></div><div class="sig-role">KTU / Kerani</div></div>
                    <div class="sig-box"><div class="sig-title">Diperiksa Oleh,</div><div class="sig-name"></div><div class="sig-role">Asisten Manager</div></div>
                    <div class="sig-box"><div class="sig-title">Diketahui Oleh,</div><div class="sig-name"></div><div class="sig-role">Estate Manager</div></div>
                    <div class="sig-box"><div class="sig-title">Disetujui Oleh,</div><div class="sig-name"></div><div class="sig-role">Senior Manager</div></div>
                </div>` : ''}
            </div>`).join('')}
        `;
    };

    const handlePrintBankList = () => {
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>Bank List - THR</title></head><body>${getBankListHTML(displayData)}<script>window.onload = function() { window.print(); }</script></body></html>`);
        win.document.close();
    };

    const handleExportExcelTHR = async () => {
        let exportData = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
        if (gangPrefix) exportData = exportData.filter(r => { const gc = r.gang_code || r.details?.variables?.GANG_CODE; return getAsistensi(gc) === gangPrefix; });
        if (exportData.length === 0) return alert('Tidak ada data.');
        const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Laporan THR');
        ws.columns = [
            { header: 'NO', key: 'no', width: 5 }, { header: 'L/P', key: 'sex', width: 5 }, { header: 'NAMA KARYAWAN', key: 'nama', width: 25 }, { header: 'NIK', key: 'nik', width: 15 }, { header: 'CODE', key: 'code', width: 12 }, { header: 'AGAMA', key: 'agama', width: 12 }, { header: 'TGL MASUK', key: 'tgl_masuk', width: 14 },
            { header: 'UPAH DASAR (Rp)', key: 'upah_dasar', width: 16 }, { header: 'UPAH POKOK (Rp)', key: 'upah_pokok', width: 16 }, { header: 'BERAS RATE (Rp)', key: 'beras_rate', width: 14 }, { header: 'BERAS JML (Rp)', key: 'beras_jml', width: 14 }, { header: 'MASA KERJA THN', key: 'mk_thn', width: 10 }, { header: 'MASA KERJA JML (Rp)', key: 'mk_jml', width: 16 }, { header: 'UPAH KOTOR (Rp)', key: 'upah_kotor', width: 16 }, { header: 'PAJAK THR (Rp)', key: 'pajak', width: 14 }, { header: 'KELAYAKAN THR', key: 'kelayakan', width: 22 }, { header: 'UPAH BERSIH (Rp)', key: 'upah_bersih', width: 16 },
        ];
        ws.getRow(1).eachCell(cell => { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F7FA' } }; cell.alignment = { horizontal: 'center' }; });
        exportData.forEach((row, i) => {
            const vars = row.details?.variables || {}; const upahKotor = row.amount || 0; const pajak = row.is_taxable ? Math.round(upahKotor * 0.05) : 0;
            let kelStr = ''; if (vars.PROPORTION_FACTOR && vars.PROPORTION_FACTOR !== '12/12') kelStr = `Proporsi ${vars.WORKING_MONTHS || vars.PROPORTION_FACTOR.split('/')[0]} bln (${vars.PROPORTION_FACTOR})`;
            ws.addRow({ no: i + 1, sex: vars.SEX || 'L', nama: row.emp_name, nik: row.nik, code: row.emp_code || vars.EMP_CODE || '-', agama: (row.religion || vars.RELIGION || '-').replace(/^\d+\s+/, ''), tgl_masuk: vars.JOIN_DATE ? new Date(vars.JOIN_DATE).toLocaleDateString('id-ID') : '-', upah_dasar: vars.UPAH_DASAR || 0, upah_pokok: (vars.UPAH_DASAR || 0) * 30, beras_rate: vars.BERAS_RATE || 0, beras_jml: (vars.BERAS_RATE || 0) * 30, mk_thn: vars.MASA_KERJA_TAHUN || 0, mk_jml: vars.MASA_KERJA_JUMLAH || 0, upah_kotor: upahKotor, pajak: pajak, kelayakan: kelStr, upah_bersih: upahKotor - pajak });
        });
        ['upah_dasar', 'upah_pokok', 'beras_rate', 'beras_jml', 'mk_jml', 'upah_kotor', 'pajak', 'upah_bersih'].forEach(k => ws.getColumn(k).numFmt = '#,##0');
        const buffer = await wb.xlsx.writeBuffer(); saveAs(new Blob([buffer]), `Laporan_THR_${division}_${getMonthName(month)}_${year}.xlsx`);
    };

    const handleExportExcelBankList = async () => {
        if (displayData.length === 0) return alert('Tidak ada data.');
        const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Bank List THR');
        ws.columns = [{ header: 'No.', key: 'no', width: 6 }, { header: 'Bank Acc. No.', key: 'bank_acc', width: 24 }, { header: 'Amount', key: 'amount', width: 18 }, { header: 'Employee Name', key: 'emp_name', width: 30 }, { header: 'Bank Code', key: 'bank_code', width: 14 }, { header: 'Employee Code', key: 'emp_code', width: 16 }];
        ws.getRow(1).eachCell(cell => { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8E8E8' } }; });
        displayData.forEach((row, i) => {
            const upahBersih = (row.amount || 0) - (row.is_taxable ? Math.round((row.amount || 0) * 0.05) : 0);
            ws.addRow({ no: i + 1, bank_acc: row.bank_acc_no || row.details?.variables?.BANK_ACC_NO || '', amount: upahBersih, emp_name: row.emp_name, bank_code: row.bank_code || row.details?.variables?.BANK_CODE || 'BRI', emp_code: row.emp_code || row.details?.variables?.EMP_CODE || row.nik });
        });
        ws.getColumn('amount').numFmt = '#,##0.00';
        const buffer = await wb.xlsx.writeBuffer(); saveAs(new Blob([buffer]), `BankList_THR_${division}_${getMonthName(month)}_${year}.xlsx`);
    };

    const reportColumns = useMemo(() => [
        { field: '_no', headers: ['NO.\nURUT', null, null], w: 60, className: 'text-center', sticky: true, left: 0, valueGetter: (row) => row._no },
        { field: 'sex', headers: ['L/P', null, null], w: 45, className: 'text-center', sticky: true, left: 60, valueGetter: (row) => row.details?.variables?.SEX || 'L' },
        {
            field: 'emp_name', headers: ['NAMA KARYAWAN', null, null], w: 200, className: 'text-left', sticky: true, left: 105,
            render: (row) => (
                <div style={{ opacity: row.isPreview ? 0.7 : 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{row.emp_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{row.nik} {row.emp_code ? `| ${row.emp_code}` : ''}</div>
                    {row.isPreview && <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: '3px', marginTop: '2px', display: 'inline-block' }}>Live Preview</span>}
                </div>
            )
        },
        { field: 'income_name', headers: ['TIPE & DESKRIPSI', null, null], w: 180, className: 'text-left', render: (row) => (<div><span style={{ fontSize: '0.75rem', padding: '2px 4px', backgroundColor: row.income_type === 'THR' ? '#fef3c7' : '#f1f5f9', borderRadius: '4px', marginRight: '4px' }}>{row.income_type}</span><span style={{ fontSize: '0.8rem' }}>{row.income_name}</span></div>) },
        { field: 'join_date', headers: ['TANGGAL MASUK\nKERJA', null, null], w: 120, className: 'text-center', valueGetter: (row) => { const jd = row.details?.variables?.JOIN_DATE || row.join_date; return jd ? new Date(jd).toLocaleDateString('id-ID') : '-'; } },
        { field: 'details.variables.UPAH_DASAR', headers: ['UPAH\nDASAR\n(Rp)', null, null], w: 120, className: 'text-right', format: 'currency' },
        { field: 'upah_pokok', headers: ['UPAH\nPOKOK\n(30 HK)', null, null], w: 120, className: 'text-right', format: 'currency', valueGetter: (row) => (row.details?.variables?.UPAH_DASAR || 0) * 30 },
        { field: 'details.variables.BERAS_RATE', headers: ['TUNJANGAN / PREMI', 'BERAS', '(Rp)/\nHK'], w: 90, className: 'text-right', format: 'currency' },
        { field: 'beras_jml', headers: ['TUNJANGAN / PREMI', 'BERAS', 'Jumlah\n(Rp)'], w: 110, className: 'text-right', format: 'currency', valueGetter: (row) => (row.details?.variables?.BERAS_RATE || 0) * 30 },
        { field: 'details.variables.MASA_KERJA_TAHUN', headers: ['TUNJANGAN / PREMI', 'masa', 'THN'], w: 55, className: 'text-center' },
        { field: 'details.variables.MASA_KERJA_JUMLAH', headers: ['TUNJANGAN / PREMI', 'masa', 'JUMLAH\n(Rp)'], w: 110, className: 'text-right', format: 'currency' },
        { field: 'amount', headers: ['JUMLAH\nUPAH KOTOR\n(Rp)', null, null], w: 140, className: 'text-right font-bold', format: 'currency' },
        { field: 'pajak_thr', headers: ['PAJAK\nTHR', null, null], w: 100, className: 'text-right', format: 'currency', valueGetter: (row) => row.is_taxable ? Math.round((row.amount || 0) * 0.05) : 0 },
        { field: 'kelayakan', headers: ['KELAYAKAN\nTHR', null, null], w: 130, className: 'text-center', render: (row) => { const vars = row.details?.variables || {}; if (vars.PROPORTION_FACTOR && vars.PROPORTION_FACTOR !== '12/12') { return (<span style={{ fontSize: '0.7rem', padding: '2px 5px', backgroundColor: '#fef3c7', borderRadius: '4px', border: '1px solid #d97706', color: '#b45309', fontWeight: 600 }}>Proporsi {vars.WORKING_MONTHS || vars.PROPORTION_FACTOR.split('/')[0]} bln ({vars.PROPORTION_FACTOR})</span>); } return ''; } },
        { field: 'upah_bersih', headers: ['JUMLAH\nUPAH BERSIH\n(Rp)', null, null], w: 150, className: 'text-right font-bold', format: 'currency', valueGetter: (row) => (row.amount || 0) - (row.is_taxable ? Math.round((row.amount || 0) * 0.05) : 0) },
        { field: '_aksi', headers: ['AKSI', null, null], w: 60, className: 'text-center', render: (row) => (<div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>{row.isNew && <button onClick={() => handleSaveNew(row)} style={{ border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={14} /></button>}<button onClick={() => handleDelete(row)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button></div>) }
    ], []);

    const displayData = useMemo(() => {
        let filtered = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
        if (gangPrefix) { filtered = filtered.filter(r => { const gc = r.gang_code || r.details?.variables?.GANG_CODE; return getAsistensi(gc) === gangPrefix; }); }
        return filtered.map((row, i) => ({ ...row, _no: i + 1, _id: row.id || `row-${i}` }));
    }, [rowData, filterReligion, gangPrefix, getAsistensi]);

    const footerData = useMemo(() => {
        const totalKotor = displayData.reduce((a, c) => a + (c.amount || 0), 0);
        const totalPajak = displayData.reduce((a, c) => a + (c.is_taxable ? Math.round((c.amount || 0) * 0.05) : 0), 0);
        return { amount: totalKotor, pajak_thr: totalPajak, upah_bersih: totalKotor - totalPajak };
    }, [displayData]);

    return (
        <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            {reportView === 'BANK_LIST' ? (
                <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><button onClick={() => setReportView('MAIN')} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><X size={16} /> Kembali</button><h2 style={{ margin: 0, fontSize: '1.2rem' }}>Preview List Pembayaran Bank</h2></div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}><button onClick={handleExportExcelBankList} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><FileSpreadsheet size={16} /> Export Excel</button><button onClick={handlePrintBankList} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Printer size={16} /> Cetak List Bank</button></div>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '2rem', backgroundColor: '#f3f4f6' }}><div style={{ backgroundColor: 'white', padding: '3rem', width: '900px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} dangerouslySetInnerHTML={{ __html: getBankListHTML(displayData) }} /></div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div><h1 style={{ margin: 0, fontSize: '1.4rem' }}>Laporan THR</h1><p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Daftar Pembayaran Tunjangan Hari Raya</p></div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '0.4rem', borderRadius: '4px' }}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Bulan {i + 1}</option>)}</select><input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '0.4rem', width: '80px', borderRadius: '4px' }} /></div>
                    </div>
                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><select value={division} onChange={e => { setDivision(e.target.value); setGangPrefix(''); }} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}><option value="ALL">SEMUA DIVISI</option>{allDivisions.map(d => <option key={d} value={d}>{d}</option>)}</select><select value={gangPrefix} onChange={e => setGangPrefix(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: `1px solid ${gangPrefix ? '#93c5fd' : '#cbd5e1'}`, backgroundColor: gangPrefix ? '#eff6ff' : 'white', fontWeight: gangPrefix ? 600 : 400 }}><option value="">SEMUA GROUP</option>{availablePrefixes.map(p => <option key={p} value={p}>Group {p}</option>)}</select><select value={gang} onChange={e => setGang(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}><option value="ALL">SEMUA GANG{gangPrefix ? ` (Group ${gangPrefix})` : ''}</option>{filteredGangs.map(g => <option key={g.gang_code} value={g.gang_code}>{g.gang_code}</option>)}</select><select value={filterReligion} onChange={e => setFilterReligion(e.target.value)} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>{RELIGION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>{isLivePreview && (<button onClick={handleBulkSaveTHR} disabled={isSaving} style={{ padding: '0.4rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}><Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan ke Database'}</button>)}<button onClick={handleLivePreviewTHR} disabled={loading || isCalculating} style={{ padding: '0.4rem 0.8rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calculator size={16} /> Kalkulasi Live</button><button onClick={fetchIncomes} disabled={loading || isCalculating} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><RefreshCw size={16} className={loading ? 'spin' : ''} /> {isLivePreview ? 'Batalkan' : 'Refresh'}</button><div style={{ width: '1px', background: '#e2e8f0', margin: '0 4px' }}></div><button onClick={() => setReportView('BANK_LIST')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Printer size={16} /> Bank List</button><button onClick={() => setIsPreviewModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}><Eye size={16} /> Preview Print</button><button onClick={handleExportExcelTHR} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><FileSpreadsheet size={16} /> Export</button></div>
                        </div>
                        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>{(isCalculating || isSaving) && (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}><RefreshCw size={48} className="spin" style={{ color: isSaving ? '#10b981' : '#f59e0b', marginBottom: '1rem' }} /><h3 style={{ margin: 0 }}>{isSaving ? 'Menyimpan ke Database...' : 'Mengkalkulasi THR...'}</h3><p style={{ color: '#64748b' }}>Mohon tunggu sebentar.</p></div>)}{isLivePreview && (<div style={{ padding: '0.5rem 1rem', background: '#fffbeb', borderBottom: '1px solid #fef3c7', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertCircle size={14} /> <strong>Mode Pratinjau:</strong> Data di bawah adalah hasil kalkulasi sistem terbaru. Tekan tombol <strong>Simpan ke Database</strong> untuk mempermanenkan.</div>)}<ReportTable columns={reportColumns} data={displayData} footerData={displayData.length > 0 ? footerData : null} footerLabel="TOTAL KESELURUHAN" footerLabelColSpan={11} statusBar={<><strong>Total:</strong> {displayData.length} karyawan</>} /></div>
                    </div>
                    {isPreviewModalOpen && (() => {
                        let previewData = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
                        if (gangPrefix) previewData = previewData.filter(r => { const gc = r.gang_code || r.details?.variables?.GANG_CODE; return getAsistensi(gc) === gangPrefix; });
                        return (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', padding: '2rem' }}><div style={{ backgroundColor: 'white', flex: 1, borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}><h2 style={{ margin: 0 }}>Preview Laporan THR</h2><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}><span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Orientasi:</span><select value={printOrientation} onChange={e => setPrintOrientation(e.target.value)} style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></div></div><div style={{ display: 'flex', gap: '0.5rem' }}><button onClick={() => { const win = window.open('', '_blank'); win.document.write(`<html><head><title>Laporan THR - ${division}</title></head><body>${getReportHTML(previewData, printOrientation)}<script>window.onload = function() { window.print(); }</script></body></html>`); win.document.close(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Download size={16} /> Simpan PDF</button><button onClick={handleExportExcelTHR} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><FileSpreadsheet size={16} /> Export Excel</button><button onClick={handlePrintReport} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Printer size={16} /> Cetak PDF</button><button onClick={() => setIsPreviewModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button></div></div><div style={{ flex: 1, overflow: 'auto', padding: '1rem', backgroundColor: '#f3f4f6' }}><div style={{ backgroundColor: 'white', padding: '2rem', width: printOrientation === 'landscape' ? '1100px' : '800px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'width 0.3s ease' }} dangerouslySetInnerHTML={{ __html: getReportHTML(previewData, printOrientation) }} /></div></div></div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};

export default OtherIncomesPage;
