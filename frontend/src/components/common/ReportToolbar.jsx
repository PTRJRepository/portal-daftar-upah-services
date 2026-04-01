import React, { useCallback } from 'react'
import CompactPeriodScroll from './CompactPeriodScroll'

// ─── SVG Icons (inline, no emoji) ───────────────────────────────────────────
const IconBack = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
)

const IconRefresh = ({ spinning }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'transform 0.3s', transform: spinning ? 'rotate(180deg)' : 'rotate(0deg)' }}>
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
)

const IconDownload = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
)

const IconExport = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
)

const IconEdit = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
)

// ─── Shared Select Styles ────────────────────────────────────────────────────
const SELECT_STYLE = {
    height: '34px',
    padding: '0 10px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#1e293b',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: "inherit",
}

// ─── Toolbar Button Styles ───────────────────────────────────────────────────
const TBtn = ({ onClick, disabled, title, children, variant = 'default', active = false }) => {
    const base = {
        height: '34px',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
    }

    let styles = { ...base }

    if (variant === 'primary') {
        styles = {
            ...styles,
            backgroundColor: '#1d4ed8',
            border: '1px solid #1d4ed8',
            color: '#ffffff',
        }
    } else if (variant === 'success') {
        styles = {
            ...styles,
            backgroundColor: active ? '#dcfce7' : '#f0fdf4',
            border: `1px solid ${active ? '#16a34a' : '#86efac'}`,
            color: active ? '#15803d' : '#16a34a',
        }
    } else if (variant === 'warning') {
        styles = {
            ...styles,
            backgroundColor: active ? '#fef3c7' : '#fffbeb',
            border: `1px solid ${active ? '#d97706' : '#fcd34d'}`,
            color: active ? '#b45309' : '#d97706',
        }
    } else {
        styles = {
            ...styles,
            backgroundColor: active ? '#eff6ff' : '#ffffff',
            border: `1px solid ${active ? '#3b82f6' : '#cbd5e1'}`,
            color: active ? '#1d4ed8' : '#475569',
        }
    }

    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            title={title}
            style={styles}
            onMouseOver={(e) => {
                if (!disabled && !active) {
                    if (variant === 'primary') e.currentTarget.style.backgroundColor = '#1e40af'
                    else if (variant === 'success') { e.currentTarget.style.backgroundColor = '#dcfce7'; e.currentTarget.style.borderColor = '#16a34a' }
                    else if (variant === 'warning') { e.currentTarget.style.backgroundColor = '#fef3c7'; e.currentTarget.style.borderColor = '#d97706' }
                    else { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8' }
                }
            }}
            onMouseOut={(e) => {
                if (!active) {
                    if (variant === 'primary') e.currentTarget.style.backgroundColor = '#1d4ed8'
                    else if (variant === 'success') { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.borderColor = '#86efac' }
                    else if (variant === 'warning') { e.currentTarget.style.backgroundColor = '#fffbeb'; e.currentTarget.style.borderColor = '#fcd34d' }
                    else { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1' }
                }
            }}
        >
            {children}
        </button>
    )
}

// ─── View Mode Toggle ────────────────────────────────────────────────────────
function ViewModeToggle({ viewMode, onChange, disabled }) {
    const modes = [
        { key: 'table', label: 'Daftar Upah' },
        { key: 'attendance', label: 'Absensi' },
        { key: 'overtime', label: 'Lembur' },
        { key: 'employee', label: 'Karyawan' },
    ]

    return (
        <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            gap: '2px',
        }}>
            {modes.map(mode => (
                <button
                    key={mode.key}
                    onClick={() => onChange(mode.key)}
                    disabled={disabled}
                    style={{
                        border: 'none',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        backgroundColor: viewMode === mode.key ? '#ffffff' : 'transparent',
                        color: viewMode === mode.key ? '#1d4ed8' : '#64748b',
                        boxShadow: viewMode === mode.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        opacity: disabled ? 0.5 : 1,
                        fontFamily: "inherit",
                        whiteSpace: 'nowrap',
                    }}
                >
                    {mode.label}
                </button>
            ))}
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────
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
    // Helper to extract Asistensi (Group)
    // Rule: K2 gangs belong to Group 1 (special estate classification).
    // For all other gangs, extract the first digit found in the gang code.
    const getAsistensi = useCallback((gc, div) => {
        if (!gc) return null;
        const g = gc.trim().toUpperCase();
        // K2 gangs belong to Group 1 (special classification)
        if (g.startsWith('K2')) return '1';
        // Find the first digit in the string for other patterns (e.g., A1H → '1', K1H → '1')
        const match = g.match(/\d/);
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
        <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            width: '100%',
            padding: '6px 0',
            backgroundColor: 'transparent',
        }}>
            {/* ── Nav Buttons ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '4px' }}>
                {onBack && (
                    <TBtn onClick={onBack} disabled={disableControls} title="Kembali">
                        <IconBack /> Kembali
                    </TBtn>
                )}
                {onRefresh && (
                    <TBtn onClick={onRefresh} disabled={disableControls} title="Refresh Data">
                        <IconRefresh />
                    </TBtn>
                )}
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }} />

            {/* ── Period ─────────────────────────────────────────────── */}
            <CompactPeriodScroll
                month={month}
                year={year}
                onChange={onMonthYearChange}
                disableControls={disableControls}
            />

            {/* Divider */}
            <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }} />

            {/* ── Filters ────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {divisions && divisions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Divisi</label>
                        <select
                            style={SELECT_STYLE}
                            value={division || ''}
                            onChange={(e) => onDivisionChange && onDivisionChange(e.target.value)}
                            disabled={disableControls}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)' }}
                            onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none' }}
                        >
                            {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group</label>
                    <select
                        style={{
                            ...SELECT_STYLE,
                            minWidth: '110px',
                            backgroundColor: gangPrefix ? '#eff6ff' : '#ffffff',
                            borderColor: gangPrefix ? '#3b82f6' : '#cbd5e1',
                        }}
                        value={gangPrefix || ''}
                        onChange={(e) => {
                            const newPrefix = e.target.value;
                            onGangPrefixChange && onGangPrefixChange(newPrefix);
                            // When group changes (regardless of selecting SEMUA GROUP or a specific group), reset gang to ALL
                            onGangChange && onGangChange('ALL');
                        }}
                        disabled={disableControls || !division}
                        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)' }}
                        onBlur={(e) => { e.target.style.borderColor = gangPrefix ? '#3b82f6' : '#cbd5e1'; e.target.style.boxShadow = 'none' }}
                    >
                        <option value="">SEMUA</option>
                        {availablePrefixes.map(p => (
                            <option key={p} value={p}>Group {p}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kemandoran</label>
                    <select
                        style={{
                            ...SELECT_STYLE,
                            minWidth: '180px',
                            maxWidth: '260px',
                            backgroundColor: gangCode === 'ALL' ? '#f0fdf4' : '#ffffff',
                            borderColor: gangCode === 'ALL' ? '#86efac' : '#cbd5e1',
                        }}
                        value={gangCode || ''}
                        onChange={(e) => {
                            const selectedGang = e.target.value;
                            if (selectedGang === 'ALL') {
                                // Reset group filter too when selecting ALL gangs
                                onGangPrefixChange && onGangPrefixChange('');
                                onGangChange('ALL');
                            } else {
                                // Auto-update group prefix when selecting specific gang
                                onGangChange(selectedGang);
                            }
                        }}
                        disabled={disableControls}
                        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)' }}
                        onBlur={(e) => { e.target.style.borderColor = gangCode === 'ALL' ? '#86efac' : '#cbd5e1'; e.target.style.boxShadow = 'none' }}
                    >
                        {/* When group filter is active, show contextual ALL option */}
                        {gangPrefix ? (
                            <option value="ALL">
                                SEMUA GANG – Group {gangPrefix} ({gangs.filter(g => getAsistensi(g.gang_code, division) === gangPrefix).length} gang)
                            </option>
                        ) : (
                            <option value="ALL">SEMUA GANG</option>
                        )}
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

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* ── View Mode Toggle ─────────────────────────────────── */}
            {onViewModeChange && (
                <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} disabled={disableControls} />
            )}

            {/* ── Action Buttons ─────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '6px' }}>
                {onDownloadExcel && (
                    <TBtn
                        onClick={onDownloadExcel}
                        disabled={disableControls || isDownloadingExcel}
                        title="Download Excel"
                        variant="success"
                    >
                        <IconDownload />
                        {isDownloadingExcel ? '...' : 'Excel'}
                    </TBtn>
                )}

                {onExport && (
                    <TBtn
                        onClick={onExport}
                        disabled={disableControls}
                        title="Export Data"
                    >
                        <IconExport /> Export
                    </TBtn>
                )}

                {onEditModeToggle && (
                    <TBtn
                        onClick={onEditModeToggle}
                        disabled={disableControls}
                        title={editMode ? "Matikan Edit Mode" : "Aktifkan Edit Mode"}
                        variant={editMode ? 'warning' : 'default'}
                        active={editMode}
                    >
                        <IconEdit />
                        {editMode ? 'Lock NIK' : 'Edit NIK'}
                    </TBtn>
                )}

                {onHistoryChange && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="checkbox"
                            checked={useHistory}
                            onChange={(e) => onHistoryChange(e.target.checked)}
                            disabled={disableControls}
                            style={{ width: '14px', height: '14px', cursor: disableControls ? 'not-allowed' : 'pointer' }}
                        />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>History</span>
                    </div>
                )}
            </div>
        </div>
    )
}

