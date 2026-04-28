import React, { useEffect, useMemo, useState } from 'react';
import { fetchTaskCodeOptions } from '../services/manualAdjustmentService';

const CATEGORY_OPTIONS = [
    { value: 'PREMI', label: 'Premi', color: '#16a34a' },
    { value: 'POTONGAN_KOTOR', label: 'Koreksi / Potongan Kotor', color: '#ea580c' },
    { value: 'POTONGAN_BERSIH', label: 'Potongan Bersih', color: '#dc2626' }
];

const KOREKSI_DEFAULT_AD_CODE = 'DE0004';
const KOREKSI_PREFIX = 'KOREKSI';
const POTONGAN_PREFIX = 'POTONGAN';

function resolveAdCode(taskCodeOption) {
    return taskCodeOption?.ad_code || taskCodeOption?.base_task_code || taskCodeOption?.task_code || '';
}

function buildRemarks(taskCodeOption, adjustmentName, amount = 0) {
    if (!taskCodeOption) return '';
    const adCode = resolveAdCode(taskCodeOption);
    const taskDesc = taskCodeOption.task_desc || taskCodeOption.doc_desc || '';
    return `${adjustmentName} | ${adCode}${taskDesc ? ` - ${taskDesc}` : ''} | ${amount} | sync:MISS | match:MISMATCH`;
}

function removeLeadingPrefix(value, prefix) {
    return String(value || '').replace(new RegExp(`^${prefix}\\s*`, 'i'), '').trimStart();
}

function containsWord(value, word) {
    return new RegExp(`\\b${word}\\b`, 'i').test(String(value || ''));
}

function buildAdjustmentName(adjustmentType, docDesc) {
    const trimmed = docDesc.trim();
    if (adjustmentType === 'POTONGAN_KOTOR') {
        return `${KOREKSI_PREFIX} ${removeLeadingPrefix(trimmed, KOREKSI_PREFIX)}`.trim();
    }
    if (adjustmentType === 'POTONGAN_BERSIH') {
        return `${POTONGAN_PREFIX} ${removeLeadingPrefix(trimmed, POTONGAN_PREFIX)}`.trim();
    }
    return trimmed;
}

function validateAdjustmentName(adjustmentType, docDesc) {
    const trimmed = docDesc.trim();
    if (!trimmed) return 'Nama kolom wajib diisi.';
    if (adjustmentType === 'POTONGAN_KOTOR') {
        const suffix = removeLeadingPrefix(trimmed, KOREKSI_PREFIX);
        if (!suffix.trim()) return 'Lanjutkan nama kolom setelah kata KOREKSI.';
        if (containsWord(suffix, POTONGAN_PREFIX)) return 'Nama kolom Koreksi tidak boleh memakai kata POTONGAN.';
    }
    if (adjustmentType === 'POTONGAN_BERSIH') {
        const suffix = removeLeadingPrefix(trimmed, POTONGAN_PREFIX);
        if (!suffix.trim()) return 'Lanjutkan nama kolom setelah kata POTONGAN.';
    }
    return '';
}

export default function ManualAdjustmentColumnModal({
    isOpen,
    onClose,
    onSaved,
    token,
    division
}) {
    const [adjustmentType, setAdjustmentType] = useState('PREMI');
    const [docDesc, setDocDesc] = useState('');
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState([]);
    const [selectedTaskCode, setSelectedTaskCode] = useState(null);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const selectedCategory = useMemo(
        () => CATEGORY_OPTIONS.find((item) => item.value === adjustmentType) || CATEGORY_OPTIONS[0],
        [adjustmentType]
    );

    const koreksiDefaultOption = useMemo(
        () => options.find((option) => resolveAdCode(option) === KOREKSI_DEFAULT_AD_CODE && option.task_desc === '(DE) POTONGAN PREMI')
            || options.find((option) => resolveAdCode(option) === KOREKSI_DEFAULT_AD_CODE),
        [options]
    );

    const filteredOptions = useMemo(() => {
        if (adjustmentType === 'POTONGAN_BERSIH') {
            return options.filter((option) => String(option.task_desc || option.doc_desc || '').trim().startsWith('(DE)'));
        }
        return options;
    }, [adjustmentType, options]);

    const nameError = validateAdjustmentName(adjustmentType, docDesc);
    const resolvedAdjustmentName = buildAdjustmentName(adjustmentType, docDesc);

    useEffect(() => {
        if (!isOpen) return;
        setAdjustmentType('PREMI');
        setDocDesc('');
        setSearch('');
        setSelectedTaskCode(null);
        setOptions([]);
        setError('');
    }, [isOpen]);

    useEffect(() => {
        if (adjustmentType !== 'POTONGAN_KOTOR' || !koreksiDefaultOption) return;

        setSelectedTaskCode(koreksiDefaultOption);
    }, [adjustmentType, koreksiDefaultOption]);

    useEffect(() => {
        if (!isOpen || !token) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoadingOptions(true);
            setError('');
            try {
                const result = await fetchTaskCodeOptions(token, {
                    search: adjustmentType === 'POTONGAN_KOTOR' ? KOREKSI_DEFAULT_AD_CODE : search,
                    divisionCode: division,
                    limit: 50
                });
                if (!cancelled) setOptions(Array.isArray(result) ? result : result?.data || []);
            } catch (e) {
                if (!cancelled) {
                    setOptions([]);
                    setError(e?.response?.data?.error || e.message || 'Gagal memuat TaskCode');
                }
            } finally {
                if (!cancelled) setLoadingOptions(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isOpen, token, search, docDesc, division]);

    const canSave = Boolean(
        resolvedAdjustmentName
        && selectedTaskCode
        && !nameError
        && !saving
    );

    const handleOptionSelect = (option) => {
        setSelectedTaskCode(option);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (nameError) {
            setError(nameError);
            return;
        }
        if (!canSave) return;

        setSaving(true);
        setError('');
        try {
            onSaved?.({
                adjustment_type: adjustmentType,
                adjustment_name: resolvedAdjustmentName,
                ad_code: resolveAdCode(selectedTaskCode),
                task_code: selectedTaskCode.task_code,
                base_task_code: selectedTaskCode.base_task_code || resolveAdCode(selectedTaskCode),
                task_desc: selectedTaskCode.task_desc,
                loc_code: selectedTaskCode.loc_code,
                remarks: buildRemarks(selectedTaskCode, resolvedAdjustmentName, 0)
            });
            onClose?.();
        } catch (e) {
            setError(e.message || 'Gagal menambahkan kolom manual adjustment');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000,
                padding: 20
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: 'min(720px, 96vw)',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    borderRadius: 16,
                    background: '#ffffff',
                    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
                    border: '1px solid #e2e8f0'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Tambah Kolom Manual Adjustment</h2>
                            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
                                Isi DocDesc sebagai nama kolom, lalu pilih ADCode dari daftar AL/DE yang tersedia.
                            </p>
                        </div>
                        <button type="button" onClick={onClose} style={{ border: 0, background: '#f1f5f9', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                            Tutup
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 22, overflowY: 'auto', maxHeight: 'calc(90vh - 86px)' }}>
                    <div style={{ display: 'grid', gap: 14 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>DocDesc / Nama Kolom</label>
                            {(adjustmentType === 'POTONGAN_KOTOR' || adjustmentType === 'POTONGAN_BERSIH') ? (
                                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                                    <span style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRight: 0, borderRadius: '9px 0 0 9px', background: '#f8fafc', color: '#0f172a', fontWeight: 800 }}>
                                        {adjustmentType === 'POTONGAN_KOTOR' ? KOREKSI_PREFIX : POTONGAN_PREFIX}
                                    </span>
                                    <input
                                        value={removeLeadingPrefix(docDesc, adjustmentType === 'POTONGAN_KOTOR' ? KOREKSI_PREFIX : POTONGAN_PREFIX)}
                                        onChange={(e) => {
                                            const prefix = adjustmentType === 'POTONGAN_KOTOR' ? KOREKSI_PREFIX : POTONGAN_PREFIX;
                                            setDocDesc(`${prefix} ${e.target.value}`.trimEnd());
                                            if (adjustmentType === 'POTONGAN_BERSIH') {
                                                setSearch(e.target.value);
                                                setSelectedTaskCode(null);
                                            }
                                        }}
                                        placeholder={adjustmentType === 'POTONGAN_KOTOR' ? 'contoh: DENDA PANEN' : 'contoh: SPSI'}
                                        style={{ flex: 1, padding: 10, borderRadius: '0 9px 9px 0', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                            ) : (
                                <input
                                    value={docDesc}
                                    onChange={(e) => {
                                        setDocDesc(e.target.value);
                                        setSearch(e.target.value);
                                        setSelectedTaskCode(null);
                                    }}
                                    placeholder="Ketik nama premi, contoh: PRUNING"
                                    style={{ width: '100%', padding: 10, borderRadius: 9, border: '1px solid #cbd5e1' }}
                                />
                            )}
                            {nameError && (
                                <div style={{ marginTop: 6, color: '#b45309', fontSize: 12, fontWeight: 700 }}>
                                    {nameError}
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Kategori Rule</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {CATEGORY_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setAdjustmentType(option.value);
                                            setSelectedTaskCode(null);
                                            if (option.value === 'POTONGAN_KOTOR') {
                                                setDocDesc((current) => buildAdjustmentName('POTONGAN_KOTOR', current || KOREKSI_PREFIX));
                                                setSearch(KOREKSI_DEFAULT_AD_CODE);
                                            } else if (option.value === 'POTONGAN_BERSIH') {
                                                setDocDesc((current) => buildAdjustmentName('POTONGAN_BERSIH', current || POTONGAN_PREFIX));
                                                setSearch('DE');
                                            } else {
                                                const cleanedName = removeLeadingPrefix(removeLeadingPrefix(docDesc, KOREKSI_PREFIX), POTONGAN_PREFIX);
                                                setDocDesc(cleanedName);
                                                setSearch(cleanedName);
                                            }
                                        }}
                                        style={{
                                            border: adjustmentType === option.value ? `2px solid ${option.color}` : '1px solid #cbd5e1',
                                            background: adjustmentType === option.value ? `${option.color}12` : '#ffffff',
                                            color: '#0f172a',
                                            borderRadius: 999,
                                            padding: '8px 12px',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                                ADCode Wajib ({division || 'ALL'})
                            </label>
                            <input
                                value={search}
                                onChange={(e) => {
                                    if (adjustmentType === 'POTONGAN_KOTOR') return;
                                    setSearch(e.target.value);
                                }}
                                readOnly={adjustmentType === 'POTONGAN_KOTOR'}
                                placeholder={adjustmentType === 'POTONGAN_KOTOR' ? 'Otomatis DE0004 - (DE) POTONGAN PREMI' : adjustmentType === 'POTONGAN_BERSIH' ? 'Cari ADCode potongan bersih, hanya (DE)...' : 'Cari ADCode, TaskCode, atau TaskDesc AL/DE...'}
                                style={{ width: '100%', padding: 10, borderRadius: 9, border: '1px solid #cbd5e1', marginBottom: 8 }}
                            />
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                                <div style={{ padding: '8px 12px', background: '#f8fafc', color: '#64748b', fontSize: 12 }}>
                                    {loadingOptions ? 'Memuat preset...' : `${filteredOptions.length} preset ditemukan`}
                                </div>
                                {filteredOptions.map((option) => {
                                    const active = selectedTaskCode?.task_code === option.task_code;
                                    return (
                                        <button
                                            key={`${option.doc_desc || ''}-${option.loc_code}-${option.task_code}-${option.task_desc}`}
                                            type="button"
                                            onClick={() => handleOptionSelect(option)}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 12px',
                                                border: 0,
                                                borderTop: '1px solid #f1f5f9',
                                                background: active ? '#eff6ff' : '#ffffff',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                                <strong style={{ color: '#0f172a' }}>{option.doc_desc || option.task_desc || '-'}</strong>
                                                <span style={{ color: '#64748b', fontSize: 12 }}>{option.loc_code || '-'}</span>
                                            </div>
                                            <div style={{ color: '#475569', fontSize: 12, marginTop: 3 }}>
                                                ADCode: <strong>{resolveAdCode(option)}</strong>{option.task_code && option.task_code !== resolveAdCode(option) ? ` (TaskCode ${option.task_code})` : ''}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{option.task_desc || '-'}</div>
                                        </button>
                                    );
                                })}
                                {!loadingOptions && filteredOptions.length === 0 && (
                                    <div style={{ padding: 18, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                        Tidak ada preset untuk filter ini.
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedTaskCode && (
                            <div style={{ padding: 12, borderRadius: 12, background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#14532d' }}>
                                <strong>Dipilih:</strong> {selectedTaskCode.doc_desc || docDesc} · ADCode {resolveAdCode(selectedTaskCode)} · {selectedTaskCode.task_desc || '-'} · {selectedCategory.label}
                            </div>
                        )}

                        {error && (
                            <div style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 13, border: '1px solid #fecaca' }}>
                                {error}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                        <button type="button" onClick={onClose} disabled={saving} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #cbd5e1', background: '#ffffff', cursor: saving ? 'not-allowed' : 'pointer' }}>
                            Batal
                        </button>
                        <button type="submit" disabled={!canSave} style={{ padding: '10px 16px', borderRadius: 9, border: 0, background: canSave ? selectedCategory.color : '#94a3b8', color: 'white', fontWeight: 800, cursor: canSave ? 'pointer' : 'not-allowed' }}>
                            {saving ? 'Menyimpan...' : 'Simpan Kolom'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
