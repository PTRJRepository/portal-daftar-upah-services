import React, { useRef, useCallback, useState, useEffect } from 'react'
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
    viewMode = 'table', // 'table' | 'matrix'
    onViewModeChange,
    usePeriodSlider = false,  // New prop to enable period slider
    onTogglePeriodSlider = null,  // Callback to toggle between modes
    currentProductionMonth = null,  // Current production month for history indicator
    currentProductionYear = null,  // Current production year for history indicator
    useHistoryDb = false  // Flag to show if system is using history database mode
}) {
    const MONTHS = [
        { value: 1, label: 'Jan', full: 'Januari', emoji: '❄️' },
        { value: 2, label: 'Feb', full: 'Februari', emoji: '💜' },
        { value: 3, label: 'Mar', full: 'Maret', emoji: '🌸' },
        { value: 4, label: 'Apr', full: 'April', emoji: '🌷' },
        { value: 5, label: 'Mei', full: 'Mei', emoji: '🌺' },
        { value: 6, label: 'Jun', full: 'Juni', emoji: '☀️' },
        { value: 7, label: 'Jul', full: 'Juli', emoji: '🏖️' },
        { value: 8, label: 'Ags', full: 'Agustus', emoji: '🌻' },
        { value: 9, label: 'Sep', full: 'September', emoji: '🍂' },
        { value: 10, label: 'Okt', full: 'Oktober', emoji: '🍁' },
        { value: 11, label: 'Nov', full: 'November', emoji: '🌧️' },
        { value: 12, label: 'Des', full: 'Desember', emoji: '🎄' }
    ]
    const currentYear = new Date().getFullYear()
    const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

    const [showMonthDropdown, setShowMonthDropdown] = useState(false)
    const monthDropdownRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target)) {
                setShowMonthDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

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

    const handleMonthChange = (e) => {
        const m = parseInt(e.target.value, 10)
        if (!isNaN(m) && onMonthYearChange) {
            onMonthYearChange(m, year)
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

            {/* Period Controls - Interactive Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }} ref={monthDropdownRef}>
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Periode</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button
                        onClick={() => incrementMonth(-1)}
                        disabled={disableControls}
                        title="Bulan Sebelumnya"
                        style={{
                            width: '28px', height: '32px',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: '6px 0 0 6px',
                            background: 'white',
                            cursor: disableControls ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', color: '#64748b',
                            transition: 'all 0.15s'
                        }}
                        onMouseOver={(e) => { if (!disableControls) { e.target.style.background = '#f1f5f9'; e.target.style.color = '#3b82f6' }}}
                        onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.color = '#64748b' }}
                    >
                        ◀
                    </button>
                    <div
                        onClick={() => !disableControls && setShowMonthDropdown(!showMonthDropdown)}
                        style={{
                            height: '32px',
                            minWidth: '140px',
                            border: '1px solid var(--neutral-300)',
                            borderLeft: 'none',
                            borderRight: 'none',
                            background: showMonthDropdown ? '#eff6ff' : 'white',
                            cursor: disableControls ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: showMonthDropdown ? '#1d4ed8' : '#1e293b',
                            transition: 'all 0.15s',
                            userSelect: 'none',
                            position: 'relative'
                        }}
                    >
                        <span>{MONTHS.find(m => m.value === Number(month))?.emoji || '📅'}</span>
                        <span>{MONTHS.find(m => m.value === Number(month))?.full || 'Bulan'} {year}</span>
                        <span style={{ fontSize: '8px', marginLeft: '2px', transform: showMonthDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>

                        {/* Month Grid Dropdown */}
                        {showMonthDropdown && !disableControls && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 100,
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                padding: '12px',
                                marginTop: '4px',
                                minWidth: '280px'
                            }}>
                                {/* Year Selector */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onMonthYearChange && onMonthYearChange(month, Number(year) - 1) }}
                                        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                    >◀</button>
                                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', minWidth: '50px', textAlign: 'center' }}>{year}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onMonthYearChange && onMonthYearChange(month, Number(year) + 1) }}
                                        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                    >▶</button>
                                </div>
                                {/* Month Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                    {MONTHS.map(m => {
                                        const isSelected = Number(month) === m.value
                                        const isCurrentMonth = m.value === new Date().getMonth() + 1 && Number(year) === currentYear
                                        return (
                                            <button
                                                key={m.value}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onMonthYearChange && onMonthYearChange(m.value, year)
                                                    setShowMonthDropdown(false)
                                                }}
                                                style={{
                                                    padding: '8px 4px',
                                                    borderRadius: '6px',
                                                    border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                    background: isSelected ? '#eff6ff' : isCurrentMonth ? '#fefce8' : 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                                                    transition: 'all 0.15s',
                                                    fontSize: '10px',
                                                    color: isSelected ? '#1d4ed8' : '#475569',
                                                    fontWeight: isSelected ? '700' : '500'
                                                }}
                                                onMouseOver={(e) => { if (!isSelected) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1' }}}
                                                onMouseOut={(e) => { if (!isSelected) { e.currentTarget.style.background = isCurrentMonth ? '#fefce8' : 'white'; e.currentTarget.style.borderColor = '#e2e8f0' }}}
                                            >
                                                <span style={{ fontSize: '14px' }}>{m.emoji}</span>
                                                <span>{m.label}</span>
                                                {isCurrentMonth && !isSelected && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#eab308' }}></span>}
                                            </button>
                                        )
                                    })}
                                </div>
                                {/* Quick Actions */}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const now = new Date()
                                            onMonthYearChange && onMonthYearChange(now.getMonth() + 1, now.getFullYear())
                                            setShowMonthDropdown(false)
                                        }}
                                        style={{
                                            flex: 1, padding: '6px', borderRadius: '6px',
                                            background: '#dcfce7', border: '1px solid #86efac',
                                            color: '#15803d', fontSize: '11px', fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📅 Bulan Ini
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => incrementMonth(1)}
                        disabled={disableControls}
                        title="Bulan Berikutnya"
                        style={{
                            width: '28px', height: '32px',
                            border: '1px solid var(--neutral-300)',
                            borderRadius: '0 6px 6px 0',
                            background: 'white',
                            cursor: disableControls ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', color: '#64748b',
                            transition: 'all 0.15s'
                        }}
                        onMouseOver={(e) => { if (!disableControls) { e.target.style.background = '#f1f5f9'; e.target.style.color = '#3b82f6' }}}
                        onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.color = '#64748b' }}
                    >
                        ▶
                    </button>
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

            {/* View Mode Toggle */}
            {onViewModeChange && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto', marginRight: '8px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', visibility: 'hidden' }}>
                        Tampilan
                    </label>
                    <div style={{
                        display: 'flex',
                        background: 'var(--neutral-100)',
                        border: '1px solid var(--neutral-300)',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        height: '36px'
                    }}>
                        <button
                            onClick={() => onViewModeChange('table')}
                            disabled={disableControls || viewMode === 'table'}
                            style={{
                                flex: 1,
                                border: 'none',
                                background: viewMode === 'table' ? 'white' : 'transparent',
                                color: viewMode === 'table' ? 'var(--primary-700)' : 'var(--neutral-600)',
                                fontWeight: viewMode === 'table' ? '600' : '500',
                                padding: '0 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            💰 Daftar Upah
                        </button>
                        <button
                            onClick={() => onViewModeChange('matrix')}
                            disabled={disableControls || viewMode === 'matrix'}
                            style={{
                                flex: 1,
                                border: 'none',
                                background: viewMode === 'matrix' ? 'white' : 'transparent',
                                color: viewMode === 'matrix' ? '#8b5cf6' : 'var(--neutral-600)',
                                fontWeight: viewMode === 'matrix' ? '600' : '500',
                                padding: '0 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: viewMode === 'matrix' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            📋 Matrix Absensi
                        </button>
                    </div>
                </div>
            )}

            {/* Export Toggle */}
            {onExport && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: onViewModeChange ? '0' : 'auto' }}>
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
