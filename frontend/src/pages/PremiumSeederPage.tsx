import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReport } from '../context/ReportContext';
import { buildBackendUrl } from '../utils/apiBase';

const STEPS = ['setup', 'preview', 'importing', 'result'];

const ACTION_LABELS = {
    READY_INSERT: 'Siap Import',
    WOULD_UPDATE: 'Akan Update',
    DUPLICATE_SAME: 'Duplikat (Sama)',
    DUPLICATE_DIFFERENT: 'Duplikat (Berbeda)',
    SKIP_INVALID_EMPCODE: 'EmpCode Invalid',
    SKIP_INVALID_EMPCODE_NOT_FOUND: 'Karyawan Tidak Ditemukan',
    SKIP_INVALID_PREMIUM_TYPE: 'Tipe Premi Invalid',
    SKIP_ZERO_AMOUNT: 'Jumlah Nol',
};

const ACTION_COLORS = {
    READY_INSERT: '#16a34a',
    WOULD_UPDATE: '#2563eb',
    DUPLICATE_SAME: '#6b7280',
    DUPLICATE_DIFFERENT: '#d97706',
    SKIP_INVALID_EMPCODE: '#dc2626',
    SKIP_INVALID_EMPCODE_NOT_FOUND: '#dc2626',
    SKIP_INVALID_PREMIUM_TYPE: '#dc2626',
    SKIP_ZERO_AMOUNT: '#9ca3af',
};

export default function PremiumSeederPage() {
    const { token } = useAuth();
    const { month, year, division } = useReport();

    const [step, setStep] = useState('setup');
    const [premiumTypes, setPremiumTypes] = useState<any[]>([]);
    const [selectedType, setSelectedType] = useState('');
    const [selMonth, setSelMonth] = useState(month);
    const [selYear, setSelYear] = useState(year);
    const [selDivision, setSelDivision] = useState(division || '');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dryRunResult, setDryRunResult] = useState<any>(null);
    const [importResult, setImportResult] = useState<any>(null);
    const [progress, setProgress] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch premium definitions
    useEffect(() => {
        if (!token) return;
        fetch(buildBackendUrl('/payroll/premium-definitions'), {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                if (data.definitions) {
                    setPremiumTypes(data.definitions.filter((d: any) => d.input_type === 'blok' && d.adjustment_type === 'PREMI'));
                }
            })
            .catch(() => {});
    }, [token]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;
        if (f && !f.name.endsWith('.xlsx')) {
            setError('File harus berformat .xlsx');
            return;
        }
        if (f && f.size > 10 * 1024 * 1024) {
            setError('Ukuran file maksimal 10MB');
            return;
        }
        setFile(f);
        setError('');
    };

    const downloadTemplate = async () => {
        try {
            setLoading(true);
            const params = selectedType ? `?premium_type=${encodeURIComponent(selectedType)}` : '';
            const resp = await fetch(buildBackendUrl(`/payroll/premium-seeder/template${params}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!resp.ok) throw new Error('Gagal mengunduh template');
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `template_premi_${selectedType || 'semua'}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const runDryRun = async () => {
        if (!file || !token) {
            setError('Pilih file Excel terlebih dahulu');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('period_month', String(selMonth));
            formData.append('period_year', String(selYear));
            formData.append('division_code', selDivision || 'ALL');
            if (selectedType) formData.append('premium_type', selectedType);

            const resp = await fetch(buildBackendUrl('/payroll/premium-seeder/dry-run'), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const result = await resp.json();
            if (!result.success && result.errors?.length > 0) {
                setError(result.errors.join('\n'));
            } else {
                setDryRunResult(result);
                setStep('preview');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const runImport = async () => {
        if (!file || !token) return;
        setStep('importing');
        setLoading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('period_month', String(selMonth));
            formData.append('period_year', String(selYear));
            formData.append('division_code', selDivision || 'ALL');
            if (selectedType) formData.append('premium_type', selectedType);

            const resp = await fetch(buildBackendUrl('/payroll/premium-seeder/import'), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const result = await resp.json();
            setImportResult(result);
            setStep('result');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Poll progress during import
    useEffect(() => {
        if (step !== 'importing') return;
        const interval = setInterval(async () => {
            try {
                const resp = await fetch(buildBackendUrl('/payroll/premium-seeder/progress'), {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (resp.ok) {
                    const p = await resp.json();
                    setProgress(p);
                }
            } catch {}
        }, 2000);
        return () => clearInterval(interval);
    }, [step, token]);

    const reset = () => {
        setStep('setup');
        setFile(null);
        setDryRunResult(null);
        setImportResult(null);
        setProgress(null);
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const months = ['Januari','Februari','Maret','April','Mei','Juni',
        'Juli','Agustus','September','Oktober','November','Desember'];

    return (
        <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', color: '#1e3a5f' }}>Seeder Premi (Excel)</h2>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                Import data premi dari file Excel ke database. Didukung: Premi Blok (Pruning, Raking, Kinerja, Insentif Panen, TBS, Jaga, Bantu Brondol).
            </p>

            {/* Error banner */}
            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b91c1c', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                    {error}
                </div>
            )}

            {/* STEP: Setup */}
            {step === 'setup' && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Tipe Premi</label>
                            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
                                <option value="">-- Semua Premi Blok --</option>
                                {premiumTypes.map((d: any) => (
                                    <option key={d.adjustment_name} value={d.adjustment_name}>{d.adjustment_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Divisi</label>
                            <input type="text" value={selDivision} onChange={e => setSelDivision(e.target.value)}
                                placeholder="Contoh: REB" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Bulan</label>
                            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
                                {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>Tahun</label>
                            <input type="number" value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>File Excel</label>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange}
                                style={{ flex: 1, padding: '0.4rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                            <button onClick={downloadTemplate} disabled={loading}
                                style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Download Template
                            </button>
                        </div>
                        {file && <p style={{ marginTop: 4, fontSize: '0.75rem', color: '#6b7280' }}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
                    </div>

                    <button onClick={runDryRun} disabled={!file || loading}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none', background: !file ? '#e5e7eb' : '#2563eb', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: !file ? 'not-allowed' : 'pointer' }}>
                        {loading ? 'Memproses...' : 'Preview (Dry-Run)'}
                    </button>
                </div>
            )}

            {/* STEP: Preview */}
            {step === 'preview' && dryRunResult && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem', color: '#1e3a5f' }}>Hasil Dry-Run Preview</h3>

                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Total Baris', value: dryRunResult.total_rows, color: '#1e3a5f' },
                            { label: 'Total Amount', value: `Rp ${(dryRunResult.total_amount || 0).toLocaleString('id-ID')}`, color: '#16a34a' },
                            ...Object.entries(dryRunResult.action_breakdown || {}).map(([k, v]: any) => ({
                                label: ACTION_LABELS[k] || k, value: v, color: ACTION_COLORS[k] || '#6b7280',
                            })),
                        ].map((card, i) => (
                            <div key={i} style={{ background: '#f8fafc', borderRadius: 8, border: `1px solid ${card.color}20`, padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color }}>{card.value}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{card.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Rows Table */}
                    {dryRunResult.rows?.length > 0 && (
                        <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: '1rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>EmpCode</th>
                                        <th style={thStyle}>Nama</th>
                                        <th style={thStyle}>Premi</th>
                                        <th style={thStyle}>Gang</th>
                                        <th style={thStyle}>Jumlah</th>
                                        <th style={thStyle}>Aksi</th>
                                        <th style={thStyle}>Alasan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dryRunResult.rows.map((row: any, i: number) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={tdStyle}>{row.row}</td>
                                            <td style={tdStyle}>{row.empcode}</td>
                                            <td style={tdStyle}>{row.emp_name}</td>
                                            <td style={tdStyle}>{row.premium_type}</td>
                                            <td style={tdStyle}>{row.gang_code}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>{row.amount.toLocaleString('id-ID')}</td>
                                            <td style={tdStyle}>
                                                <span style={{ background: ACTION_COLORS[row.action] || '#6b7280', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>
                                                    {ACTION_LABELS[row.action] || row.action}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, color: '#6b7280', maxWidth: 200 }}>{row.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Errors */}
                    {dryRunResult.errors?.length > 0 && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
                            <strong>Peringatan:</strong>
                            {dryRunResult.errors.map((e: string, i: number) => (
                                <div key={i}>- {e}</div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={reset} style={btnSecondaryStyle}>Batal</button>
                        <button onClick={runImport} disabled={loading}
                            style={{ ...btnPrimaryStyle, flex: 1, background: loading ? '#e5e7eb' : '#16a34a', color: 'white', cursor: loading ? 'not-allowed' : 'pointer' }}>
                            {loading ? 'Mengimport...' : 'Konfirmasi Import'}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP: Importing */}
            {step === 'importing' && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                    <h3 style={{ color: '#1e3a5f', margin: '0 0 0.5rem' }}>Mengimport Data...</h3>
                    {progress && (
                        <div>
                            <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                                <div style={{
                                    height: '100%', background: '#2563eb', borderRadius: 4,
                                    width: `${progress.total_rows > 0 ? (progress.processed_rows / progress.total_rows) * 100 : 0}%`,
                                    transition: 'width 0.3s',
                                }} />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {progress.current_step || 'Memproses...'} ({progress.processed_rows}/{progress.total_rows})
                            </p>
                        </div>
                    )}
                    {!progress && <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Mohon tunggu sebentar...</p>}
                </div>
            )}

            {/* STEP: Result */}
            {step === 'result' && importResult && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: importResult.success ? '#d1fae5' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                            {importResult.success ? '✓' : '✗'}
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: importResult.success ? '#065f46' : '#991b1b' }}>
                                {importResult.success ? 'Import Berhasil!' : 'Import Gagal'}
                            </h3>
                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                {importResult.imported} berhasil, {importResult.skipped} dilewati
                                {importResult.processed_rows && ` dari ${importResult.total_rows} grup`}
                            </p>
                        </div>
                    </div>

                    {importResult.errors?.length > 0 && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#b91c1c', maxHeight: 200, overflow: 'auto' }}>
                            <strong>Error ({importResult.errors.length}):</strong>
                            {importResult.errors.map((e: string, i: number) => (
                                <div key={i} style={{ marginTop: 2 }}>- {e}</div>
                            ))}
                        </div>
                    )}

                    <button onClick={reset} style={btnPrimaryStyle}>Import Lagi</button>
                </div>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#475569',
    borderBottom: '2px solid #e2e8f0',
};

const tdStyle: React.CSSProperties = {
    padding: '0.4rem 0.75rem',
    fontSize: '0.8rem',
    color: '#1e293b',
};

const btnPrimaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: 'white',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
};

const btnSecondaryStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#f8fafc',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
};
