import React from 'react';

const MONTHS = [
    { value: 1, label: 'JAN' }, { value: 2, label: 'FEB' }, { value: 3, label: 'MAR' },
    { value: 4, label: 'APR' }, { value: 5, label: 'MEI' }, { value: 6, label: 'JUN' },
    { value: 7, label: 'JUL' }, { value: 8, label: 'AGU' }, { value: 9, label: 'SEP' },
    { value: 10, label: 'OKT' }, { value: 11, label: 'NOV' }, { value: 12, label: 'DES' }
];

/**
 * Formal Calendar-style Month Selector
 * Displays a year navigator and a 12-month grid.
 */
export default function MonthSelector({ month, year, onChange }) {
    const handlePrevYear = () => {
        // Just update year, keep month (or handle logic to clamp month if needed)
        onChange(month, year - 1);
    };

    const handleNextYear = () => {
        onChange(month, year + 1);
    };

    const handleMonthClick = (m) => {
        onChange(m, year);
    };

    const isCurrentCalendarMonth = (m, y) => {
        const now = new Date();
        return now.getMonth() + 1 === m && now.getFullYear() === y;
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            width: '100%',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '1rem'
        }}>
            {/* Year Navigation */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
            }}>
                <button
                    onClick={handlePrevYear}
                    style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '0.4rem 0.8rem',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.target.style.borderColor = '#94a3b8'; e.target.style.color = '#334155'; }}
                    onMouseOut={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#64748b'; }}
                >
                    &lt;
                </button>

                <div style={{
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: '#1e3a8a', // Navy Blue
                    letterSpacing: '0.05em'
                }}>
                    {year}
                </div>

                <button
                    onClick={handleNextYear}
                    style={{
                        background: 'none',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '0.4rem 0.8rem',
                        cursor: 'pointer',
                        color: '#64748b',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.target.style.borderColor = '#94a3b8'; e.target.style.color = '#334155'; }}
                    onMouseOut={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.color = '#64748b'; }}
                >
                    &gt;
                </button>
            </div>

            {/* Month Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)', // 4 columns x 3 rows
                gap: '0.5rem'
            }}>
                {MONTHS.map((m) => {
                    const isSelected = m.value === month;
                    const isCurrent = isCurrentCalendarMonth(m.value, year);

                    return (
                        <button
                            key={m.value}
                            onClick={() => handleMonthClick(m.value)}
                            style={{
                                padding: '0.6rem 0.2rem',
                                backgroundColor: isSelected ? '#1e3a8a' : (isCurrent ? '#f8fafc' : 'white'),
                                color: isSelected ? 'white' : (isCurrent ? '#1e3a8a' : '#475569'),
                                border: isSelected ? '1px solid #1e3a8a' : (isCurrent ? '1px solid #93c5fd' : '1px solid #e2e8f0'),
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: isSelected || isCurrent ? '600' : '500',
                                cursor: 'pointer',
                                transition: 'all 0.1s',
                                textAlign: 'center'
                            }}
                            onMouseOver={(e) => {
                                if (!isSelected) {
                                    e.target.style.backgroundColor = '#f1f5f9';
                                    e.target.style.borderColor = '#cbd5e1';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isSelected) {
                                    e.target.style.backgroundColor = isCurrent ? '#f8fafc' : 'white';
                                    e.target.style.borderColor = isCurrent ? '#93c5fd' : '#e2e8f0';
                                }
                            }}
                        >
                            {m.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
