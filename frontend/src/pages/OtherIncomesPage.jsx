import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useReport } from '../context/ReportContext';
import { otherIncomesService } from '../services/otherIncomesService';
import { Save, Trash2, Plus, RefreshCw, AlertCircle, Calculator, Download, Settings, X } from 'lucide-react';

const INCOME_TYPES = ['THR', 'Bonus', 'Custom'];

const OtherIncomesPage = () => {
    const { division, gang, month, year, setDivision, setGang, setMonth, setYear, allDivisions, gangs, gangLoading } = useReport();

    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Formula Modal State
    const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
    const [formulaType, setFormulaType] = useState('THR');
    const [formulaString, setFormulaString] = useState('');
    const [isPaidInThpConfig, setIsPaidInThpConfig] = useState(true);
    const [isTaxableConfig, setIsTaxableConfig] = useState(true);
    const [isSavingFormula, setIsSavingFormula] = useState(false);

    // Export State
    const [exportType, setExportType] = useState('TOTAL');

    const fetchIncomes = useCallback(async () => {
        if (!division || gangLoading) return;
        setLoading(true);
        setError(null);
        setRowData([]); // Reset data to ensure clean render
        try {
            const data = await otherIncomesService.getIncomes(year, month, division, gang === 'ALL' ? '' : gang);
            setRowData(data);
        } catch (err) {
            console.error('Failed to fetch incomes:', err);
            setError('Gagal memuat data pendapatan tidak tetap.');
        } finally {
            setLoading(false);
        }
    }, [year, month, division, gang, gangLoading]);

    useEffect(() => {
        fetchIncomes();
    }, [fetchIncomes]);

    const handleCellValueChanged = async (params) => {
        const updatedRow = params.data;
        if (!updatedRow.id) return; // Only process updates for existing records here

        try {
            await otherIncomesService.updateIncome(updatedRow.id, {
                income_type: updatedRow.income_type,
                income_name: updatedRow.income_name,
                amount: updatedRow.amount,
                is_paid_in_thp: updatedRow.is_paid_in_thp,
                is_taxable: updatedRow.is_taxable
            });
        } catch (err) {
            console.error('Failed to update income:', err);
            alert('Gagal mengupdate data.');
            params.node.setDataValue(params.colDef.field, params.oldValue);
        }
    };

    const handleDelete = async (data) => {
        if (!data.id) {
            setRowData(prev => prev.filter(r => r !== data));
            return;
        }

        if (window.confirm(`Hapus pendapatan ${data.income_name} untuk NIK ${data.nik}?`)) {
            try {
                await otherIncomesService.deleteIncome(data.id);
                setRowData(prev => prev.filter(r => r.id !== data.id));
            } catch (err) {
                console.error('Failed to delete income:', err);
                alert('Gagal menghapus data.');
            }
        }
    };

    const handleAddRow = () => {
        const newRow = {
            nik: '',
            emp_name: '',
            division_code: division,
            gang_code: gang === 'ALL' ? '' : gang,
            period_year: year,
            period_month: month,
            income_type: 'Custom',
            income_name: '',
            amount: 0,
            is_paid_in_thp: true,
            is_taxable: true,
            isNew: true
        };
        setRowData(prev => [newRow, ...prev]);
    };

    const handleSaveNew = async (data) => {
        if (!data.nik || !data.income_name || !data.income_type) {
            alert('NIK, Nama Pendapatan, dan Tipe harus diisi.');
            return;
        }

        setIsSaving(true);
        try {
            const result = await otherIncomesService.addIncome({
                ...data,
                period_year: year,
                period_month: month,
                division_code: division,
                gang_code: gang === 'ALL' ? data.gang_code || '' : gang
            });
            alert('Berhasil menyimpan data.');
            setRowData(prev => prev.map(r => r === data ? { ...result, isNew: false } : r));
        } catch (err) {
            console.error('Failed to save new income:', err);
            alert('Gagal menyimpan data.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCalculateTHR = async () => {
        if (!window.confirm(`Kalkulasi ulang THR untuk periode Bulan ${month} Tahun ${year}? Ini akan menyimpan hasil kalkulasi ke database.`)) {
            return;
        }

        setLoading(true);
        try {
            const result = await otherIncomesService.calculateTHR(year, month, division, gang === 'ALL' ? '' : gang);
            if (result.success) {
                alert(`Berhasil mengkalkulasi dan menyimpan ${result.count} data THR.`);
                fetchIncomes();
            } else {
                alert(`Gagal mengkalkulasi THR: ${result.message || 'Error tidak diketahui'}`);
            }
        } catch (err) {
            console.error('Failed to calculate THR:', err);
            alert('Terjadi kesalahan saat mengkalkulasi THR.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        try {
            await otherIncomesService.exportExcel(year, month, division, gang === 'ALL' ? '' : gang, exportType);
        } catch (err) {
            console.error('Failed to export excel:', err);
            alert('Gagal mengunduh laporan Excel.');
        }
    };

    const handleOpenFormulaModal = async () => {
        setIsFormulaModalOpen(true);
        try {
            const config = await otherIncomesService.getFormula(formulaType);
            if (config && typeof config === 'object') {
                setFormulaString(config.formula || '');
                setIsPaidInThpConfig(config.is_paid_in_thp ?? true);
                setIsTaxableConfig(config.is_taxable ?? true);
            } else {
                setFormulaString(config || '');
                setIsPaidInThpConfig(true);
                setIsTaxableConfig(true);
            }
        } catch (err) {
            console.error('Failed to load formula:', err);
            alert('Gagal memuat formula dari server.');
        }
    };

    const handleSaveFormula = async () => {
        if (!formulaString.trim()) {
            alert('Formula tidak boleh kosong!');
            return;
        }

        setIsSavingFormula(true);
        try {
            await otherIncomesService.saveFormula(formulaType, {
                formula: formulaString,
                is_paid_in_thp: isPaidInThpConfig,
                is_taxable: isTaxableConfig
            });
            alert('Formula berhasil disimpan.');
            setIsFormulaModalOpen(false);
        } catch (err) {
            console.error('Failed to save formula:', err);
            alert('Gagal menyimpan formula.');
        } finally {
            setIsSavingFormula(false);
        }
    };

    const columnDefs = useMemo(() => {
        const baseColumns = [
            { field: 'nik', headerName: 'NIK', editable: params => params.data.isNew, width: 150 },
            { field: 'emp_name', headerName: 'Nama Karyawan', editable: params => params.data.isNew, width: 200 },
            { field: 'gang_code', headerName: 'Gang', editable: params => params.data.isNew, width: 100 },
            {
                field: 'income_type',
                headerName: 'Tipe',
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: INCOME_TYPES },
                width: 120
            },
            { field: 'income_name', headerName: 'Deskripsi', editable: true, width: 200 },
            {
                field: 'amount',
                headerName: 'Jumlah (Rp)',
                editable: true,
                type: 'numericColumn',
                valueFormatter: params => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(params.value || 0),
                valueParser: params => Number(params.newValue) || 0,
                width: 150
            },
            { field: 'is_paid_in_thp', headerName: 'Masuk THP?', editable: true, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', width: 120 },
            { field: 'is_taxable', headerName: 'Kena Pajak?', editable: true, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor', width: 120 }
        ];

        const hasDetails = rowData.some(r => r.details);
        if (hasDetails) {
            baseColumns.push(
                { field: 'details.variables.UPAH_DASAR', headerName: 'Upah Dasar', editable: false, width: 130, valueFormatter: params => params.value ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(params.value) : '-' },
                { field: 'details.variables.BERAS_RATE', headerName: 'Tunj Beras', editable: false, width: 130, valueFormatter: params => params.value ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(params.value) : '-' },
                { field: 'details.variables.MASA_KERJA_JUMLAH', headerName: 'Masa Kerja Rp', editable: false, width: 130, valueFormatter: params => params.value ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(params.value) : '-' },
                { field: 'details.variables.MASA_KERJA_TAHUN', headerName: 'Lama (Thn)', editable: false, width: 100, valueFormatter: params => params.value || '-' },
                { field: 'details.variables.HK', headerName: 'HK', editable: false, width: 80, valueFormatter: params => params.value || '-' },
                { field: 'details.formula', headerName: 'Formula', editable: false, width: 250, tooltipField: 'details.formula' }
            );
        }

        baseColumns.push({
            headerName: 'Aksi',
            width: 120,
            cellRenderer: (params) => (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '100%' }}>
                    {params.data.isNew && (
                        <button
                            onClick={() => handleSaveNew(params.data)}
                            disabled={isSaving}
                            style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#10b981' }}
                            title="Simpan Baru"
                        >
                            <Save size={16} />
                        </button>
                    )}
                    <button
                        onClick={() => handleDelete(params.data)}
                        style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#ef4444' }}
                        title="Hapus"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        });

        return baseColumns;
    }, [isSaving, year, month, division, gang, rowData]);

    return (
        <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
            {/* Header Area */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                backgroundColor: 'white',
                padding: '1rem 1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Pendapatan Tidak Tetap</h1>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                        Kelola THR, Bonus, dan Penyesuaian Custom untuk THP & Pajak
                    </p>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Bulan {m}</option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            style={{ padding: '0.5rem', width: '80px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '1rem', backgroundColor: '#fef2f2', color: '#ef4444',
                    borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <select
                            value={division}
                            onChange={(e) => setDivision(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        >
                            {allDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                            value={gang || ""}
                            onChange={(e) => setGang(e.target.value)}
                            disabled={gangLoading}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        >
                            <option value="ALL">All Gangs</option>
                            {gangs.map(g => (
                                <option key={g.gang_code} value={g.gang_code}>{g.gang_code} - {g.description || ''}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={handleOpenFormulaModal}
                            disabled={loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', background: '#e2e8f0', color: '#1e293b',
                                border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer'
                            }}
                            title="Konfigurasi Formula THR"
                        >
                            <Settings size={16} /> Config Formula
                        </button>
                        <button
                            onClick={handleCalculateTHR}
                            disabled={loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', background: '#f59e0b', color: 'white',
                                border: 'none', borderRadius: '4px', cursor: 'pointer'
                            }}
                            title="Kalkulasi THR Otomatis dari Database Histori"
                        >
                            <Calculator size={16} /> Kalkulasi THR
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '2px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            <select
                                value={exportType}
                                onChange={(e) => setExportType(e.target.value)}
                                style={{
                                    padding: '0.4rem', border: 'none', background: 'transparent',
                                    outline: 'none', fontSize: '0.85rem', color: '#475569', fontWeight: '500'
                                }}
                            >
                                <option value="TOTAL">Semua Tipe</option>
                                {INCOME_TYPES.map(type => (
                                    <option key={type} value={type}>Hanya {type}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleExportExcel}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.4rem 0.75rem', background: '#10b981', color: 'white',
                                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem'
                                }}
                                title="Export Laporan Excel"
                            >
                                <Download size={14} /> Export
                            </button>
                        </div>
                        <button
                            onClick={handleOpenFormulaModal}
                            disabled={loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', background: 'white', border: '1px solid #cbd5e1',
                                borderRadius: '4px', cursor: 'pointer'
                            }}
                            title="Konfigurasi Formula THR"
                        >
                            <Settings size={16} /> Config Formula
                        </button>
                        <button
                            onClick={fetchIncomes}
                            disabled={loading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', background: 'white', border: '1px solid #cbd5e1',
                                borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                        </button>
                        <button
                            onClick={handleAddRow}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', background: '#3b82f6', color: 'white',
                                border: 'none', borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            <Plus size={16} /> Tambah Data
                        </button>
                    </div>
                </div>

                <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        onCellValueChanged={handleCellValueChanged}
                        stopEditingWhenCellsLoseFocus={true}
                        overlayLoadingTemplate='<span class="ag-overlay-loading-center">Memuat data...</span>'
                        overlayNoRowsTemplate='<span class="ag-overlay-no-rows-center">Tidak ada data pendapatan tidak tetap.</span>'
                    />
                </div>
            </div>

            {/* Formula Configuration Modal */}
            {isFormulaModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white', padding: '2rem', borderRadius: '8px',
                        width: '500px', maxWidth: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings size={20} /> Konfigurasi Formula
                            </h2>
                            <button onClick={() => setIsFormulaModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>Tipe Pendapatan</label>
                            <select
                                value={formulaType}
                                onChange={async (e) => {
                                    const type = e.target.value;
                                    setFormulaType(type);
                                    try {
                                        const config = await otherIncomesService.getFormula(type);
                                        if (config && typeof config === 'object') {
                                            setFormulaString(config.formula || '');
                                            setIsPaidInThpConfig(config.is_paid_in_thp ?? true);
                                            setIsTaxableConfig(config.is_taxable ?? true);
                                        } else {
                                            setFormulaString(config || '');
                                            setIsPaidInThpConfig(true);
                                            setIsTaxableConfig(true);
                                        }
                                    } catch (err) { }
                                }}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                                <option value="THR">THR</option>
                                {/* Add more formula types here if needed later */}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>Formula String</label>
                            <textarea
                                value={formulaString}
                                onChange={(e) => setFormulaString(e.target.value)}
                                placeholder="(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', height: '100px', resize: 'vertical', fontFamily: 'monospace' }}
                            />
                            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <strong>Variabel yang tersedia:</strong><br />
                                <code>UPAH_DASAR</code>: Gaji Dasar Harian<br />
                                <code>BERAS_RATE</code>: Tunjangan Beras Harian<br />
                                <code>MASA_KERJA_JUMLAH</code>: Jumlah Rp Masa Kerja<br />
                                <code>MASA_KERJA_TAHUN</code>: Detail Tahun Lama Bekerja<br />
                                <code>HK</code>: Hari Kerja Bulan Tersebut<br />
                                <br />
                                <em>Gunakan pola matematika standar Javascript: +, -, *, /, (, )</em>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#475569', fontWeight: '500' }}>
                                <input
                                    type="checkbox"
                                    checked={isPaidInThpConfig}
                                    onChange={(e) => setIsPaidInThpConfig(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                Tambahkan ke Take Home Pay (THP)
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#475569', fontWeight: '500' }}>
                                <input
                                    type="checkbox"
                                    checked={isTaxableConfig}
                                    onChange={(e) => setIsTaxableConfig(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                Masuk dalam Kena Pajak
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setIsFormulaModalOpen(false)}
                                style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveFormula}
                                disabled={isSavingFormula}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
                            >
                                <Save size={16} /> {isSavingFormula ? 'Menyimpan...' : 'Simpan Formula'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OtherIncomesPage;
