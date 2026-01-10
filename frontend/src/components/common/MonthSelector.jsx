import React, { useMemo } from 'react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/**
 * Calendar-style Month Selector
 * Shows current month + 4 previous months with year navigation
 */
export default function MonthSelector({ month, year, onChange }) {
    // Generate the 5 months to display (current + 4 previous)
    const monthOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Start from current month, go back 4 months
        for (let i = 0; i < 5; i++) {
            let m = currentMonth - i;
            let y = currentYear;

            // Handle year rollover
            while (m < 1) {
                m += 12;
                y -= 1;
            }

            options.push({ month: m, year: y });
        }

        return options;
    }, []);

    // Custom months if user navigates to different year
    const customOptions = useMemo(() => {
        // Check if selected month/year is in monthOptions
        const isInOptions = monthOptions.some(opt => opt.month === month && opt.year === year);

        if (!isInOptions && month && year) {
            // Generate 5 months starting from selected month
            const options = [];
            for (let i = 0; i < 5; i++) {
                let m = month - i;
                let y = year;
                while (m < 1) {
                    m += 12;
                    y -= 1;
                }
                options.push({ month: m, year: y });
            }
            return options;
        }
        return null;
    }, [month, year, monthOptions]);

    const displayOptions = customOptions || monthOptions;

    const handleMonthClick = (m, y) => {
        onChange(m, y);
    };

    const handlePrevYear = () => {
        // Go back 12 months
        let newMonth = month;
        let newYear = year - 1;
        onChange(newMonth, newYear);
    };

    const handleNextYear = () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Don't allow going beyond current month
        let newYear = year + 1;
        if (newYear > currentYear || (newYear === currentYear && month > currentMonth)) {
            newYear = currentYear;
        }
        onChange(month, newYear);
    };

    const handleResetToNow = () => {
        const now = new Date();
        onChange(now.getMonth() + 1, now.getFullYear());
    };

    const isCurrentMonth = (m, y) => {
        const now = new Date();
        return m === now.getMonth() + 1 && y === now.getFullYear();
    };

    const isSelected = (m, y) => m === month && y === year;

    // Check if we can go forward (not beyond current month)
    const now = new Date();
    const canGoNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            borderRadius: '12px',
            border: '1px solid #cbd5e1'
        }}>
            {/* Year Navigation */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px'
            }}>
                <button
                    onClick={handlePrevYear}
                    style={{
                        background: '#1a365d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    ◀ {year - 1}
                </button>

                <div style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1a365d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    📅 {year}
                    {customOptions && (
                        <button
                            onClick={handleResetToNow}
                            style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                            title="Kembali ke bulan sekarang"
                        >
                            Sekarang
                        </button>
                    )}
                </div>

                <button
                    onClick={handleNextYear}
                    disabled={!canGoNext}
                    style={{
                        background: canGoNext ? '#1a365d' : '#94a3b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: canGoNext ? 'pointer' : 'not-allowed',
                        fontWeight: '600',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    {year + 1} ▶
                </button>
            </div>

            {/* Month Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px'
            }}>
                {displayOptions.map(({ month: m, year: y }) => {
                    const selected = isSelected(m, y);
                    const current = isCurrentMonth(m, y);

                    return (
                        <button
                            key={`${y}-${m}`}
                            onClick={() => handleMonthClick(m, y)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '10px 8px',
                                borderRadius: '8px',
                                border: selected ? '2px solid #1a365d' : current ? '2px solid #10b981' : '1px solid #e2e8f0',
                                background: selected ? '#1a365d' : current ? '#ecfdf5' : 'white',
                                color: selected ? 'white' : '#1e293b',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: selected ? '0 4px 12px rgba(26, 54, 93, 0.3)' : '0 1px 3px rgba(0,0,0,0.1)'
                            }}
                        >
                            <span style={{ fontSize: '15px', fontWeight: '700' }}>
                                {MONTH_NAMES[m - 1]}
                            </span>
                            <span style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                                {y}
                            </span>
                            {current && !selected && (
                                <span style={{
                                    fontSize: '9px',
                                    background: '#10b981',
                                    color: 'white',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    marginTop: '3px'
                                }}>
                                    Now
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected Period Display */}
            <div style={{
                textAlign: 'center',
                padding: '8px',
                background: '#1a365d',
                color: 'white',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600'
            }}>
                Periode: {MONTH_NAMES_FULL[month - 1]} {year}
            </div>
        </div>
    );
}
