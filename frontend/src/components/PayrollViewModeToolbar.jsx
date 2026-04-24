import React from 'react';

const MODE_OPTIONS = [
    { id: 'simple', label: 'Fokus' },
    { id: 'detail', label: 'Semua' }
];

const VALUE_PRIORITY_OPTIONS = [
    { id: 'smart', label: 'Smart (Adj+Buffer prioritas)' },
    { id: 'db_ptrj_only', label: 'DB PTRJ Saja' },
    { id: 'manual_buffer_only', label: 'Adjustment + Buffer Saja' }
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
                <label className="payroll-view-toolbar__select-wrap">
                    <select
                        className="payroll-view-toolbar__select"
                        value={valuePriorityMode}
                        onChange={(event) => onValuePriorityModeChange(event.target.value)}
                    >
                        {VALUE_PRIORITY_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
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
