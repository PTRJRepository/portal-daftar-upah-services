import React from 'react'

export default function ReportToolbar({
    division,
    divisions,
    onDivisionChange,
    month,
    year,
    gangCode,
    gangs = [],  // Changed from availableGangs to gangs (full objects with description)
    onMonthYearChange,
    onGangChange,
    onBack,
    onRefresh,
    disableControls = false
}) {
    // Helper to format month-year for input type="month"
    const getMonthValue = () => {
        if (!month || !year) return ''
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
    }

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

    // Get display text for selected gang
    const getSelectedGangDisplay = () => {
        if (!gangCode) return '';
        if (String(gangCode).toUpperCase() === 'ALL') return 'SEMUA GANG';
        const found = gangs.find(g => g.gang_code === gangCode);
        return found?.description ? `${gangCode} - ${found.description}` : gangCode;
    };

    return (
        <div className="report-toolbar" style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
            width: '100%',
            padding: '8px 0'
        }}>
            {onBack && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', visibility: 'hidden' }}>
                        Aksi
                    </label>
                    <button
                        className="btn btn-secondary"
                        onClick={onBack}
                        disabled={disableControls}
                        style={{
                            borderColor: 'var(--neutral-300)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '36px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>⬅️</span> Back
                    </button>
                </div>
            )}

            {onRefresh && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', visibility: 'hidden' }}>
                        Aksi
                    </label>
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
                            gap: '6px',
                            height: '36px',
                            minWidth: '36px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>🔄</span>
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Periode
                </label>
                <input
                    type="month"
                    className="input-field"
                    style={{ height: '36px', minWidth: '160px' }}
                    value={getMonthValue()}
                    onChange={handleDateChange}
                    disabled={disableControls}
                />
            </div>

            {divisions && divisions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Divisi
                    </label>
                    <select
                        className="input-field"
                        style={{ height: '36px', minWidth: '140px' }}
                        value={division || ''}
                        onChange={(e) => onDivisionChange && onDivisionChange(e.target.value)}
                        disabled={disableControls}
                    >
                        {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Gang / Kemandoran
                </label>
                <select
                    className="input-field"
                    style={{ height: '36px', minWidth: '280px', maxWidth: '400px' }}
                    value={gangCode || ''}
                    onChange={(e) => onGangChange(e.target.value)}
                    disabled={disableControls}
                >
                    {/* Always show "SEMUA GANG" option at the top */}
                    <option value="ALL">🌐 SEMUA GANG</option>
                    {gangs && gangs.length > 0 ? (
                        gangs.map(g => (
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
    )
}
