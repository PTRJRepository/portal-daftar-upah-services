import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReportTable from '../components/common/ReportTable';
import { useReport } from '../context/ReportContext';
import { otherIncomesService } from '../services/otherIncomesService';
import { Save, Trash2, RefreshCw, Calculator, X, Printer, Eye } from 'lucide-react';

const OtherIncomesPage = ({ initialMonth, initialYear, initialDivision }) => {
    const {
        division, gang, month, year,
        setDivision, setGang, setMonth, setYear,
        allDivisions, gangs, gangLoading,
        gangPrefix, setGangPrefix
    } = useReport();

    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isLivePreview, setIsLivePreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [filterReligion, setFilterReligion] = useState('01 Islam');
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [printOrientation, setPrintOrientation] = useState('landscape');
    const [previewType, setPreviewType] = useState('MAIN');

    const RELIGION_OPTIONS = [
        { value: 'ALL', label: 'Semua Agama' },
        { value: '01 Islam', label: '01 Islam' },
        { value: '02 Katolik', label: '02 Katolik' },
        { value: '03 Protestan', label: '03 Protestan' },
        { value: '04 Hindu', label: '04 Hindu' },
        { value: '05 Budha', label: '05 Budha' },
        { value: '06 Konghucu', label: '06 Konghucu' }
    ];

    const getMonthName = (m) => ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][m - 1] || "";

    const getAsistensi = useCallback((gangCode) => {
        if (!gangCode) return "1";
        const gc = gangCode.trim().toUpperCase();
        if (gc.startsWith('K2')) return "1";
        const match = gc.match(/\d+/);
        return match ? match[0] : "1";
    }, []);

    const availablePrefixes = useMemo(() => {
        const prefixes = new Set();
        gangs.forEach(g => { prefixes.add(getAsistensi(g.gang_code)); });
        return [...prefixes].sort();
    }, [gangs, getAsistensi]);

    const filteredGangs = useMemo(() => (!gangPrefix ? gangs : gangs.filter(g => getAsistensi(g.gang_code) === gangPrefix)), [gangs, gangPrefix, getAsistensi]);

    const fetchIncomes = useCallback(async () => {
        if (!division || gangLoading) return;
        setLoading(true);
        setIsLivePreview(false);
        try {
            const data = await otherIncomesService.getIncomes(year, month, division, gang);
            setRowData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [year, month, division, gang, gangLoading]);

    useEffect(() => {
        fetchIncomes();
    }, [fetchIncomes]);

    useEffect(() => {
        if (initialMonth !== undefined) setMonth(initialMonth);
        if (initialYear !== undefined) setYear(initialYear);
        if (initialDivision !== undefined) setDivision(initialDivision);
    }, [initialMonth, initialYear, initialDivision, setMonth, setYear, setDivision]);

    const handleDelete = async (d) => {
        if (!d.id) { setRowData(p => p.filter(r => r !== d)); return; }
        if (window.confirm(`Hapus data ${d.emp_name}?`)) {
            try { await otherIncomesService.deleteIncome(d.id); setRowData(p => p.filter(r => r.id !== d.id)); }
            catch (e) { alert('Gagal menghapus.'); }
        }
    };

    const handleLivePreviewTHR = async () => {
        setIsCalculating(true);
        try {
            const r = await otherIncomesService.previewTHR(year, month, division, gang);
            if (r.success) {
                setRowData(r.data.map(x => ({ ...x, isPreview: true })));
                setIsLivePreview(true);
            } else {
                alert('Gagal: ' + (r.error || r.message));
            }
        } catch (e) {
            alert('Kesalahan server.');
        } finally {
            setIsCalculating(false);
        }
    };

    const handleBulkSaveTHR = async () => {
        const rows = rowData.filter(r => r.isPreview);
        if (!rows.length) return;
        if (!window.confirm(`Simpan ${rows.length} data THR?`)) return;
        setIsSaving(true);
        try {
            const r = await otherIncomesService.bulkSave(rows);
            if (r.success) {
                alert('Berhasil!');
                await fetchIncomes();
            }
        } catch (e) {
            alert('Kesalahan');
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID').format(val || 0);

    const getSigs = () => `
        <div style="margin-top:35px; display:flex; justify-content:space-between; page-break-inside:avoid; text-align:center;">
            <div style="width:23%"><div>Dibuat Oleh,</div><div style="height:55px; border-bottom:1pt solid #000; width:85%; margin:0 auto 5px;"></div><div style="font-weight:bold; text-transform:uppercase; font-size:0.85em;">( .................... )</div><div style="font-size:0.8em;">KTU / Kerani</div></div>
            <div style="width:23%"><div>Diperiksa Oleh,</div><div style="height:55px; border-bottom:1pt solid #000; width:85%; margin:0 auto 5px;"></div><div style="font-weight:bold; text-transform:uppercase; font-size:0.85em;">( .................... )</div><div style="font-size:0.8em;">Asisten</div></div>
            <div style="width:23%"><div>Mengetahui,</div><div style="height:55px; border-bottom:1pt solid #000; width:85%; margin:0 auto 5px;"></div><div style="font-weight:bold; text-transform:uppercase; font-size:0.85em;">( .................... )</div><div style="font-size:0.8em;">Estate Manager</div></div>
            <div style="width:23%"><div>Disetujui Oleh,</div><div style="height:55px; border-bottom:1pt solid #000; width:85%; margin:0 auto 5px;"></div><div style="font-weight:bold; text-transform:uppercase; font-size:0.85em;">( .................... )</div><div style="font-size:0.8em;">Senior Manager</div></div>
        </div>`;

    const getReportHTML = (data, orient = 'landscape') => {
        // THR usually targets the next month's holiday, so we display month + 1
        const displayMonth = month === 12 ? 1 : month + 1;
        const displayYear = month === 12 ? year + 1 : year;
        const mName = getMonthName(displayMonth);
        const isPortrait = orient === 'portrait';
        const fs = isPortrait ? '7pt' : '8pt';

        const groupedData = {};
        let totalPenuh = 0;
        let totalProporsi = 0;
        let totalMasaKerja = 0;
        let totalBeras = 0;

        data.forEach(item => {
            const grp = getAsistensi(item.gang_code);
            const gcode = item.gang_code || 'TANPA GANG';
            if (!groupedData[grp]) groupedData[grp] = {};
            if (!groupedData[grp][gcode]) groupedData[grp][gcode] = [];
            groupedData[grp][gcode].push(item);

            const v = item.details?.variables || {};
            if (v.PROPORTION_FACTOR && v.PROPORTION_FACTOR !== '12/12') {
                totalProporsi++;
            } else {
                totalPenuh++;
            }
            totalMasaKerja += (v.MASA_KERJA_JUMLAH || 0);
            totalBeras += ((v.BERAS_RATE || item.beras_rate || 0) * 30);
        });
        const groupKeys = Object.keys(groupedData).sort();

        return `
            <style>
                @page { size: ${orient}; margin: 8mm 5mm 8mm 5mm; } 
                body { font-family: 'Arial Narrow', sans-serif; font-size: ${fs}; color: #000; margin: 0; padding: 0; line-height: 1.1; display: block;}
                .header-container { display: flex; align-items: center; border-bottom: 2pt solid #000; padding-bottom: 5px; margin-bottom: 10px; }
                .logo { width: 50px; height: 50px; object-fit: contain; margin-right: 15px; }
                .co { font-weight: bold; text-transform: uppercase; font-size: 1.2em; }
                .tit { text-align: center; font-weight: 800; font-size: 1.4em; margin: 0 0 10px 0; text-transform: uppercase; }
                .summary-cards { display: flex; gap: 8px; margin-bottom: 15px; page-break-inside: avoid; }
                .card { flex: 1; border: 1pt solid #000; padding: 5px; text-align: center; background: #fff; -webkit-print-color-adjust: exact; box-shadow: 2px 2px 0px rgba(0,0,0,0.1); }
                .card-title { font-size: 0.85em; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 3px; }
                .card-value { font-size: 1.2em; font-weight: 900; color: #000; }
                .card-sub { font-size: 0.75em; color: #666; margin-top: 2px; }
                .meta { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; border: 1pt solid #000; padding: 5px; background: #eee; -webkit-print-color-adjust: exact; }
                table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5pt solid #000; }
                th, td { border: 0.5pt solid #000; padding: 3px 2px; overflow: hidden; word-wrap: break-word; }
                thead th { background-color: #000 !important; color: #fff !important; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; font-size: 0.85em; }
                tbody tr:nth-child(even) { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
                .tr { text-align: right; white-space: nowrap; } .tc { text-align: center; } .fb { font-weight: bold; }
                .prp { font-size: 0.75em; font-weight: bold; background-color: #ef4444; color: #fff; padding: 2px 4px; border-radius: 3px; display: inline-block; margin-top: 3px; -webkit-print-color-adjust: exact; }
                tfoot th { background-color: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact; }
                .gh { background-color: #e2e8f0; font-weight: 800; text-align: left; padding: 4px 6px; border: 1pt solid #000; }
                .gang-sub { background-color: #f9fafb; font-weight: bold; font-style: italic; }
            </style>
            
            <div class="header-container">
                <img src="/logo.png" class="logo" alt="Logo" onerror="this.style.display='none'" />
                <div class="co">PT. REBINMAS JAYA</div>
            </div>
            
            <div class="tit">DAFTAR PEMBAYARAN TUNJANGAN HARI RAYA (THR)</div>
            
            <div class="summary-cards">
                <div class="card">
                    <div class="card-title">Total Karyawan</div>
                    <div class="card-value">${data.length}</div>
                    <div class="card-sub">Orang</div>
                </div>
                <div class="card">
                    <div class="card-title">Status THR</div>
                    <div class="card-value">${totalPenuh} <span style="font-size:0.75em;font-weight:normal">Penuh</span></div>
                    <div class="card-sub">${totalProporsi} Proporsi</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Tunj. Masa Kerja</div>
                    <div class="card-value">${formatCurrency(totalMasaKerja)}</div>
                    <div class="card-sub">Rupiah</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Tunj. Beras</div>
                    <div class="card-value">${formatCurrency(totalBeras)}</div>
                    <div class="card-sub">Rupiah</div>
                </div>
            </div>

            <div class="meta"><span>Periode THR: ${mName} ${displayYear}</span><span>Unit: ${division}</span><span>Gang: ${gang === 'ALL' ? 'SEMUA' : gang}</span></div>
            
            <table>
                <thead>
                    <tr><th rowspan="3" style="width:25px">NO</th><th rowspan="3" style="width:20px">L/P</th><th rowspan="3">NAMA KARYAWAN / NIK</th><th rowspan="3" style="width:45px">AGAMA</th><th rowspan="3" style="width:60px">TGL MASUK</th><th rowspan="3" style="width:65px">UPAH DASAR</th><th rowspan="3" style="width:65px">UPAH POKOK<br/>(30 HK)</th><th colspan="2">TUNJANGAN</th><th colspan="2">MASA KERJA</th><th rowspan="3" style="width:70px">UPAH KOTOR</th><th rowspan="3" style="width:55px">PAJAK THR</th><th rowspan="3" style="width:60px">KELAYAKAN</th><th rowspan="3" style="width:75px">UPAH BERSIH</th></tr>
                    <tr><th colspan="2">BERAS</th><th colspan="2">PENGABDIAN</th></tr>
                    <tr><th style="width:45px">RATE</th><th style="width:55px">JUMLAH</th><th style="width:25px">THN</th><th style="width:55px">JUMLAH</th></tr>
                </thead>
                <tbody>
                    ${groupKeys.map(gk => {
            const gangsInGroup = groupedData[gk];
            const gangKeys = Object.keys(gangsInGroup).sort();
            let groupKotor = 0; let groupPajak = 0;
            const gangRows = gangKeys.map(gcode => {
                const items = gangsInGroup[gcode];
                const subKotor = items.reduce((a, c) => a + (Number(c.amount) || 0), 0);
                const subPajak = 0; // THR tidak ada pajak
                groupKotor += subKotor; groupPajak += subPajak;
                return `
                                <tr><td colspan="15" style="background:#f8fafc; font-weight:700; padding-left:15px; border:1pt solid #000; -webkit-print-color-adjust: exact;">GANG: ${gcode}</td></tr>
                                ${items.map((r, i) => {
                    const v = r.details?.variables || {}; const k = Number(r.amount) || 0; const p = 0; // THR tidak ada pajak
                    const pr = v.PROPORTION_FACTOR; const hasPrp = pr && pr !== '12/12';
                    const propLabel = hasPrp ? `<span class="prp">${pr}</span>` : 'PENUH';
                    return `<tr><td class="tc">${i + 1}</td><td class="tc">${v.SEX || 'L'}</td><td><b>${r.emp_name}</b><br/><small>${r.nik}</small>${hasPrp ? `<br/><span class="prp">PROP ${pr}</span>` : ''}</td><td class="tc">${(r.religion || '').replace(/^\d+\s+/, '')}</td><td class="tc">${v.JOIN_DATE ? new Date(v.JOIN_DATE).toLocaleDateString('id-ID') : '-'}</td><td class="tr">${formatCurrency(v.UPAH_DASAR)}</td><td class="tr">${formatCurrency((v.UPAH_DASAR || 0) * 30)}</td><td class="tr">${formatCurrency(v.BERAS_RATE)}</td><td class="tr">${formatCurrency((v.BERAS_RATE || 0) * 30)}</td><td class="tc">${v.MASA_KERJA_TAHUN || 0}</td><td class="tr">${formatCurrency(v.MASA_KERJA_JUMLAH)}</td><td class="tr fb">${formatCurrency(k)}</td><td class="tr">${formatCurrency(p)}</td><td class="tc"><small>${propLabel}</small></td><td class="tr fb">${formatCurrency(k - p)}</td></tr>`;
                }).join('')}
                                <tr class="gang-sub"><td colspan="11" class="tr">SUBTOTAL GANG ${gcode}</td><td class="tr">${formatCurrency(subKotor)}</td><td class="tr">-</td><td></td><td class="tr">${formatCurrency(subKotor)}</td></tr>
                            `;
            }).join('');
            return `<tr><td colspan="15" class="gh">GROUP ASISTENSI: ${gk}</td></tr>${gangRows}<tr style="background-color:#fef3c7; font-weight:bold; -webkit-print-color-adjust: exact;"><td colspan="11" class="tr">SUBTOTAL GROUP ${gk}</td><td class="tr">${formatCurrency(groupKotor)}</td><td class="tr">-</td><td></td><td class="tr">${formatCurrency(groupKotor)}</td></tr>`;
        }).join('')}
                </tbody>
                <tfoot><tr><th colspan="11" class="tr">TOTAL KESELURUHAN (Rp)</th><th class="tr">${formatCurrency(data.reduce((a, c) => a + (Number(c.amount) || 0), 0))}</th><th class="tr">-</th><th></th><th class="tr">${formatCurrency(data.reduce((a, c) => a + (Number(c.amount) || 0), 0))}</th></tr></tfoot>
            </table>${getSigs()}`;
    };

    const getBankListHTML = (data) => {
        const displayMonth = month === 12 ? 1 : month + 1;
        const displayYear = month === 12 ? year + 1 : year;
        const mName = getMonthName(displayMonth);

        const groupedData = {};
        data.forEach(item => {
            const grp = getAsistensi(item.gang_code);
            if (!groupedData[grp]) groupedData[grp] = [];
            groupedData[grp].push(item);
        });
        const groupKeys = Object.keys(groupedData).sort();

        return `
        <style>
            @page { size: portrait; margin: 10mm; } 
            body { font-family: 'Arial Narrow', sans-serif; font-size: 10pt; color: #000; } 
            .tit { text-align: center; font-weight: bold; font-size: 1.4em; margin-bottom: 5px; text-transform: uppercase; } 
            .sub-tit { text-align: center; font-size: 1.1em; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; } 
            th, td { border: 1pt solid #000; padding: 5px; } 
            thead th { background-color: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact; } 
            .tr { text-align: right; white-space: nowrap; } 
            .tc { text-align: center; }
            .gh { background-color: #e2e8f0; font-weight: 800; text-align: left; padding: 6px; border: 1pt solid #000; -webkit-print-color-adjust: exact;}
            .gs-tot { background-color: #f8fafc; font-weight: bold; font-style: italic; -webkit-print-color-adjust: exact;}
        </style>
        <div class="tit">LIST PEMBAYARAN BANK - THR</div>
        <div class="sub-tit">PERIODE: ${mName.toUpperCase()} ${displayYear} | UNIT: ${division}</div>
        <table>
            <thead><tr><th style="width:40px">NO</th><th>NAMA KARYAWAN / NIK / EMPCODE</th><th style="width:150px">NO REKENING</th><th style="width:80px">BANK</th><th style="width:120px">JUMLAH (Rp)</th></tr></thead>
            <tbody>
                ${groupKeys.map(gk => {
            const items = groupedData[gk];
            const subTotal = items.reduce((a, c) => a + (Number(c.amount) || 0), 0); // Tidak ada pajak THR

            const rows = items.map((r, i) => {
                const netPay = Number(r.amount); // THR tidak ada pajak
                const empCodeStr = r.emp_code || r.details?.variables?.EMP_CODE || '-';
                return `<tr><td class="tc">${i + 1}</td><td><b>${r.emp_name}</b><br/><small>${r.nik} | ${empCodeStr}</small></td><td class="tc">${r.bank_acc_no || r.details?.variables?.BANK_ACC_NO || '-'}</td><td class="tc">${r.bank_code || r.details?.variables?.BANK_CODE || 'BRI'}</td><td class="tr">${formatCurrency(netPay)}</td></tr>`;
            }).join('');

            return `
                        <tr><td colspan="5" class="gh">GROUP ASISTENSI: ${gk}</td></tr>
                        ${rows}
                        <tr class="gs-tot"><td colspan="4" class="tr">SUBTOTAL GROUP ${gk}</td><td class="tr">${formatCurrency(subTotal)}</td></tr>
                    `;
        }).join('')}
            </tbody>
            <tfoot><tr><th colspan="4" class="tr">TOTAL TRANSFER KESELURUHAN</th><th class="tr">${formatCurrency(data.reduce((a, c) => a + (Number(c.amount) || 0), 0))}</th></tr></tfoot>
        </table>${getSigs()}`;
    };

    const reportColumns = useMemo(() => [
        { field: '_no', headers: ['NO', null, null], w: 50, className: 'text-center', sticky: true, left: 0, valueGetter: (r) => r._no },
        { field: 'sex', headers: ['L/P', null, null], w: 40, className: 'text-center', sticky: true, left: 50, valueGetter: (r) => r.details?.variables?.SEX || r.sex || 'L' },
        { field: 'emp_name', headers: ['NAMA KARYAWAN', null, null], w: 200, className: 'text-left', sticky: true, left: 90, render: (r) => (<div><b>{r.emp_name}</b><br /><small>{r.nik} {r.emp_code ? `| ${r.emp_code}` : ''}</small>{r.isPreview && <span style={{ fontSize: '0.6rem', color: 'green', display: 'block' }}> (Preview)</span>}</div>) },
        { field: 'religion', headers: ['AGAMA', null, null], w: 100, className: 'text-center', valueGetter: (r) => (r.religion || '').replace(/^\d+\s+/, '') },
        { field: 'join_date', headers: ['TGL MASUK', null, null], w: 100, className: 'text-center', valueGetter: (r) => r.details?.variables?.JOIN_DATE ? new Date(r.details.variables.JOIN_DATE).toLocaleDateString('id-ID') : (r.join_date ? new Date(r.join_date).toLocaleDateString('id-ID') : '-') },
        { field: 'upah_dasar', headers: ['UPAH DASAR', null, null], w: 110, className: 'text-right', format: 'currency', valueGetter: (r) => r.details?.variables?.UPAH_DASAR || r.upah_dasar || 0 },
        { field: 'upah_pokok', headers: ['UPAH POKOK', '(30 HK)', null], w: 110, className: 'text-right', format: 'currency', valueGetter: (r) => (r.details?.variables?.UPAH_DASAR || r.upah_dasar || 0) * 30 },
        { field: 'beras', headers: ['TUNJANGAN', 'BERAS', 'JML'], w: 100, className: 'text-right', format: 'currency', valueGetter: (r) => (r.details?.variables?.BERAS_RATE || r.beras_rate || 0) * 30 },
        { field: 'mk_jml', headers: ['MASA KERJA', 'JUMLAH', null], w: 100, className: 'text-right', format: 'currency', valueGetter: (r) => r.details?.variables?.MASA_KERJA_JUMLAH || 0 },
        { field: 'amount', headers: ['UPAH KOTOR', null, null], w: 120, className: 'text-right font-bold', format: 'currency' },
        { field: 'pajak', headers: ['PAJAK THR', null, null], w: 90, className: 'text-right', format: 'currency', valueGetter: () => 0 },
        { field: 'upah_bersih', headers: ['UPAH BERSIH', null, null], w: 130, className: 'text-right font-bold', format: 'currency', valueGetter: (r) => Number(r.amount) },  // Tidak ada pajak
        { field: '_aksi', headers: ['AKSI', null, null], w: 60, className: 'text-center', render: (r) => <button onClick={() => handleDelete(r)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button> }
    ], [handleDelete]);

    const displayData = useMemo(() => {
        let f = filterReligion === 'ALL' ? rowData : rowData.filter(r => r.religion === filterReligion);
        if (gangPrefix) f = f.filter(r => getAsistensi(r.gang_code) === gangPrefix);
        return f.map((r, i) => ({ ...r, _no: i + 1, _id: r.id || `row-${i}` }));
    }, [rowData, filterReligion, gangPrefix, getAsistensi]);

    const uniqueDivisions = useMemo(() => {
        const divSet = new Set(allDivisions);
        const filtered = [];
        for (const d of allDivisions) {
            if (!filtered.includes(d)) {
                // If it's a P-prefix (like P1A) and the PG-prefix (PG1A) exists, hide the old P-prefix to avoid duplicates
                if (d.startsWith('P') && d.length === 3 && divSet.has('PG' + d.substring(1))) continue;
                // If it's a pure virtual division typically not used for direct THR data entry, hide it
                if (['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'WORKSHOP', 'MILL'].includes(d)) continue;
                filtered.push(d);
            }
        }
        return filtered;
    }, [allDivisions]);

    const footerData = useMemo(() => { if (!displayData.length) return null; const tk = displayData.reduce((a, c) => a + (Number(c.amount) || 0), 0); return { amount: tk, pajak: 0, upah_bersih: tk }; }, [displayData]); // Tidak ada pajak THR
    const openPreview = (type) => { setPreviewType(type); setIsPreviewModalOpen(true); };

    return (
        <div style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Laporan THR</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Bulan {i + 1}</option>)}</select>
                    <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '80px' }} />
                </div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ padding: '0.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select value={division} onChange={e => { setDivision(e.target.value); setGangPrefix(''); }}>{uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}</select>
                        <select value={gangPrefix} onChange={e => setGangPrefix(e.target.value)}><option value="">SEMUA GROUP</option>{availablePrefixes.map(p => <option key={p} value={p}>Group {p}</option>)}</select>
                        <select value={gang} onChange={e => setGang(e.target.value)}><option value="ALL">SEMUA GANG</option>{filteredGangs.map(g => <option key={g.gang_code} value={g.gang_code}>{g.gang_code}</option>)}</select>
                        <select value={filterReligion} onChange={e => setFilterReligion(e.target.value)}>{RELIGION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isLivePreview && <button onClick={handleBulkSaveTHR} disabled={isSaving} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}><Save size={16} /> Simpan</button>}
                        <button onClick={handleLivePreviewTHR} disabled={loading || isCalculating} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}><Calculator size={16} /> Kalkulasi Live</button>
                        <button onClick={fetchIncomes} disabled={loading} style={{ background: 'white', border: '1px solid #ccc', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}><RefreshCw size={16} /> {isLivePreview ? 'Batal' : 'Refresh'}</button>
                        <button onClick={() => openPreview('MAIN')} style={{ background: '#f1f5f9', border: '1px solid #ccc', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}><Eye size={16} /> Preview Print</button>
                        <button onClick={() => openPreview('BANK')} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}><Printer size={16} /> Bank List</button>
                    </div>
                </div>
                <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                    {(loading || isCalculating || isSaving) && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}><RefreshCw className="spin" size={32} /><span style={{ fontSize: '0.85rem', color: '#555' }}>{isCalculating ? 'Sedang kalkulasi THR...' : isSaving ? 'Menyimpan...' : 'Memuat data...'}</span></div>}
                    {!loading && !isCalculating && displayData.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#888' }}>
                            <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</span>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>Belum ada data THR untuk periode ini.</p>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Klik <b>Kalkulasi Live</b> untuk menghitung, lalu <b>Simpan</b>.</p>
                        </div>
                    )}
                    <ReportTable columns={reportColumns} data={displayData} footerData={footerData} footerLabel="TOTAL" footerLabelColSpan={8} statusBar={<><strong>Total:</strong> {displayData.length} karyawan</>} />
                </div>
            </div>
            {isPreviewModalOpen && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', padding: '2rem' }}><div style={{ background: 'white', flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden' }}><div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2>Preview {previewType === 'MAIN' ? 'Laporan Utama' : 'Bank List'}</h2><div style={{ display: 'flex', gap: '1rem' }}>{previewType === 'MAIN' && <select value={printOrientation} onChange={e => setPrintOrientation(e.target.value)}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select>}<button onClick={() => { const win = window.open('', '_blank'); win.document.write(`<html><body>${previewType === 'MAIN' ? getReportHTML(displayData, printOrientation) : getBankListHTML(displayData)}<script>window.onload=function(){window.print();}</script></body></html>`); win.document.close(); }} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Print PDF</button><button onClick={() => setIsPreviewModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24} /></button></div></div><div style={{ flex: 1, overflow: 'auto', padding: '2rem', background: '#f3f4f6' }} dangerouslySetInnerHTML={{ __html: previewType === 'MAIN' ? getReportHTML(displayData, printOrientation) : getBankListHTML(displayData) }} /></div></div>}
        </div>
    );
};
export default OtherIncomesPage;
