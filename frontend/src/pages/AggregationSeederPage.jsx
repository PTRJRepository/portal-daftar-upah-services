/**
 * AggregationSeederPage - Web UI for Payroll Aggregation Seeder
 * Equivalent to the Python Tkinter gui_app.py but as a React component
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
    formatMonthName,
    formatCurrency,
    formatNumber
} from '../services/aggregationSeederService';
import '../styles/aggregation-seeder.css';

export default function AggregationSeederPage({ onBack }) {
    const { token, user } = useAuth();

    // Parameters
    const [division, setDivision] = useState('ALL');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [syncType, setSyncType] = useState('DAFTAR_UPAH');

    // Data
    const [divisions, setDivisions] = useState(['ALL']);
    const [summaryData, setSummaryData] = useState([]);
    const [grandTotal, setGrandTotal] = useState(null);

    // State
    const [isRunning, setIsRunning] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('checking');
    const [logs, setLogs] = useState([]);
    const [showSummary, setShowSummary] = useState(false);

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

    // Check connection on mount
    useEffect(() => {
        async function checkConnection() {
            if (!token) return;
            setConnectionStatus('checking');
            addLog('🔌 Checking database connection...');
            try {
                const result = await checkAggregationHealth(token);
                if (result.success) {
                    setConnectionStatus('connected');
                    addLog('✅ Database connection OK', 'success');
                } else {
                    setConnectionStatus('error');
                    addLog(`❌ Connection failed: ${result.message}`, 'error');
                }
            } catch (e) {
                setConnectionStatus('error');
                addLog(`❌ Connection error: ${e.message}`, 'error');
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

    // Clear logs
    const handleClearLogs = () => {
        setLogs([]);
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
