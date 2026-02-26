import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useReport } from '../context/ReportContext';
import { otherIncomesService } from '../services/otherIncomesService';
import { Save, Trash2, Plus, RefreshCw, AlertCircle } from 'lucide-react';

const INCOME_TYPES = ['THR', 'Bonus', 'Custom'];

const OtherIncomesPage = () => {
    const { division, gang, month, year, setDivision, setGang, setMonth, setYear, allDivisions, gangs, gangLoading } = useReport();

    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchIncomes = useCallback(async () => {
        if (!division) return;
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
    }, [year, month, division, gang]);

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

    const columnDefs = useMemo(() => [
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
        { field: 'is_paid_in_thp', headerName: 'Masuk THP?', editable: true, cellEditor: 'agCheckboxCellEditor', width: 120 },
        { field: 'is_taxable', headerName: 'Kena Pajak?', editable: true, cellEditor: 'agCheckboxCellEditor', width: 120 },
        {
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
        }
    ], [isSaving, year, month, division, gang]);

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
        </div>
    );
};

export default OtherIncomesPage;
