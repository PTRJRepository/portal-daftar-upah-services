import React, { useState, useRef, useEffect, useCallback } from 'react'
import './PeriodSlider.css'

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

export default function PeriodSlider({
    currentMonth,
    currentYear,
    onPeriodChange,
    disableControls = false,
    minYear = 2024,
    maxYear = null // null means current year + 1
}) {
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [scrollLeft, setScrollLeft] = useState(0)
    const sliderRef = useRef(null)
    const trackRef = useRef(null)

    // Calculate max year (current year + 1 if not specified)
    const getMaxYear = () => maxYear || new Date().getFullYear() + 1

    // Generate all periods from minYear to maxYear
    const generatePeriods = () => {
        const periods = []
        const max = getMaxYear()

        for (let year = minYear; year <= max; year++) {
            for (let month = 1; month <= 12; month++) {
                // Only include future months for current/max year
                if (year === max) {
                    const currentMaxMonth = new Date().getMonth() + 2 // +2 to include next month
                    if (month > currentMaxMonth) continue
                }
                periods.push({ month, year })
            }
        }
        return periods
    }

    const periods = generatePeriods()

    // Calculate total width needed
    const getTotalWidth = () => periods.length * 80 // 80px per period

    // Calculate current period index
    const getCurrentIndex = () => {
        return periods.findIndex(p => p.month === currentMonth && p.year === currentYear)
    }

    // Scroll to current period
    const scrollToCurrent = useCallback(() => {
        if (!trackRef.current) return

        const index = getCurrentIndex()
        if (index === -1) return

        const itemWidth = 80
        const containerWidth = sliderRef.current?.clientWidth || 0
        const scrollPos = (index * itemWidth) - (containerWidth / 2) + (itemWidth / 2)

        trackRef.current.scrollTo({
            left: Math.max(0, scrollPos),
            behavior: 'smooth'
        })
    }, [currentMonth, currentYear, periods])

    // Auto-scroll to current period on mount and period change
    useEffect(() => {
        scrollToCurrent()
    }, [scrollToCurrent])

    // Handle drag start
    const handleDragStart = (e) => {
        if (disableControls) return
        setIsDragging(true)
        setStartX(e.pageX - (trackRef.current?.offsetLeft || 0))
        setScrollLeft(trackRef.current?.scrollLeft || 0)
    }

    // Handle drag move
    const handleDragMove = (e) => {
        if (!isDragging || disableControls) return
        e.preventDefault()
        const x = e.pageX - (trackRef.current?.offsetLeft || 0)
        const walk = (x - startX) * 2 // Scroll speed multiplier
        if (trackRef.current) {
            trackRef.current.scrollLeft = scrollLeft - walk
        }
    }

    // Handle drag end
    const handleDragEnd = () => {
        setIsDragging(false)
    }

    // Handle period click
    const handlePeriodClick = (month, year) => {
        if (disableControls) return
        if (onPeriodChange) {
            onPeriodChange(month, year)
        }
    }

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (disableControls) return

        const currentIndex = getCurrentIndex()
        if (currentIndex === -1) return

        let newIndex = currentIndex

        switch (e.key) {
            case 'ArrowLeft':
                newIndex = Math.max(0, currentIndex - 1)
                break
            case 'ArrowRight':
                newIndex = Math.min(periods.length - 1, currentIndex + 1)
                break
            case 'Home':
                newIndex = 0
                break
            case 'End':
                newIndex = periods.length - 1
                break
            default:
                return
        }

        e.preventDefault()
        const newPeriod = periods[newIndex]
        if (newPeriod && onPeriodChange) {
            onPeriodChange(newPeriod.month, newPeriod.year)
        }
    }

    // Quick navigation functions
    const goToToday = () => {
        const now = new Date()
        if (onPeriodChange) {
            onPeriodChange(now.getMonth() + 1, now.getFullYear())
        }
    }

    const goBack = () => {
        const currentIndex = getCurrentIndex()
        if (currentIndex > 0) {
            const prevPeriod = periods[currentIndex - 1]
            if (prevPeriod && onPeriodChange) {
                onPeriodChange(prevPeriod.month, prevPeriod.year)
            }
        }
    }

    const goForward = () => {
        const currentIndex = getCurrentIndex()
        if (currentIndex < periods.length - 1) {
            const nextPeriod = periods[currentIndex + 1]
            if (nextPeriod && onPeriodChange) {
                onPeriodChange(nextPeriod.month, nextPeriod.year)
            }
        }
    }

    // Check if period is current
    const isCurrentPeriod = (month, year) => {
        const now = new Date()
        return month === now.getMonth() + 1 && year === now.getFullYear()
    }

    // Check if period is selected
    const isSelectedPeriod = (month, year) => {
        return month === currentMonth && year === currentYear
    }

    return (
        <div className="period-slider-container">
            <div className="period-slider-header">
                <span className="period-slider-label">
                    {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </span>
                <div className="period-slider-quick-nav">
                    <button
                        className="period-slider-btn period-slider-btn-small"
                        onClick={goBack}
                        disabled={disableControls || getCurrentIndex() === 0}
                        title="Bulan Sebelumnya"
                    >
                        ◀
                    </button>
                    <button
                        className="period-slider-btn period-slider-btn-small"
                        onClick={goToToday}
                        disabled={disableControls}
                        title="Bulan Ini"
                    >
                        ●
                    </button>
                    <button
                        className="period-slider-btn period-slider-btn-small"
                        onClick={goForward}
                        disabled={disableControls || getCurrentIndex() === periods.length - 1}
                        title="Bulan Selanjutnya"
                    >
                        ▶
                    </button>
                </div>
            </div>

            <div
                ref={sliderRef}
                className={`period-slider-track-wrapper ${isDragging ? 'dragging' : ''}`}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                role="slider"
                aria-label="Pilih Periode"
                aria-valuemin={0}
                aria-valuemax={periods.length - 1}
                aria-valuenow={getCurrentIndex()}
            >
                <div
                    ref={trackRef}
                    className="period-slider-track"
                    style={{ width: `${getTotalWidth()}px` }}
                >
                    {periods.map((period, index) => (
                        <button
                            key={`${period.year}-${period.month}`}
                            className={`period-slider-item ${isSelectedPeriod(period.month, period.year) ? 'selected' : ''} ${isCurrentPeriod(period.month, period.year) ? 'current' : ''}`}
                            onClick={() => handlePeriodClick(period.month, period.year)}
                            disabled={disableControls}
                            title={`${MONTH_NAMES[period.month - 1]} ${period.year}${isCurrentPeriod(period.month, period.year) ? ' (Bulan Ini)' : ''}`}
                        >
                            <span className="period-slider-month">{MONTH_NAMES[period.month - 1]}</span>
                            <span className="period-slider-year">{period.year}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="period-slider-footer">
                <span className="period-slider-hint">
                    {isDragging ? '🖱️ Tahan & geser...' : '🖱️ Klik atau geser untuk navigasi'}
                </span>
                <span className="period-slider-position">
                    {getCurrentIndex() + 1} / {periods.length}
                </span>
            </div>
        </div>
    )
}
