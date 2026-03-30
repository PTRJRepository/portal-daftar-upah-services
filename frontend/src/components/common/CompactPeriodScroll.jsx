import React, { useRef, useEffect, useMemo } from 'react'

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

export default function CompactPeriodScroll({
    month,
    year,
    onChange,
    minYear = 2024,
    disableControls = false
}) {
    const scrollRef = useRef(null)
    const activeRef = useRef(null)

    // Generate periods from minYear to current year + 1 month
    const periods = useMemo(() => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        
        const items = []
        // Start from minYear up to currentYear + 1 (to see upcoming)
        for (let y = minYear; y <= currentYear + 1; y++) {
            for (let m = 1; m <= 12; m++) {
                // If it's the future year, only show a few months
                if (y > currentYear && m > 3) break
                items.push({ month: m, year: y })
            }
        }
        return items
    }, [minYear])

    // Scroll to active element
    useEffect(() => {
        if (activeRef.current && scrollRef.current) {
            const container = scrollRef.current
            const active = activeRef.current
            
            const scrollPos = active.offsetLeft - (container.clientWidth / 2) + (active.clientWidth / 2)
            
            container.scrollTo({
                left: scrollPos,
                behavior: 'smooth'
            })
        }
    }, [month, year])

    const handlePeriodClick = (m, y) => {
        if (disableControls) return
        if (m === Number(month) && y === Number(year)) return
        onChange(m, y)
    }

    return (
        <div className="compact-period-scroll-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '200px',
            maxWidth: '400px'
        }}>
            <div 
                ref={scrollRef}
                className="compact-period-scroll-track"
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: '6px',
                    padding: '4px 2px',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE
                    scrollSnapType: 'x mandatory',
                    maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)'
                }}
            >
                {/* Hide scrollbar for Chrome/Safari */}
                <style>{`
                    .compact-period-scroll-track::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {periods.map((p, idx) => {
                    const isActive = Number(month) === p.month && Number(year) === p.year
                    const isToday = p.month === (new Date().getMonth() + 1) && p.year === new Date().getFullYear()
                    
                    return (
                        <button
                            key={`${p.year}-${p.month}`}
                            ref={isActive ? activeRef : null}
                            onClick={() => handlePeriodClick(p.month, p.year)}
                            disabled={disableControls}
                            style={{
                                flexShrink: 0,
                                padding: '6px 12px',
                                borderRadius: '20px',
                                border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                background: isActive ? '#2563eb' : 'white',
                                color: isActive ? 'white' : '#475569',
                                fontSize: '11px',
                                fontWeight: isActive ? '700' : '500',
                                cursor: disableControls ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                scrollSnapAlign: 'center',
                                boxShadow: isActive ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : 'none',
                                opacity: disableControls ? 0.6 : 1
                            }}
                        >
                            {isToday && !isActive && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }}></span>}
                            <span>{MONTH_NAMES[p.month - 1]}</span>
                            <span style={{ opacity: 0.8, fontSize: '9px' }}>{p.year}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
