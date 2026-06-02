import React, { useState } from 'react'

const MONTHS = [
    { value: 1, label: 'JAN', full: 'Januari' },
    { value: 2, label: 'FEB', full: 'Februari' },
    { value: 3, label: 'MAR', full: 'Maret' },
    { value: 4, label: 'APR', full: 'April' },
    { value: 5, label: 'MEI', full: 'Mei' },
    { value: 6, label: 'JUN', full: 'Juni' },
    { value: 7, label: 'JUL', full: 'Juli' },
    { value: 8, label: 'AGU', full: 'Agustus' },
    { value: 9, label: 'SEP', full: 'September' },
    { value: 10, label: 'OKT', full: 'Oktober' },
    { value: 11, label: 'NOV', full: 'November' },
    { value: 12, label: 'DES', full: 'Desember' }
]

/**
 * Professional Calendar-style Month Selector
 * Features:
 * - Year navigator with smooth animations
 * - 12-month grid with quarter grouping
 * - Current month highlight
 * - Selected month accent
 * - Quarter breakdown labels
 * - Quick navigation buttons (prev/next month, prev/next year)
 */
export default function MonthSelector({ month, year, selectedMonth: selectedMonthProp, selectedYear: selectedYearProp, onChange, setMonth, setYear, compact = false, disabled = false }) {
    const [hoveredMonth, setHoveredMonth] = useState(null)
    const selectedMonth = Number(month ?? selectedMonthProp) || 1
    const selectedYear = Number(year ?? selectedYearProp) || new Date().getFullYear()

    const emitChange = (nextMonth, nextYear) => {
        if (disabled) return
        if (typeof onChange === 'function') {
            onChange(nextMonth, nextYear)
            return
        }
        if (typeof setMonth === 'function') setMonth(nextMonth)
        if (typeof setYear === 'function') setYear(nextYear)
    }

    // Determine which quarter each month belongs to
    const getQuarter = (m) => Math.ceil(m / 3)

    // Check if this month is "current" (today's date)
    const isCurrentMonth = (m, y) => {
        const now = new Date()
        return now.getMonth() + 1 === m && now.getFullYear() === y
    }

    // Check if this month is in the future (relative to current month)
    const isFutureMonth = (m, y) => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        if (y > currentYear) return true
        if (y === currentYear && m > currentMonth) return true
        return false
    }

    const handlePrevYear = () => emitChange(selectedMonth, selectedYear - 1)
    const handleNextYear = () => emitChange(selectedMonth, selectedYear + 1)
    const handlePrevMonth = () => {
        if (selectedMonth === 1) emitChange(12, selectedYear - 1)
        else emitChange(selectedMonth - 1, selectedYear)
    }
    const handleNextMonth = () => {
        if (selectedMonth === 12) emitChange(1, selectedYear + 1)
        else emitChange(selectedMonth + 1, selectedYear)
    }
    const handleMonthClick = (m) => emitChange(m, selectedYear)

    if (compact) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '32px minmax(92px, 1fr) 72px 32px', gap: '0.35rem', alignItems: 'center', width: '100%', minWidth: 0 }}>
                <button type="button" onClick={handlePrevMonth} disabled={disabled} aria-label="Bulan sebelumnya" title="Bulan sebelumnya" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: disabled ? '#f1f5f9' : '#fff', color: '#475569', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer' }}>‹</button>
                <select value={selectedMonth} disabled={disabled} onChange={(event) => emitChange(Number(event.target.value), selectedYear)} aria-label="Pilih bulan" style={{ minWidth: 0, width: '100%', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: disabled ? '#f1f5f9' : '#fff', color: '#0f172a', fontSize: '0.82rem', fontWeight: 700, padding: '0 0.45rem', outline: 'none' }}>
                    {MONTHS.map((item) => <option key={item.value} value={item.value}>{item.full}</option>)}
                </select>
                <input value={selectedYear} disabled={disabled} onChange={(event) => emitChange(selectedMonth, Number(event.target.value) || selectedYear)} aria-label="Tahun" inputMode="numeric" style={{ width: '100%', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: disabled ? '#f1f5f9' : '#fff', color: '#0f172a', fontSize: '0.82rem', fontWeight: 700, padding: '0 0.45rem', outline: 'none', boxSizing: 'border-box' }} />
                <button type="button" onClick={handleNextMonth} disabled={disabled} aria-label="Bulan berikutnya" title="Bulan berikutnya" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: disabled ? '#f1f5f9' : '#fff', color: '#475569', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer' }}>›</button>
            </div>
        )
    }

    // Group months by quarter
    const quarters = [
        { label: 'Q1', labelFull: 'Triwulan I', months: MONTHS.slice(0, 3) },
        { label: 'Q2', labelFull: 'Triwulan II', months: MONTHS.slice(3, 6) },
        { label: 'Q3', labelFull: 'Triwulan III', months: MONTHS.slice(6, 9) },
        { label: 'Q4', labelFull: 'Triwulan IV', months: MONTHS.slice(9, 12) }
    ]

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: '100%',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem'
        }}>
            {/* Year Header with Navigation */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 4px'
            }}>
                <button
                    onClick={handlePrevYear}
                    title={`Tahun ${selectedYear - 1}`}
                    style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseOver={(e) => { e.target.style.borderColor = '#1e3a8a'; e.target.style.color = '#1e3a8a'; e.target.style.backgroundColor = '#eff6ff' }}
                    onMouseOut={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#64748b'; e.target.style.backgroundColor = 'transparent' }}
                >
                    «
                </button>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                }}>
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        color: '#1e3a8a',
                        letterSpacing: '0.1em',
                        lineHeight: 1
                    }}>
                        {selectedYear}
                    </div>
                    <div style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {MONTHS[selectedMonth - 1]?.full} {selectedYear}
                    </div>
                </div>

                <button
                    onClick={handleNextYear}
                    title={`Tahun ${selectedYear + 1}`}
                    style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseOver={(e) => { e.target.style.borderColor = '#1e3a8a'; e.target.style.color = '#1e3a8a'; e.target.style.backgroundColor = '#eff6ff' }}
                    onMouseOut={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#64748b'; e.target.style.backgroundColor = 'transparent' }}
                >
                    »
                </button>
            </div>

            {/* Quick Month Navigation */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid #f1f5f9',
                borderBottom: '1px solid #f1f5f9',
                padding: '6px 0'
            }}>
                <button
                    onClick={handlePrevMonth}
                    title={`Bulan sebelumnya`}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.15s'
                    }}
                    onMouseOver={(e) => { e.target.style.color = '#1e3a8a'; e.target.style.backgroundColor = '#eff6ff' }}
                    onMouseOut={(e) => { e.target.style.color = '#64748b'; e.target.style.backgroundColor = 'transparent' }}
                >
                    ← {MONTHS[selectedMonth === 1 ? 11 : selectedMonth - 2]?.full}
                </button>

                <div style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    Navigasi Cepat
                </div>

                <button
                    onClick={handleNextMonth}
                    title={`Bulan berikutnya`}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        transition: 'all 0.15s'
                    }}
                    onMouseOver={(e) => { e.target.style.color = '#1e3a8a'; e.target.style.backgroundColor = '#eff6ff' }}
                    onMouseOut={(e) => { e.target.style.color = '#64748b'; e.target.style.backgroundColor = 'transparent' }}
                >
                    {MONTHS[selectedMonth === 12 ? 0 : selectedMonth]?.full} →
                </button>
            </div>

            {/* Quarter Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {quarters.map(q => (
                    <div key={q.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {/* Quarter Label */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            paddingLeft: '2px'
                        }}>
                            <span style={{
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                {q.labelFull}
                            </span>
                            <div style={{
                                flex: 1,
                                height: '1px',
                                background: '#f1f5f9'
                            }} />
                        </div>

                        {/* Month Grid for Quarter */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '4px'
                        }}>
                            {q.months.map(m => {
                                const isSelected = m.value === selectedMonth
                                const isCurrent = isCurrentMonth(m.value, selectedYear)
                                const isHovered = hoveredMonth === m.value
                                const future = isFutureMonth(m.value, selectedYear)

                                return (
                                    <button
                                        key={m.value}
                                        onClick={() => handleMonthClick(m.value)}
                                        onMouseOver={() => setHoveredMonth(m.value)}
                                        onMouseOut={() => setHoveredMonth(null)}
                                        style={{
                                            padding: '8px 4px',
                                            backgroundColor: isSelected
                                                ? '#1e3a8a'
                                                : isHovered
                                                    ? '#eff6ff'
                                                    : isCurrent
                                                        ? '#f8fafc'
                                                        : 'white',
                                            color: isSelected
                                                ? 'white'
                                                : future
                                                    ? '#cbd5e1'
                                                    : isCurrent
                                                        ? '#1e3a8a'
                                                        : '#475569',
                                            border: isSelected
                                                ? '2px solid #1e3a8a'
                                                : isCurrent
                                                    ? '2px solid #93c5fd'
                                                    : '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            fontWeight: isSelected || isCurrent ? '700' : '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.1s',
                                            textAlign: 'center',
                                            position: 'relative',
                                            boxShadow: isSelected
                                                ? '0 2px 8px rgba(30, 58, 138, 0.3)'
                                                : 'none'
                                        }}
                                    >
                                        <div style={{ lineHeight: 1 }}>{m.label}</div>
                                        {isCurrent && !isSelected && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '2px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: '4px',
                                                height: '4px',
                                                borderRadius: '50%',
                                                background: '#3b82f6'
                                            }} />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                paddingTop: '4px',
                borderTop: '1px solid #f1f5f9'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Bulan ini</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#1e3a8a' }} />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Dipilih</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#e2e8f0' }} />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Mendatang</span>
                </div>
            </div>
        </div>
    )
}
