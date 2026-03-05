import React, { useState, useEffect, useRef } from 'react';
import { getMillProductionSummary } from '../services/millProductionService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ComposedChart, Line
} from 'recharts';
import { Calendar, Scale, RefreshCw, Users, DollarSign, TrendingUp, Printer } from 'lucide-react';
import './MillProductionReport.css';

const MillProductionReport = () => {
    const [month, setMonth] = useState('2');
    const [year, setYear] = useState('2026');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getMillProductionSummary(parseInt(month), parseInt(year));
            setData(result);
        } catch (err) {
            setError(err.message || 'Terjadi kesalahan saat mengambil data');
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [month, year]);

    const handlePrint = () => window.print();

    // Summaries
    const totalTonnage = data.reduce((a, c) => a + (c.total_ffb_ton || 0), 0);
    const totalHK = data.reduce((a, c) => a + (c.total_hk || 0), 0);
    const totalCost = data.reduce((a, c) => a + (c.total_upah_bersih || 0), 0);
    const totalPremi = data.reduce((a, c) => a + (c.total_premi || 0), 0);
    const totalLembur = data.reduce((a, c) => a + (c.total_lembur || 0), 0);
    const totalEmployees = data.reduce((a, c) => a + (c.total_employees || 0), 0);
    const avgTonPerHK = totalHK > 0 ? totalTonnage / totalHK : 0;
    const avgCostPerTon = totalTonnage > 0 ? totalCost / totalTonnage : 0;

    const fmt = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n || 0);
    const fmtCur = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
    const monthName = new Date(0, parseInt(month) - 1).toLocaleString('id-ID', { month: 'long' });

    return (
        <div className="mill-report-container">
            {/* Header */}
            <div className="mill-report-header no-print">
                <div>
                    <h1 className="mill-report-title">Analisis Produktivitas Kebun</h1>
                    <p className="mill-report-subtitle">Perbandingan tonase FFB, HK, dan biaya upah per divisi — {monthName} {year}</p>
                </div>
                <div className="mill-report-controls">
                    <div className="control-group">
                        <Calendar size={18} className="control-icon" />
                        <select value={month} onChange={e => setMonth(e.target.value)} className="month-select">
                            {[...Array(12).keys()].map(i => (
                                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>
                    <div className="control-group">
                        <select value={year} onChange={e => setYear(e.target.value)} className="year-select">
                            {[2024, 2025, 2026, 2027].map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>
                    <button onClick={fetchData} className="refresh-button" disabled={loading}>
                        <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
                    </button>
                    <button onClick={handlePrint} className="print-button" disabled={loading || data.length === 0}>
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>

            {/* Print Header */}
            <div className="print-header print-only">
                <h1>PT REBINMAS JAYA</h1>
                <h2>Analisis Produktivitas Kebun</h2>
                <p>Periode: {monthName} {year}</p>
            </div>

            {error && <div className="error-banner no-print">{error}</div>}

            {!error && !loading && (
                <>
                    {/* KPI Cards */}
                    <div className="mill-summary-cards no-print">
                        <div className="summary-card var-green">
                            <div className="card-icon-wrapper"><Scale size={24} /></div>
                            <div className="card-content">
                                <h3>Total Tonase FFB</h3>
                                <p className="card-value">{fmt(totalTonnage)} <span className="unit">Ton</span></p>
                            </div>
                        </div>
                        <div className="summary-card var-amber">
                            <div className="card-icon-wrapper"><Users size={24} /></div>
                            <div className="card-content">
                                <h3>Tenaga Kerja</h3>
                                <p className="card-value">{fmt(totalHK)} <span className="unit">HK</span></p>
                                <p className="card-subvalue">{fmt(totalEmployees)} karyawan</p>
                            </div>
                        </div>
                        <div className="summary-card var-red">
                            <div className="card-icon-wrapper"><DollarSign size={24} /></div>
                            <div className="card-content">
                                <h3>Total Biaya Upah</h3>
                                <p className="card-value" style={{ fontSize: '1.35rem' }}>{fmtCur(totalCost)}</p>
                            </div>
                        </div>
                        <div className="summary-card var-purple">
                            <div className="card-icon-wrapper"><TrendingUp size={24} /></div>
                            <div className="card-content">
                                <h3>Efisiensi</h3>
                                <p className="card-value">{fmt(avgTonPerHK)} <span className="unit">Ton/HK</span></p>
                                <p className="card-subvalue">{fmtCur(avgCostPerTon)} / Ton</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts - hidden in print */}
                    <div className="mill-charts-grid no-print">
                        <div className="chart-panel">
                            <h3 className="chart-title">Tonase FFB vs Hari Kerja (HK) per Divisi</h3>
                            <ResponsiveContainer width="100%" height={360}>
                                <ComposedChart data={data} margin={{ top: 20, right: 40, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="division_code" tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }} />
                                    <YAxis yAxisId="left" tick={{ fill: '#10b981', fontSize: 12 }} label={{ value: 'Ton', angle: -90, position: 'insideLeft', fill: '#10b981' }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#f59e0b', fontSize: 12 }} label={{ value: 'HK', angle: 90, position: 'insideRight', fill: '#f59e0b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(v, name) => name === 'Tonase (Ton)' ? [fmt(v) + ' Ton', name] : [fmt(v), name]} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="total_ffb_ton" name="Tonase (Ton)" radius={[4, 4, 0, 0]} fill="#10b981" />
                                    <Bar yAxisId="right" dataKey="total_hk" name="HK" radius={[4, 4, 0, 0]} fill="#f59e0b" opacity={0.75} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-panel">
                            <h3 className="chart-title">Biaya per Ton & Produktivitas (Ton/HK)</h3>
                            <ResponsiveContainer width="100%" height={360}>
                                <ComposedChart data={data} margin={{ top: 20, right: 40, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="division_code" tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 600 }} />
                                    <YAxis yAxisId="left" tick={{ fill: '#ef4444', fontSize: 12 }} label={{ value: 'Rp/Ton', angle: -90, position: 'insideLeft', fill: '#ef4444' }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8b5cf6', fontSize: 12 }} label={{ value: 'Ton/HK', angle: 90, position: 'insideRight', fill: '#8b5cf6' }} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        formatter={(v, name) => name === 'Biaya / Ton' ? [fmtCur(v), name] : [fmt(v), name]} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="cost_per_ton" name="Biaya / Ton" radius={[4, 4, 0, 0]} fill="#ef4444" opacity={0.8} />
                                    <Line yAxisId="right" type="monotone" dataKey="ton_per_hk" name="Ton / HK" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6' }} activeDot={{ r: 7 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Data Table - shown in print */}
                    <div className="mill-data-table-container">
                        <h3 className="table-title">Detail Analisis Produktivitas per Divisi</h3>
                        <div className="table-wrapper">
                            <table className="mill-data-table">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Divisi</th>
                                        <th className="text-right">Pekerja</th>
                                        <th className="text-right">HK</th>
                                        <th className="text-right">Tonase (Ton)</th>
                                        <th className="text-right">Total Upah</th>
                                        <th className="text-right">Premi</th>
                                        <th className="text-right">Lembur</th>
                                        <th className="text-right">Ton/HK</th>
                                        <th className="text-right">Biaya/Ton</th>
                                        <th className="text-right">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="text-center">{idx + 1}</td>
                                            <td className="font-semibold">{row.division_code}</td>
                                            <td className="text-right">{fmt(row.total_employees)}</td>
                                            <td className="text-right text-amber-600 font-semibold">{fmt(row.total_hk)}</td>
                                            <td className="text-right font-semibold text-emerald-600">{fmt(row.total_ffb_ton)}</td>
                                            <td className="text-right">{fmtCur(row.total_upah_bersih)}</td>
                                            <td className="text-right">{fmtCur(row.total_premi)}</td>
                                            <td className="text-right">{fmtCur(row.total_lembur)}</td>
                                            <td className="text-right font-semibold text-purple-600">{fmt(row.ton_per_hk)}</td>
                                            <td className="text-right text-red-600">{fmtCur(row.cost_per_ton)}</td>
                                            <td className="text-right text-gray-500">
                                                {totalTonnage > 0 ? ((row.total_ffb_ton / totalTonnage) * 100).toFixed(1) + '%' : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr><td colSpan="11" className="text-center" style={{ padding: '2rem', color: '#9ca3af' }}>Tidak ada data.</td></tr>
                                    )}
                                </tbody>
                                {data.length > 0 && (
                                    <tfoot>
                                        <tr className="font-bold bg-gray-50">
                                            <td colSpan="2" className="text-right">TOTAL</td>
                                            <td className="text-right">{fmt(totalEmployees)}</td>
                                            <td className="text-right text-amber-700">{fmt(totalHK)}</td>
                                            <td className="text-right text-emerald-700">{fmt(totalTonnage)}</td>
                                            <td className="text-right">{fmtCur(totalCost)}</td>
                                            <td className="text-right">{fmtCur(totalPremi)}</td>
                                            <td className="text-right">{fmtCur(totalLembur)}</td>
                                            <td className="text-right text-purple-700">{fmt(avgTonPerHK)}</td>
                                            <td className="text-right text-red-700">{fmtCur(avgCostPerTon)}</td>
                                            <td className="text-right">100%</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Print Summary */}
                    <div className="print-summary print-only">
                        <div className="print-summary-row">
                            <span>Total Tonase FFB:</span><strong>{fmt(totalTonnage)} Ton</strong>
                        </div>
                        <div className="print-summary-row">
                            <span>Total HK:</span><strong>{fmt(totalHK)}</strong>
                        </div>
                        <div className="print-summary-row">
                            <span>Total Biaya Upah:</span><strong>{fmtCur(totalCost)}</strong>
                        </div>
                        <div className="print-summary-row">
                            <span>Rata-rata Ton/HK:</span><strong>{fmt(avgTonPerHK)}</strong>
                        </div>
                        <div className="print-summary-row">
                            <span>Rata-rata Biaya/Ton:</span><strong>{fmtCur(avgCostPerTon)}</strong>
                        </div>
                    </div>
                </>
            )}

            {loading && (
                <div className="loading-state no-print">
                    <div className="spinner"></div>
                    <p>Mengambil data produktivitas kebun...</p>
                </div>
            )}
        </div>
    );
};

export default MillProductionReport;
