import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/wages-summary-professional.css'; // Reuse existing styles
import { generatePDF } from '../utils/pdfGenerator';

const HighEarnerReportPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();

    // State
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [limit, setLimit] = useState(6000000);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [meta, setMeta] = useState(null);

    // Options
    const monthOptions = [
        { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
        { value: 3, label: 'Maret' }, { value: 4, label: 'April' },
        { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
        { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' },
        { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
        { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
    ];

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/payroll/report/high-earners?month=${month}&year=${year}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch data');
            }

            const result = await response.json();
            setData(result.data || []);
            setMeta(result.meta);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        fetchData();
    }, []);

    // Helper: Format Number
    const formatNumber = (num) => {
        if (!num) return '-';
        return new Intl.NumberFormat('id-ID').format(num);
    };

    return (
        <div className="wsp-container high-earner-container">
            {/* Action Bar */}
            <div className="wsp-action-bar no-print">
                <div className="left-section">
                    <button onClick={() => navigate(-1)} className="wsp-btn">
                        &larr; Kembali
                    </button>

                    <div className="wsp-filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="wsp-select"
                        >
                            {monthOptions.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="wsp-select"
                        >
                            {[...Array(5)].map((_, i) => {
                                const y = new Date().getFullYear() - i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>Limit &gt;</span>
                            <input
                                type="number"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="wsp-select"
                                style={{ width: '120px' }}
                            />
                        </div>

                        <button onClick={fetchData} className="wsp-btn wsp-btn-primary" disabled={loading}>
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                <div className="right-section">
                    <button onClick={() => window.print()} className="wsp-btn">
                        Print / PDF
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{ padding: '1rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {/* Report Content */}
            <div id="high-earner-report" className="wsp-paper a4-landscape">
                <div className="wsp-header">
                    <div className="wsp-title">LAPORAN GAJI TERTINGGI (High Earners)</div>
                    <div className="wsp-subtitle">
                        Periode: {monthOptions[month - 1]?.label} {year} | Limit: Rp {formatNumber(limit)}
                    </div>
                    {meta && (
                        <div className="wsp-meta" style={{ fontSize: '0.8rem', color: '#666' }}>
                            Total Karyawan: {meta.count}
                        </div>
                    )}
                </div>

                <div className="wsp-table-wrapper">
                    <table className="wsp-table">
                        <thead>
                            <tr className="wsp-header-master">
                                <th style={{ width: '30px' }}>#</th>
                                <th>Karyawan</th>
                                <th>Divisi</th>
                                <th className="text-right">Gaji Pokok</th>
                                <th className="text-right">Tunjangan</th>
                                <th className="text-right">Lembur</th>
                                <th className="text-right">Premi</th>
                                <th className="text-right">Potongan</th>
                                <th className="text-right">Total Potongan</th>
                                <th className="text-right">Upah Bersih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, idx) => {
                                const isOvertime = row.lembur_jumlah > 0;
                                return (
                                    <tr key={idx}>
                                        <td>{row.rank}</td>
                                        <td>
                                            <div style={{ fontWeight: 'bold' }}>{row.nama}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#555' }}>
                                                {row.nik} | {row.jabatan_estate || '-'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="div-code">{row.gang_code}</div>
                                            <div style={{ fontSize: '0.7rem' }}>{row.loc_code}</div>
                                        </td>
                                        <td className="text-right">{formatNumber(row.gaji_pokok)}</td>
                                        <td className="text-right">
                                            {formatNumber(row.total_tunjangan)}
                                            {/* Details on hover/small */}
                                            <div style={{ fontSize: '0.7rem', color: '#666' }}>
                                                {row.jabatan_jumlah > 0 && `Jab: ${formatNumber(row.jabatan_jumlah)} `}
                                                {row.beras_jumlah > 0 && `Ber: ${formatNumber(row.beras_jumlah)}`}
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            {isOvertime ? (
                                                <span style={{
                                                    backgroundColor: '#fee2e2', color: '#991b1b',
                                                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'
                                                }}>
                                                    {formatNumber(row.lembur_jumlah)}
                                                </span>
                                            ) : '-'}
                                            {row.lembur_jam > 0 && (
                                                <div style={{ fontSize: '0.7rem' }}>({row.lembur_jam} hrs)</div>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            {formatNumber(row.total_premi)}
                                            {/* Top Premi breakdown */}
                                            <div style={{ fontSize: '0.65rem', color: '#666', maxWidth: '150px', marginLeft: 'auto' }}>
                                                {Object.entries(row.premi || {})
                                                    .filter(([_, val]) => val > 0)
                                                    .sort((a, b) => b[1] - a[1]) // Sort desc
                                                    .slice(0, 3) // Top 3 only
                                                    .map(([k, v]) => (
                                                        <div key={k}>{k.replace('PREMI_', '')}: {formatNumber(v)}</div>
                                                    ))
                                                }
                                            </div>
                                        </td>
                                        <td className="text-right" style={{ fontSize: '0.7rem' }}>
                                            <div>SPSI: {formatNumber(row.pot_spsi)}</div>
                                            <div>PPH21: {formatNumber(row.pot_pph21)}</div>
                                            <div>BPJS: {formatNumber(row.pot_bpjs_pekerja_total)}</div>
                                        </td>
                                        <td className="text-right">{formatNumber(row.total_potongan_bersih)}</td>
                                        <td className="text-right font-bold" style={{ fontSize: '1.1em' }}>
                                            {formatNumber(row.upah_bersih)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HighEarnerReportPage;
