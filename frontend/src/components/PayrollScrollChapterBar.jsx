import React from 'react';

function toGroupSlug(group) {
    return String(group || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const GROUP_ACCENT_MAP = {
    identitas: '#94a3b8',
    pajak: '#a8a29e',
    absensi: '#22c55e',
    panen: '#64748b',
    penggajian: '#3b82f6',
    tunjangan: '#f97316',
    premi: '#d97706',
    'potongan-upah-kotor': '#ef4444',
    'upah-kotor': '#16a34a',
    'pendapatan-lainnya': '#10b981',
    'potongan-upah-bersih': '#ec4899',
    'upah-bersih': '#14b8a6'
};

export default function PayrollScrollChapterBar({
    activeGroup = null,
    allGroups = [],
    isVisible = false,
    onSelectGroup = () => {},
    horizontalScrollRatio = 0,
    horizontalViewportRatio = 1,
    horizontalCanScroll = false,
    onHorizontalScrollChange = () => {},
    // Gang chips props for streaming mode
    recentGangs = [],
    streamingStage = null,
    totalGangs = 0,
    processedGangs = 0,
    displayMode = 'simple',
    onToggleDisplayMode = () => {}
}) {
    const isStreaming = streamingStage === 'streaming' || streamingStage === 'querying' || streamingStage === 'connecting';
    const showGangChips = isStreaming;
    const activeSlug = toGroupSlug(activeGroup);
    const accentColor = GROUP_ACCENT_MAP[activeSlug] || '#3b82f6';
    const clampedScrollRatio = Math.max(0, Math.min(1, Number(horizontalScrollRatio) || 0));
    const clampedViewportRatio = Math.max(0.04, Math.min(1, Number(horizontalViewportRatio) || 1));
    const scrollPercent = Math.round(clampedScrollRatio * 100);
    const viewportPercent = Math.round(clampedViewportRatio * 100);
    const sliderValue = Math.round(clampedScrollRatio * 1000);

    const shiftSlider = (delta) => {
        if (!horizontalCanScroll) return;
        onHorizontalScrollChange(Math.max(0, Math.min(1, clampedScrollRatio + delta)));
    };

    return (
        <div 
            className={`payroll-footer-dock ${isVisible ? 'is-visible' : 'is-hidden'}`}
            aria-hidden={isVisible ? 'false' : 'true'}
        >
            {/* 1. PROGRESS BAR / STREAMING INDICATOR */}
            {showGangChips && (
                <div className="payroll-footer-stream-bar">
                    <div className="stream-progress-track">
                        <div 
                            className="stream-progress-fill" 
                            style={{ 
                                width: totalGangs > 0 ? `${(processedGangs / totalGangs) * 100}%` : (streamingStage === 'querying' ? '50%' : '10%'),
                                backgroundColor: streamingStage === 'querying' ? '#f59e0b' : '#10b981'
                            }} 
                        />
                    </div>
                    {recentGangs.length > 0 && (
                        <div className="stream-chips">
                            <span className="stream-status-text">Menerima Data:</span>
                            {recentGangs.map((g) => (
                                <span key={g.gang_code} className="stream-chip">
                                    {g.gang_code}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div
                className={`payroll-footer-scrollbar ${horizontalCanScroll ? 'is-enabled' : 'is-disabled'}`}
                style={{
                    '--payroll-slider-accent': accentColor,
                    '--payroll-slider-progress': `${scrollPercent}%`
                }}
            >
                <button
                    type="button"
                    className="payroll-footer-scrollbar__nudge"
                    onClick={() => shiftSlider(-0.08)}
                    disabled={!horizontalCanScroll}
                    aria-label="Geser tabel ke kiri"
                >
                    {'<'}
                </button>
                <div className="payroll-footer-scrollbar__center">
                    <div className="payroll-footer-scrollbar__meta">
                        <span>Geser Horizontal</span>
                        <span>{scrollPercent}% | Tampilan {viewportPercent}%</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        step={1}
                        value={sliderValue}
                        disabled={!horizontalCanScroll}
                        className="payroll-footer-scrollbar__range"
                        aria-label="Slider horizontal tabel daftar upah"
                        onChange={(event) => onHorizontalScrollChange(Number(event.target.value) / 1000)}
                    />
                </div>
                <button
                    type="button"
                    className="payroll-footer-scrollbar__nudge"
                    onClick={() => shiftSlider(0.08)}
                    disabled={!horizontalCanScroll}
                    aria-label="Geser tabel ke kanan"
                >
                    {'>'}
                </button>
            </div>

            {/* 2. TAB NAVIGATION (THE SLIDER) */}
            <div className="payroll-footer-tabs">
                <button
                    className={`footer-mode-toggle ${displayMode === 'simple' ? 'is-focus' : 'is-all'}`}
                    onClick={onToggleDisplayMode}
                    title={displayMode === 'simple' ? 'Tampilkan Semua Kolom' : 'Gunakan Mode Fokus'}
                >
                    {displayMode === 'simple' ? '🔍 FOKUS' : '👁️ SEMUA'}
                </button>
                <div className="tabs-scroll-container">
                    {allGroups.map((group) => (
                        <button
                            key={group}
                            className={`footer-tab-btn ${activeGroup === group ? 'is-active' : ''}`}
                            onClick={() => onSelectGroup(group)}
                        >
                            {group}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
