/**
 * AggregationSeederPage - Web UI for Payroll Aggregation Seeder
 * Equivalent to the Python Tkinter gui_app.py but as a React component
 *
 * MODIFIED: Added History Seeder functionality (terpisah dari aggregation seeder)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    checkAggregationHealth,
    seedAggregation,
    fetchAggregationSummary,
    fetchAggregationDivisions,
    fetchAggregationPeriods,
    fetchAggregationStatus,
    syncSpreadsheet,
    formatMonthName as formatAggMonthName,
    formatCurrency,
    formatNumber
} from '../services/aggregationSeederService';
import {
    checkHistoryHealth,
    seedPayrollHistory,
    getSeederProgress,
    formatMonthName,
    previewPtkpTax,
    updatePtkpTax
} from '../services/historyService';
import '../styles/aggregation-seeder.css';

export default function AggregationSeederPage({ onBack }) {
    const { token, user } = useAuth();

    // Parameters
    const [division, setDivision] = useState('ALL');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [syncType, setSyncType] = useState('DAFTAR_UPAH');
    const [historySeederType, setHistorySeederType] = useState('PAYROLL');

    // Data
    const [divisions, setDivisions] = useState(['ALL']);
    const [summaryData, setSummaryData] = useState([]);
    const [grandTotal, setGrandTotal] = useState(null);

    // State
    const [isRunning, setIsRunning] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isHistoryRunning, setIsHistoryRunning] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('checking');
    const [historyConnectionStatus, setHistoryConnectionStatus] = useState('checking');
    const [logs, setLogs] = useState([]);
    const [showSummary, setShowSummary] = useState(false);
    const [seederProgress, setSeederProgress] = useState(null);
    const [isPtkpRunning, setIsPtkpRunning] = useState(false);

    // Log ref for auto-scroll
    const logEndRef = useRef(null);

    // Add log entry
    const addLog = useCallback((message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        setLogs(prev => [...prev, { timestamp, message, type }]);
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Poll seeder progress while running
    useEffect(() => {
        if (!isHistoryRunning) return;
        const interval = setInterval(async () => {
            try {
                const progress = await getSeederProgress(token);
                if (progress) setSeederProgress(progress);
                if (progress && !progress.is_running) {
                    clearInterval(interval);
                }
            } catch (e) { /* ignore */ }
        }, 2000);
        return () => clearInterval(interval);
    }, [isHistoryRunning, token]);

    // Check connection on mount
    useEffect(() => {
        async function checkConnection() {
            if (!token) return;
            setConnectionStatus('checking');
            setHistoryConnectionStatus('checking');
            addLog('🔌 Checking database connections...');

            // Check aggregation database
            try {
                const result = await checkAggregationHealth(token);
                if (result.success) {
                    setConnectionStatus('connected');
                    addLog('✅ Aggregation DB connection OK', 'success');
                } else {
                    setConnectionStatus('error');
                    addLog(`❌ Aggregation DB connection failed: ${result.message}`, 'error');
                }
            } catch (e) {
                setConnectionStatus('error');
                addLog(`❌ Aggregation DB connection error: ${e.message}`, 'error');
            }

            // Check history database
            try {
                const result = await checkHistoryHealth(token);
                if (result.success) {
                    setHistoryConnectionStatus('connected');
                    addLog(`✅ History DB connection OK (${result.mode} mode)`, 'success');
                } else {
                    setHistoryConnectionStatus('error');
                    addLog(`❌ History DB connection failed: ${result.message}`, 'error');
                }
            } catch (e) {
                setHistoryConnectionStatus('error');
                addLog(`❌ History DB connection error: ${e.message}`, 'error');
            }

            // Fetch active database period and set as default
            try {
                const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';
                const periodRes = await fetch(`${baseUrl}/payroll/current-period`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (periodRes.ok) {
                    const periodData = await periodRes.json();
                    if (periodData.month && periodData.year) {
                        setMonth(periodData.month);
                        setYear(periodData.year);
                        addLog(`📅 Database aktif: ${formatMonthName(periodData.month)} ${periodData.year}`);
                    }
                }
            } catch (e) {
                // Non-critical, keep system date defaults
            }
        }
        checkConnection();
    }, [token, addLog]);

    // Load divisions
    useEffect(() => {
        async function loadDivisions() {
            if (!token) return;
            try {
                const result = await fetchAggregationDivisions(token);
                if (result.success && result.divisions?.length > 0) {
                    setDivisions(['ALL', ...result.divisions]);
                    addLog(`✅ Loaded ${result.divisions.length} divisions`);
                }
            } catch (e) {
                addLog(`⚠️ Failed to load divisions: ${e.message}`, 'warn');
            }
        }
        loadDivisions();
    }, [token, addLog]);

    // Run seeder
    const handleRunSeeder = async () => {
        if (isRunning) return;
        if (connectionStatus !== 'connected') {
            addLog('❌ Database not connected. Cannot run seeder.', 'error');
            return;
        }

        setIsRunning(true);
        setLogs([]);
        addLog('🚀 Starting aggregation seeder...');
        addLog(`📅 Period: ${formatMonthName(month)} ${year}`);
        addLog(`📊 Division: ${division === 'ALL' ? 'All Divisions' : division}`);

        try {
            const result = await seedAggregation(
                token,
                month,
                year,
                division === 'ALL' ? null : division,
                false
            );

            if (result.success) {
                addLog('='.repeat(40), 'info');
                addLog('✅ Seeding complete!', 'success');
                addLog(`📊 Processed ${result.data?.total_divisions || 0} divisions`);

                if (result.data?.processed) {
                    for (const item of result.data.processed) {
                        addLog(`  ✅ ${item.division}/${item.gang}: ${item.employees_processed} employees`);
                    }
                }
            } else {
                addLog(`❌ Seeding failed: ${result.error}`, 'error');
            }
        } catch (e) {
            addLog(`❌ Error: ${e.message}`, 'error');
        } finally {
            setIsRunning(false);
        }
    };

    // Run spreadsheet sync
    const handleSyncSpreadsheet = async () => {
        if (isSyncing || isRunning) return;

        setIsSyncing(true);
        addLog('='.repeat(40), 'info');
        addLog('🔄 Starting Spreadsheet Sync...', 'info');
        addLog(`📅 Period: ${formatMonthName(month)} ${year}`);
        addLog(`📊 Division: ${division === 'ALL' ? 'All Divisions' : division}`);

        try {
            const result = await syncSpreadsheet(
                token,
                month,
                year,
                division === 'ALL' ? null : division,
                syncType
            );

            if (result.success) {
                addLog('✅ Spreadsheet Sync complete!', 'success');
                if (result.results) {
                    const synced = result.results.filter(r => r.status === 'SUCCESS').length;
                    const skipped = result.results.filter(r => r.status === 'SKIPPED_NO_DATA').length;
                    const failed = result.results.filter(r => r.status === 'FAILED').length;
                    addLog(`📈 Synced: ${synced}, Skipped: ${skipped}, Failed: ${failed}`);

                    // Log details for failures
                    result.results.filter(r => r.status === 'FAILED').forEach(r => {
                        addLog(`❌ ${r.division}: ${r.error}`, 'error');
                    });
                }
            } else {
                addLog(`❌ Sync failed: ${result.error}`, 'error');
            }
        } catch (e) {
            addLog(`❌ Sync Error: ${e.message}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    // View summary
    const handleViewSummary = async () => {
        addLog(`📋 Loading summary for ${formatMonthName(month)} ${year}...`);
        try {
            const result = await fetchAggregationSummary(token, month, year);
            if (result.success) {
                setSummaryData(result.summary || []);
                setGrandTotal(result.grand_total || null);
                setShowSummary(true);
                addLog(`✅ Loaded ${result.summary?.length || 0} division records`, 'success');
            } else {
                addLog(`❌ Failed to load summary: ${result.error}`, 'error');
            }
        } catch (e) {
            addLog(`❌ Error: ${e.message}`, 'error');
        }
    };

    // Check status
    const handleCheckStatus = async () => {
        addLog(`🔍 Checking status for ${formatMonthName(month)} ${year}...`);
        try {
            const result = await fetchAggregationStatus(token, month, year);
            if (result.success) {
                addLog(`📊 Total gangs seeded: ${result.total_gangs}`);
                if (result.divisions?.length > 0) {
                    for (const div of result.divisions) {
                        addLog(`  • ${div.division_code}: ${div.gang_count} gangs`);
                    }
                } else {
                    addLog('⚠️ No data found for this period', 'warn');
                }
            }
        } catch (e) {
            addLog(`❌ Error: ${e.message}`, 'error');
        }
    };

    // Run history seeder (terpisah dari aggregation seeder)
    const handleRunHistorySeeder = async () => {
        if (isHistoryRunning) return;
        if (historyConnectionStatus !== 'connected') {
            addLog('❌ History database not connected. Cannot run history seeder.', 'error');
            return;
        }

        setIsHistoryRunning(true);
        addLog('='.repeat(40), 'info');
        addLog('🚀 Starting HISTORY seeder (terpisah)...');
        addLog(`📅 Period: ${formatMonthName(month)} ${year}`);
        addLog(`📊 Division: ${division === 'ALL' ? 'All Divisions' : division}`);

        try {
            // Start progress poller
            let lastStatus = '';
            const poller = setInterval(async () => {
                try {
                    const progress = await getSeederProgress(token);
                    if (progress?.data?.is_running) {
                        const p = progress.data;
                        const statusMsg = `⏳ [${p.current_division}] Gangs: ${p.gangs_done}/${p.gangs_total} | Emp: ${p.employees_processed} | ${p.current_step}`;
                        if (statusMsg !== lastStatus) {
                            addLog(statusMsg, 'debug');
                            lastStatus = statusMsg;
                        }
                    }
                } catch (e) { }
            }, 2000);

            const result = await seedPayrollHistory(
                token,
                month,
                year,
                division === 'ALL' ? null : division,
                null, // gang_code - seed all gangs
                false, // force
                historySeederType
            );

            clearInterval(poller); // Stop poller

            if (result.success) {
                addLog('='.repeat(40), 'info');
                addLog(`✅ History seeding complete! Mode: ${historySeederType}`, 'success');
                addLog(`📊 Total employees: ${result.data?.total_employees || 0}`);

                const records = result.data?.records_inserted;
                if (records) {
                    addLog(`📋 Records inserted:`);
                    if (records.master !== undefined) addLog(`  • Master: ${records.master}`);
                    if (records.detail !== undefined) addLog(`  • Detail: ${records.detail}`);
                    if (records.taskreg !== undefined) addLog(`  • Taskreg: ${records.taskreg}`);
                    if (records.adtrans !== undefined) addLog(`  • ADTrans: ${records.adtrans}`);
                    if (records.gang_member !== undefined) addLog(`  • Gang Member: ${records.gang_member}`);
                    if (records.hr_employee !== undefined) addLog(`  • HR Employee: ${records.hr_employee}`);
                    if (records.hr_gang !== undefined) addLog(`  • HR Gang: ${records.hr_gang}`);
                }

                if (result.data?.history_id) {
                    addLog(`🔑 History ID: ${result.data.history_id}`);
                }
            } else {
                addLog(`❌ History seeding failed: ${result.error}`, 'error');
                if (result.errors?.length > 0) {
                    result.errors.forEach(err => addLog(`  • ${err}`, 'error'));
                }
            }
        } catch (e) {
            addLog(`❌ Error: ${e.message}`, 'error');
        } finally {
            setIsHistoryRunning(false);
        }
    };

    // Clear logs
    const handleClearLogs = () => {
        setLogs([]);
    };

    // Run PTKP Preview
    const handlePreviewPtkp = async () => {
        if (isPtkpRunning) return;
        if (historyConnectionStatus !== 'connected') {
            addLog('❌ History DB not connected. Cannot preview PTKP.', 'error');
            return;
        }

        setIsPtkpRunning(true);
        addLog('='.repeat(40), 'info');
        addLog(`🔍 Previewing PTKP Update for Year ${year}...`);

        try {
            const res = await previewPtkpTax(token, year);
            if (res.success) {
                const { total_employees, existing_records, distribution } = res.data;
                addLog(`✅ Preview successful`, 'success');
                addLog(`👥 Total Karyawan Aktif: ${total_employees}`);
                addLog(`📂 Data Lama di Tabel: ${existing_records}`);

                addLog('📊 Distribusi PTKP Baru:');
                Object.entries(distribution).forEach(([ptkp, count]) => {
                    addLog(`   • Status ${ptkp}: ${count} Karyawan`);
                });
            } else {
                addLog(`❌ Preview failed: ${res.error}`, 'error');
            }
        } catch (e) {
            addLog(`❌ Preview error: ${e.message}`, 'error');
        } finally {
            setIsPtkpRunning(false);
        }
    };

    // Run PTKP Update
    const handleRunPtkpUpdate = async () => {
        if (isPtkpRunning) return;
        if (historyConnectionStatus !== 'connected') {
            addLog('❌ History DB not connected. Cannot update PTKP.', 'error');
            return;
        }

        if (!window.confirm(`Anda yakin ingin melakukan update PTKP untuk tahun ${year}? Semua perhitungan pada tahun ini akan terpengaruh.`)) {
            return;
        }

        setIsPtkpRunning(true);
        addLog('='.repeat(40), 'info');
        addLog(`🚀 Starting PTKP Update for Year ${year}...`);

        try {
            const res = await updatePtkpTax(token, year);
            if (res.success) {
                const { records_inserted, records_updated, records_skipped } = res.data;
                addLog(`✅ Update PTKP Selesai!`, 'success');
                addLog(`📋 Inserted: ${records_inserted}`);
                addLog(`🔄 Updated: ${records_updated}`);
                addLog(`⏭️ Skipped: ${records_skipped}`);
            } else {
                addLog(`❌ Update PTKP failed: ${res.error}`, 'error');
                if (res.errors?.length > 0) {
                    res.errors.forEach(err => addLog(`   • ${err}`, 'error'));
                }
            }
        } catch (e) {
            addLog(`❌ Update error: ${e.message}`, 'error');
        } finally {
            setIsPtkpRunning(false);
        }
    };

    // Month options
    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: formatMonthName(i + 1)
    }));

    // Year options
    const yearOptions = Array.from({ length: 7 }, (_, i) => 2020 + i);

    return (
        <div className="agg-container">
            {/* Header */}
            <div className="agg-header">
                <div className="agg-header-left">
                    {onBack && (
                        <button onClick={onBack} className="agg-btn agg-btn-back">
                            ← Kembali
                        </button>
                    )}
                    <div className="agg-title-block">
                        <h1 className="agg-title">📊 Aggregation Seeder</h1>
                        <p className="agg-subtitle">Seed payroll aggregation data to extend_db_ptrj</p>
                    </div>
                </div>
                <div className="agg-header-right">
                    <span className={`agg-connection-badge ${connectionStatus}`}>
                        {connectionStatus === 'connected' && '✅ Connected'}
                        {connectionStatus === 'checking' && '🔄 Checking...'}
                        {connectionStatus === 'error' && '❌ Disconnected'}
                    </span>
                </div>
            </div>

            <div className="agg-content">
                {/* Left Panel - Parameters & Actions */}
                <div className="agg-panel agg-params-panel">
                    <h2 className="agg-panel-title">Parameters</h2>

                    {/* Division */}
                    <div className="agg-form-group">
                        <label>Division</label>
                        <select
                            value={division}
                            onChange={(e) => setDivision(e.target.value)}
                            disabled={isRunning}
                        >
                            {divisions.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month */}
                    <div className="agg-form-group">
                        <label>Month</label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            disabled={isRunning}
                        >
                            {monthOptions.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year */}
                    <div className="agg-form-group">
                        <label>Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            disabled={isRunning}
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sync Type */}
                    <div className="agg-form-group">
                        <label>Sync Type</label>
                        <select
                            value={syncType}
                            onChange={(e) => setSyncType(e.target.value)}
                            disabled={isRunning || isSyncing}
                        >
                            <option value="DAFTAR_UPAH">Daftar Upah</option>
                            <option value="OTHER_REPORT" disabled>Laporan Lain (Coming Soon)</option>
                        </select>
                    </div>

                    <hr className="agg-divider" />

                    {/* Action Buttons */}
                    <button
                        onClick={handleRunSeeder}
                        disabled={isRunning || connectionStatus !== 'connected'}
                        className="agg-btn agg-btn-primary"
                    >
                        {isRunning ? '⏳ Running...' : '🚀 Run Seeder'}
                    </button>

                    <button
                        onClick={handleSyncSpreadsheet}
                        disabled={isRunning || isSyncing || connectionStatus !== 'connected'}
                        className="agg-btn agg-btn-success"
                        style={{ backgroundColor: '#10b981', borderColor: '#059669', color: 'white', marginTop: '8px' }}
                    >
                        {isSyncing ? '⏳ Syncing...' : 'sheets Sync to Spreadsheet'}
                    </button>

                    <button
                        onClick={handleCheckStatus}
                        disabled={isRunning || isSyncing}
                        className="agg-btn agg-btn-secondary"
                    >
                        🔍 Check Status
                    </button>

                    <button
                        onClick={handleViewSummary}
                        disabled={isRunning}
                        className="agg-btn agg-btn-secondary"
                    >
                        📈 View Summary
                    </button>

                    <hr className="agg-divider" />

                    <h3 className="agg-panel-subtitle" style={{ marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>⚙️ History Operations</h3>

                    <div className="agg-form-group">
                        <label>History Seeder Type</label>
                        <select
                            value={historySeederType}
                            onChange={(e) => setHistorySeederType(e.target.value)}
                            disabled={isHistoryRunning || isRunning}
                        >
                            <option value="PAYROLL">Payroll & Transactions (Master/Detail)</option>
                            <option value="EMPLOYEE_HR">Data Karyawan (HR Employee)</option>
                            <option value="GANG_HR">Data Kemandoran (HR Gang)</option>
                            <option value="ALL_HR">Semua Data HR</option>
                            <option value="ALL">Semua Data (Payroll + HR)</option>
                        </select>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', lineHeight: '1.5', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                            {historySeederType === 'PAYROLL' && (
                                <span>📋 <strong>Payroll & Transactions</strong> — Menyimpan snapshot lengkap daftar upah ke tabel history (header + detail). Termasuk gaji pokok, tunjangan, potongan, lembur, dan panen. <em>Proses ini membutuhkan waktu ±2-5 menit untuk seluruh divisi.</em></span>
                            )}
                            {historySeederType === 'EMPLOYEE_HR' && (
                                <span>👤 <strong>Data Karyawan</strong> — Menyimpan data master karyawan (NIK, nama, jabatan, divisi, tanggal masuk). Digunakan untuk profil HR dan career tracking.</span>
                            )}
                            {historySeederType === 'GANG_HR' && (
                                <span>👥 <strong>Data Kemandoran</strong> — Menyimpan struktur gang/kemandoran dan relasinya ke divisi.</span>
                            )}
                            {historySeederType === 'ALL_HR' && (
                                <span>🏢 <strong>Semua Data HR</strong> — Menjalankan seed Employee + Gang sekaligus. Tidak termasuk data payroll/upah.</span>
                            )}
                            {historySeederType === 'ALL' && (
                                <span>⚡ <strong>Semua Data</strong> — Menjalankan Payroll + Employee + Gang sekaligus. <em>Proses terlama, bisa memakan waktu ±5-10 menit.</em></span>
                            )}
                        </div>
                    </div>

                    {/* Seeder Progress Indicator */}
                    {(isHistoryRunning || (seederProgress && seederProgress.is_running)) && seederProgress && (
                        <div style={{
                            padding: '10px 12px',
                            backgroundColor: '#ede9fe',
                            borderRadius: '6px',
                            border: '1px solid #c4b5fd',
                            marginTop: '8px',
                            fontSize: '12px'
                        }}>
                            <div style={{ fontWeight: 600, color: '#6d28d9', marginBottom: '6px' }}>
                                🔄 {seederProgress.current_step}
                            </div>
                            {seederProgress.current_division && (
                                <div style={{ color: '#7c3aed', marginBottom: '4px' }}>
                                    📍 Divisi: {seederProgress.current_division} | Periode: {seederProgress.period}
                                </div>
                            )}
                            {seederProgress.gangs_total > 0 && (
                                <>
                                    <div style={{
                                        width: '100%', height: '8px', backgroundColor: '#ddd5f3',
                                        borderRadius: '4px', overflow: 'hidden', marginBottom: '4px'
                                    }}>
                                        <div style={{
                                            width: `${Math.round((seederProgress.gangs_done / seederProgress.gangs_total) * 100)}%`,
                                            height: '100%', backgroundColor: '#7c3aed',
                                            borderRadius: '4px', transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                    <div style={{ color: '#6b7280' }}>
                                        Gang: {seederProgress.gangs_done}/{seederProgress.gangs_total}
                                        {seederProgress.current_gang && ` — ${seederProgress.current_gang}`}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Show completion status */}
                    {seederProgress && !seederProgress.is_running && seederProgress.current_step !== 'idle' && !isHistoryRunning && (
                        <div style={{
                            padding: '8px 12px', borderRadius: '6px', marginTop: '8px', fontSize: '12px',
                            backgroundColor: seederProgress.current_step.includes('✅') ? '#ecfdf5' : '#fef2f2',
                            border: `1px solid ${seederProgress.current_step.includes('✅') ? '#a7f3d0' : '#fecaca'}`,
                            color: seederProgress.current_step.includes('✅') ? '#065f46' : '#991b1b'
                        }}>
                            {seederProgress.current_step}
                        </div>
                    )}

                    <button
                        onClick={handleRunHistorySeeder}
                        disabled={isHistoryRunning || isRunning || historyConnectionStatus !== 'connected'}
                        className="agg-btn"
                        style={{
                            backgroundColor: '#8b5cf6',
                            borderColor: '#7c3aed',
                            color: 'white',
                            marginTop: '8px'
                        }}
                        title="Simpan data lengkap ke history tables (terpisah dari aggregation)"
                    >
                        {isHistoryRunning ? '⏳ Saving History...' : '💾 Save to History'}
                    </button>

                    <hr className="agg-divider" />

                    <h3 className="agg-panel-subtitle" style={{ marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>💳 Master PTKP Operations</h3>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', lineHeight: '1.5', padding: '8px', backgroundColor: '#fdf4ff', borderRadius: '4px', border: '1px solid #fbcfe8', marginBottom: '12px' }}>
                        Update dan kalkulasi status Penghasilan Tidak Kena Pajak (PTKP) tahunan berdasarkan Data Karyawan. Update ini dipengaruhi oleh 'Tahun' yang dipilih di parameter atas.
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handlePreviewPtkp}
                            disabled={isPtkpRunning || isHistoryRunning || isRunning || historyConnectionStatus !== 'connected'}
                            className="agg-btn"
                            style={{
                                flex: 1,
                                backgroundColor: '#f0fdf4',
                                borderColor: '#bbf7d0',
                                color: '#166534',
                            }}
                            title="Preview data karyawan dan distribusi PTKP pajak (Tidak mengubah database)"
                        >
                            {isPtkpRunning ? '⏳ Previewing...' : '🔍 Preview PTKP'}
                        </button>

                        <button
                            onClick={handleRunPtkpUpdate}
                            disabled={isPtkpRunning || isHistoryRunning || isRunning || historyConnectionStatus !== 'connected'}
                            className="agg-btn"
                            style={{
                                flex: 2,
                                backgroundColor: '#db2777',
                                borderColor: '#be185d',
                                color: 'white',
                            }}
                            title="Update Master PTKP untuk seluruh karyawan di tahun yang dipilih"
                        >
                            {isPtkpRunning ? '⏳ Updating...' : '📝 Execute PTKP Update'}
                        </button>
                    </div>

                    <hr className="agg-divider" />

                    <button
                        onClick={handleClearLogs}
                        className="agg-btn agg-btn-outline"
                    >
                        🗑️ Clear Log
                    </button>
                </div>

                {/* Right Panel - Log / Summary */}
                <div className="agg-panel agg-log-panel">
                    <div className="agg-panel-header">
                        <h2 className="agg-panel-title">
                            {showSummary ? 'Division Summary' : 'Log'}
                        </h2>
                        {showSummary && (
                            <button
                                onClick={() => setShowSummary(false)}
                                className="agg-btn agg-btn-sm"
                            >
                                ← Back to Log
                            </button>
                        )}
                    </div>

                    {showSummary ? (
                        /* Summary Table */
                        <div className="agg-summary-table-wrapper">
                            <table className="agg-summary-table">
                                <thead>
                                    <tr>
                                        <th>Division</th>
                                        <th>Gangs</th>
                                        <th>Employees</th>
                                        <th>HK</th>
                                        <th>Total Upah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="agg-empty-row">
                                                No data for this period
                                            </td>
                                        </tr>
                                    ) : (
                                        summaryData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td>{row.division_code}</td>
                                                <td className="text-right">{formatNumber(row.gang_count)}</td>
                                                <td className="text-right">{formatNumber(row.total_emp)}</td>
                                                <td className="text-right">{formatNumber(row.total_hk)}</td>
                                                <td className="text-right">{formatCurrency(row.total_upah)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {grandTotal && (
                                    <tfoot>
                                        <tr className="agg-total-row">
                                            <td>TOTAL</td>
                                            <td className="text-right">{formatNumber(grandTotal.gang_count)}</td>
                                            <td className="text-right">{formatNumber(grandTotal.total_emp)}</td>
                                            <td className="text-right">{formatNumber(grandTotal.total_hk)}</td>
                                            <td className="text-right">{formatCurrency(grandTotal.total_upah)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    ) : (
                        /* Log Panel */
                        <div className="agg-log-content">
                            {logs.length === 0 ? (
                                <div className="agg-log-empty">
                                    Waiting for action...
                                </div>
                            ) : (
                                logs.map((log, idx) => (
                                    <div key={idx} className={`agg-log-entry ${log.type}`}>
                                        <span className="agg-log-time">[{log.timestamp}]</span>
                                        <span className="agg-log-msg">{log.message}</span>
                                    </div>
                                ))
                            )}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="agg-footer">
                <span>User: {user?.username}</span>
                <span>Period: {formatMonthName(month)} {year}</span>
            </div>
        </div>
    );
}
