import React, { useRef, useCallback, useState, useEffect } from 'react'
import CompactPeriodScroll from './CompactPeriodScroll'

export default function ReportToolbar({
    division,
    divisions,
    onDivisionChange,
    month,
    year,
    gangCode,
    gangs = [],
    gangPrefix = '',
    onGangPrefixChange,
    onMonthYearChange,
    onGangChange,
    onBack,
    onRefresh,
    disableControls = false,
    editMode = false,
    onEditModeToggle,
    onExport,
    viewMode = 'table',
    onViewModeChange,
    useHistory = false,
    onHistoryChange = null,
    isDownloadingExcel = false,
    onDownloadExcel = null
}) {
    // Helper to extract Asistensi
    const getAsistensi = useCallback((gc, div) => {
        if (!gc) return null;
        const g = gc.trim().toUpperCase();
        if (g.startsWith('K2')) return "1";
        const match = g.match(/\d+/);
        return match ? match[0] : null;
    }, []);

    // Calculate available prefixes (Asistensi)
    const availablePrefixes = React.useMemo(() => {
        const prefixes = new Set();
        gangs.forEach(g => {
            const asist = getAsistensi(g.gang_code, division);
            if (asist) prefixes.add(asist);
        });
        return Array.from(prefixes).sort((a, b) => Number(a) - Number(b));
    }, [gangs, division, getAsistensi]);

    return (
        <div className="report-toolbar-v2" style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
            width: '100%',
            padding: '8px 0',
            backgroundColor: 'transparent'
        }}>
            {/* Group 1: Navigation & Period */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                paddingRight: '16px',
                borderRight: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {onBack && (
                        <button
                            className="toolbar-btn"
                            onClick={onBack}
                            disabled={disableControls}
                            title="Kembali"
                        >
                            ⬅️
                        </button>
                    )}
                    {onRefresh && (
                        <button
                            className="toolbar-btn"
                            onClick={onRefresh}
                            disabled={disableControls}
                            title="Refresh Data"
                        >
                            🔄
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label className="toolbar-label">Periode Laporan</label>
                    <CompactPeriodScroll 
                        month={month}
                        year={year}
                        onChange={onMonthYearChange}
                        disableControls={disableControls}
                    />
                </div>
            </div>

            {/* Group 2: Filters */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                paddingRight: '16px',
                borderRight: '1px solid #e2e8f0'
            }}>
                {divisions && divisions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <label className="toolbar-label">Divisi</label>
                        <select
                            className="toolbar-select"
                            style={{ minWidth: '100px' }}
                            value={division || ''}
                            onChange={(e) => onDivisionChange && onDivisionChange(e.target.value)}
                            disabled={disableControls}
                        >
                            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label className="toolbar-label">Group</label>
                    <select
                        className="toolbar-select"
                        style={{ 
                            minWidth: '120px',
                            backgroundColor: gangPrefix ? '#eff6ff' : 'white', 
                            borderColor: gangPrefix ? '#3b82f6' : '#e2e8f0' 
                        }}
                        value={gangPrefix || ''}
                        onChange={(e) => {
                            onGangPrefixChange && onGangPrefixChange(e.target.value);
                            if (e.target.value) onGangChange && onGangChange('ALL');
                        }}
                        disabled={disableControls || !division}
                    >
                        <option value="">SEMUA GROUP</option>
                        {availablePrefixes.map(p => (
                            <option key={p} value={p}>Group {p}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label className="toolbar-label">Kemandoran</label>
                    <select
                        className="toolbar-select"
                        style={{ minWidth: '200px', maxWidth: '280px' }}
                        value={gangCode || ''}
                        onChange={(e) => onGangChange(e.target.value)}
                        disabled={disableControls}
                    >
                        <option value="ALL">🌐 SEMUA GANG</option>
                        {gangs && gangs.length > 0 ? (
                            gangs
                                .filter(g => !gangPrefix || getAsistensi(g.gang_code, division) === gangPrefix)
                                .map(g => (
                                    <option key={g.gang_code} value={g.gang_code}>
                                        {g.gang_code}{g.description ? ` - ${g.description}` : ''}
                                    </option>
                                ))
                        ) : (
                            gangCode && gangCode !== 'ALL' && <option value={gangCode}>{gangCode}</option>
                        )}
                    </select>
                </div>
            </div>

            {/* Group 3: View & Modes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                {onViewModeChange && (
                    <div className="view-mode-toggle">
                        <button
                            onClick={() => onViewModeChange('table')}
                            className={`toggle-item ${viewMode === 'table' ? 'active' : ''}`}
                            disabled={disableControls}
                        >
                            💰 Daftar Upah
                        </button>
                        <button
                            onClick={() => onViewModeChange('attendance')}
                            className={`toggle-item ${viewMode === 'attendance' ? 'active' : ''}`}
                            disabled={disableControls}
                        >
                            📅 Absensi
                        </button>
                        <button
                            onClick={() => onViewModeChange('overtime')}
                            className={`toggle-item ${viewMode === 'overtime' ? 'active' : ''}`}
                            disabled={disableControls}
                        >
                            ⏰ Lembur
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    {onDownloadExcel && (
                        <button
                            className="action-btn excel-formula-btn"
                            onClick={onDownloadExcel}
                            disabled={disableControls || isDownloadingExcel}
                            title="Download Excel dengan Formula"
                        >
                            {isDownloadingExcel ? '⏳ ...' : '⬇️ Excel'}
                        </button>
                    )}

                    {onExport && (
                        <button
                            className="action-btn export-btn"
                            onClick={onExport}
                            disabled={disableControls}
                            title="Export Data"
                        >
                            <span>📊</span> Export
                        </button>
                    )}

                    {onEditModeToggle && (
                        <button
                            className={`action-btn ${editMode ? 'edit-active' : 'edit-inactive'}`}
                            onClick={onEditModeToggle}
                            disabled={disableControls}
                            title={editMode ? "Matikan Edit Mode" : "Aktifkan Edit Mode"}
                        >
                            <span>{editMode ? '🔒' : '✏️'}</span>
                            {editMode ? 'Lock NIK' : 'Edit NIK'}
                        </button>
                    )}

                    {onHistoryChange && (
                        <label className="history-toggle" title="Mode Database History">
                            <input 
                                type="checkbox" 
                                checked={useHistory} 
                                onChange={(e) => onHistoryChange(e.target.checked)}
                                disabled={disableControls}
                            />
                            <span>History</span>
                        </label>
                    )}
                </div>
            </div>

            <style>{`
                .toolbar-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                }
                .toolbar-btn {
                    height: 36px;
                    width: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .toolbar-btn:hover:not(:disabled) {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .toolbar-select {
                    height: 36px;
                    padding: 0 12px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #1e293b;
                    cursor: pointer;
                    outline: none;
                    transition: all 0.2s;
                }
                .toolbar-select:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .view-mode-toggle {
                    display: flex;
                    background: #f1f5f9;
                    padding: 3px;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                }
                .toggle-item {
                    border: none;
                    background: transparent;
                    padding: 6px 14px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    border-radius: 7px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .toggle-item.active {
                    background: white;
                    color: #2563eb;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .action-btn {
                    height: 36px;
                    padding: 0 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .export-btn {
                    background: #ecfdf5;
                    border: 1px solid #10b981;
                    color: #047857;
                }
                .export-btn:hover:not(:disabled) {
                    background: #d1fae5;
                }
                .excel-formula-btn {
                    background: #f0f9ff;
                    border: 1px solid #0ea5e9;
                    color: #0369a1;
                }
                .excel-formula-btn:hover:not(:disabled) {
                    background: #e0f2fe;
                }
                .history-toggle {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0 10px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    cursor: pointer;
                    height: 36px;
                }
                .history-toggle input {
                    width: 14px;
                    height: 14px;
                    accent-color: #2563eb;
                }
                .edit-inactive {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                }
                .edit-active {
                    background: #fef2f2;
                    border: 1px solid #ef4444;
                    color: #b91c1c;
                }
                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    )
}

