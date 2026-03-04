import React, { useRef, useCallback, useState } from 'react'
import PeriodSlider from './PeriodSlider'

export default function ReportToolbar({
    division,
    divisions,
    onDivisionChange,
    month,
    year,
    gangCode,
    gangs = [],  // Changed from availableGangs to gangs (full objects with description)
    gangPrefix = '', // New prop for Asistensi
    onGangPrefixChange, // New prop
    onMonthYearChange,
    onGangChange,
    onBack,
    onRefresh,
    disableControls = false,
    editMode = false,
    onEditModeToggle,
    onExport,
    usePeriodSlider = false,  // New prop to enable period slider
    onTogglePeriodSlider = null,  // Callback to toggle between modes
    currentProductionMonth = null,  // Current production month for history indicator
    currentProductionYear = null,  // Current production year for history indicator
    useHistoryDb = false  // Flag to show if system is using history database mode
}) {
    // Helper to format month-year for input type="month"
    const getMonthValue = () => {
        if (!month || !year) return ''
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
    }

    const incrementMonth = useCallback((amount) => {
        if (!month || !year || disableControls) return;

        let newMonth = parseInt(month, 10) + amount;
        let newYear = parseInt(year, 10);

        if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        }

        if (onMonthYearChange) {
            onMonthYearChange(newMonth, newYear);
        }
    }, [month, year, disableControls, onMonthYearChange]);

    const touchStartX = useRef(null);
    const lastWheelTime = useRef(0);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (touchStartX.current === null || disableControls) return;

        const touchEndX = e.changedTouches[0].clientX;
        const diffX = touchStartX.current - touchEndX;

        if (Math.abs(diffX) > 40) { // swipe threshold
            if (diffX > 0) {
                incrementMonth(1); // Swipe left -> Next
            } else {
                incrementMonth(-1); // Swipe right -> Prev
            }
        }
        touchStartX.current = null;
    };

    const handleWheel = (e) => {
        if (disableControls) return;

        const now = Date.now();
        if (now - lastWheelTime.current < 400) {
            return; // Throttle wheel events
        }

        if (Math.abs(e.deltaX) > 10 || Math.abs(e.deltaY) > 10) {
            if (e.deltaX > 0 || e.deltaY > 0) {
                incrementMonth(1);
                lastWheelTime.current = now;
            } else if (e.deltaX < 0 || e.deltaY < 0) {
                incrementMonth(-1);
                lastWheelTime.current = now;
            }
        }
    };

    const handleDateChange = (e) => {
        try {
            const val = e.target.value
            if (!val) return
            const [yyyy, mm] = val.split('-')
            const m = parseInt(mm, 10)
            const y = parseInt(yyyy, 10)
            if (!isNaN(m) && !isNaN(y)) {
                onMonthYearChange(m, y)
            }
        } catch (err) {
            console.error('Date parse error:', err)
        }
    }

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
        <div className="report-toolbar" style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            width: '100%',
            padding: '4px 0'
        }}>
            {onBack && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={onBack}
                        disabled={disableControls}
                        style={{
                            borderColor: 'var(--neutral-300)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            height: '32px',
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>⬅️</span>
                    </button>
                </div>
            )}

            {onRefresh && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={onRefresh}
                        disabled={disableControls}
                        title="Refresh Data"
                        style={{
                            borderColor: 'var(--neutral-300)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '32px',
                            minWidth: '32px'
                        }}
                    >
                        <span>🔄</span>
                    </button>
                </div>
            )}

            {/* Period Controls - Compact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Periode</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                        type="month"
                        className="input-field"
                        style={{ height: '32px', minWidth: '120px', fontSize: '12px', padding: '0 8px' }}
                        value={getMonthValue()}
                        onChange={handleDateChange}
                        disabled={disableControls}
                    />
                </div>
            </div>

            {divisions && divisions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Divisi</label>
                    <select
                        className="input-field"
                        style={{ height: '32px', minWidth: '80px', fontSize: '12px' }}
                        value={division || ''}
                        onChange={(e) => onDivisionChange && onDivisionChange(e.target.value)}
                        disabled={disableControls}
                    >
                        {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            )}

            {/* Group Selector - Always visible */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Group</label>
                <select
                    className="input-field"
                    style={{ height: '32px', minWidth: '110px', fontSize: '12px', backgroundColor: gangPrefix ? '#eff6ff' : 'white', borderColor: gangPrefix ? '#3b82f6' : undefined }}
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
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Kemandoran</label>
                <select
                    className="input-field"
                    style={{ height: '32px', minWidth: '180px', maxWidth: '250px', fontSize: '12px' }}
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

            {/* Export Toggle */}
            {onExport && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', visibility: 'hidden' }}>
                        Aksi
                    </label>
                    <button
                        className="btn btn-secondary"
                        onClick={onExport}
                        disabled={disableControls}
                        title="Export to Excel/CSV"
                        style={{
                            borderColor: 'var(--success-500)',
                            color: 'var(--success-700)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '36px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>📊</span> Export
                    </button>
                </div>
            )}

            {/* Edit Mode Toggle */}
            {onEditModeToggle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: onExport ? '0' : 'auto' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', visibility: 'hidden' }}>
                        Mode
                    </label>
                    <button
                        className={`btn ${editMode ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={onEditModeToggle}
                        disabled={disableControls}
                        title={editMode ? "Matikan Edit Mode NIK" : "Aktifkan Edit Mode NIK"}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '36px',
                            whiteSpace: 'nowrap',
                            backgroundColor: editMode ? '#ef4444' : undefined,
                            color: editMode ? 'white' : undefined
                        }}
                    >
                        <span>{editMode ? '🔒' : '✏️'}</span>
                        {editMode ? 'Disable Edit NIK' : 'Enable Edit NIK'}
                    </button>
                </div>
            )}
        </div>
    )
}
