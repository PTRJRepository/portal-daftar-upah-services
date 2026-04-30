import React from 'react';

const MODE_OPTIONS = [
    { id: 'simple', label: 'Fokus' },
    { id: 'detail', label: 'Semua' }
];

export default function PayrollViewModeToolbar({
    mode = 'simple',
    focusLens = false,
    taxExpanded = false,
    valuePriorityMode = 'smart',
    isSeedingAutoBuffer = false,
    onModeChange = () => {},
    onFocusLensChange = () => {},
    onToggleTax = () => {},
    onValuePriorityModeChange = () => {},
    onSeedAutoBuffer = () => {}
}) {
    return (
        <div className="payroll-view-toolbar" role="toolbar" aria-label="Pengaturan tampilan tabel payroll">
            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Tampilan</span>
                <div className="payroll-view-toolbar__group" role="group" aria-label="Mode tabel">
                    {MODE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={`payroll-view-toolbar__button payroll-view-toolbar__button--${option.id} ${mode === option.id ? 'is-active' : ''}`}
                            aria-pressed={mode === option.id}
                            onClick={() => onModeChange(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="payroll-view-toolbar__section">
                <label className={`payroll-view-toolbar__toggle ${focusLens ? 'is-active' : ''}`}>
                    <input
                        type="checkbox"
                        className="payroll-view-toolbar__toggle-input"
                        checked={focusLens}
                        onChange={(event) => onFocusLensChange(event.target.checked)}
                    />
                    <span className="payroll-view-toolbar__toggle-indicator" aria-hidden="true" />
                    <span className="payroll-view-toolbar__toggle-copy">
                        <span className="payroll-view-toolbar__toggle-title">Fokus Grup</span>
                        <span className="payroll-view-toolbar__toggle-subtitle">Opsional, sorot grup aktif</span>
                    </span>
                </label>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Sumber Nilai</span>
                <button
                    type="button"
                    className={`payroll-view-toolbar__button payroll-view-toolbar__button--dbptrj ${valuePriorityMode === 'db_ptrj_only' ? 'is-active' : ''}`}
                    aria-pressed={valuePriorityMode === 'db_ptrj_only'}
                    title={valuePriorityMode === 'db_ptrj_only' ? 'Kembali ke Auto Buffer: manual adjustment/auto buffer diprioritaskan' : 'Tampilkan nilai asli dari db_ptrj pada kolom yang sama'}
                    onClick={() => onValuePriorityModeChange(valuePriorityMode === 'db_ptrj_only' ? 'smart' : 'db_ptrj_only')}
                >
                    <span className="payroll-view-toolbar__button-copy">
                        {valuePriorityMode === 'db_ptrj_only' ? 'DB_PTRJ Aktif' : 'Auto Buffer Aktif'}
                    </span>
                    <span className="payroll-view-toolbar__button-state">
                        {valuePriorityMode === 'db_ptrj_only' ? 'Klik: Auto Buffer' : 'Klik: DB_PTRJ'}
                    </span>
                </button>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Detail Pajak</span>
                <button
                    type="button"
                    className={`payroll-view-toolbar__button payroll-view-toolbar__button--tax ${taxExpanded ? 'is-active' : ''}`}
                    aria-pressed={taxExpanded}
                    onClick={onToggleTax}
                >
                    <span className="payroll-view-toolbar__button-copy">Pajak</span>
                    <span className="payroll-view-toolbar__button-state">{taxExpanded ? 'Terbuka' : 'Ringkas'}</span>
                </button>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Seeder</span>
                <button
                    type="button"
                    className={`payroll-view-toolbar__button payroll-view-toolbar__button--seed ${isSeedingAutoBuffer ? 'is-active' : ''}`}
                    onClick={onSeedAutoBuffer}
                    disabled={isSeedingAutoBuffer}
                >
                    {isSeedingAutoBuffer ? 'Menyimpan Buffer...' : 'Seed Buffer -> Manual'}
                </button>
            </div>
        </div>
    );
}
