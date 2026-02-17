/**
 * SalaryHistoryTable Component (Fixed Version)
 *
 * Displays employee salary history in a table format similar to daftar upah
 * Uses the existing payroll endpoint for reliable data fetching
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeHistory } from '../../services/employeeDetailService';
import './SalaryHistoryTable.css';

export function SalaryHistoryTable({ empCode, onPeriodClick, compact = false, months = 12 }) {
    const { token } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'period_year', direction: 'desc' });

    useEffect(() => {
        async function loadHistory() {
            if (!token || !empCode) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await getEmployeeHistory(token, empCode, { months, includeCurrent: false });
                console.log('[SalaryHistoryTable] History response:', response);

                if (response.success && response.data) {
                    // Sort by period (most recent first)
                    const sorted = [...response.data].sort((a, b) => {
                        const periodA = a.period_year * 100 + a.period_month;
                        const periodB = b.period_year * 100 + b.period_month;
                        return periodB - periodA;
                    });
                    setHistory(sorted);
                } else {
                    setError(response.error || 'Failed to load history');
                }
            } catch (err) {
                console.error('[SalaryHistoryTable] Error:', err);
                setError(err.message || 'Failed to load history');
            } finally {
                setLoading(false);
            }
        }

        loadHistory();
    }, [token, empCode, months]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });

        const sorted = [...history].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            if (key === 'period') {
                valA = a.period_year * 100 + a.period_month;
                valB = b.period_year * 100 + b.period_month;
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        setHistory(sorted);
    };

    const handleRowClick = (record) => {
        if (onPeriodClick) {
            onPeriodClick(record);
        }
    };

    if (loading) {
        return (
            <div className="salary-history-table-wrapper loading">
                <div className="table-loading">
                    <div className="spinner"></div>
                    <p>Memuat riwayat gaji...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="salary-history-table-wrapper error">
                <div className="error-content">
                    <p>❌ {error}</p>
                    <p className="error-hint">Pastikan data periode sebelumnya sudah tersedia.</p>
                </div>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="salary-history-table-wrapper empty">
                <p>📋 Tidak ada riwayat gaji ditemukan</p>
                <p className="empty-hint">Data riwayat akan muncul setelah periode berakhir selesai.</p>
            </div>
        );
    }

    // Calculate totals
    const totals = history.reduce((acc, record) => ({
        jumlah_hk: acc.jumlah_hk + (record.jumlah_hk || 0),
        gaji_pokok: acc.gaji_pokok + (record.gaji_pokok || 0),
        tunjangan: acc.tunjangan + (record.total_tunjangan || 0),
        lembur: acc.lembur + (record.lembur_jumlah || 0),
        premi: acc.premi + (record.total_premi || 0),
        potongan: acc.potongan + (record.total_potongan || 0),
        upah_bersih: acc.upah_bersih + (record.upah_bersih || 0)
    }), {
        jumlah_hk: 0,
        gaji_pokok: 0,
        tunjangan: 0,
        lembur: 0,
        premi: 0,
        potongan: 0,
        upah_bersih: 0
    });

    return (
        <div className="salary-history-table-wrapper">
            <div className="table-header">
                <h3>📊 Riwayat Gaji ({history.length} Periode)</h3>
                <div className="table-summary">
                    <span>Rata-rata: <strong>{formatCompact(totals.upah_bersih / history.length)}</strong></span>
                    <span className="separator">|</span>
                    <span>Total: <strong>{formatCompact(totals.upah_bersih)}</strong></span>
                </div>
            </div>

            <div className="table-responsive">
                <table className={`salary-history-table ${compact ? 'compact' : ''}`}>
                    <thead>
                        <tr>
                            <th rowSpan="2" className="sortable" onClick={() => handleSort('period')}>
                                Periode {sortConfig.key === 'period' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th rowSpan="2">Gang</th>
                            <th colSpan="2">Absensi</th>
                            <th rowSpan="2" className="sortable" onClick={() => handleSort('gaji_pokok')}>
                                Gaji Pokok {sortConfig.key === 'gaji_pokok' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th colSpan="3">Tunjangan</th>
                            <th rowSpan="2" className="sortable" onClick={() => handleSort('total_tunjangan')}>
                                Total {sortConfig.key === 'total_tunjangan' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th colSpan="2">Lembur</th>
                            <th rowSpan="2">Premi</th>
                            <th rowSpan="2">Potongan</th>
                            <th rowSpan="2" className="sortable highlight" onClick={() => handleSort('upah_bersih')}>
                                Upah Bersih {sortConfig.key === 'upah_bersih' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                        </tr>
                        <tr>
                            <th className="sortable" onClick={() => handleSort('jumlah_hk')}>
                                HK {sortConfig.key === 'jumlah_hk' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th>Hari</th>
                            <th>Beras</th>
                            <th>Jabatan</th>
                            <th>Masa Kerja</th>
                            <th>Jam</th>
                            <th>Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((record, index) => {
                            const periodLabel = `${getMonthIndo(record.period_month).substring(0, 3)} ${record.period_year}`;

                            return (
                                <tr
                                    key={record.id || index}
                                    className="history-row"
                                    onClick={() => handleRowClick(record)}
                                >
                                    <td className="period-cell">
                                        <span className="period-badge">{periodLabel}</span>
                                    </td>
                                    <td className="gang-cell">{record.gang_code}</td>
                                    <td className="number-cell">{record.jumlah_hk || 0}</td>
                                    <td className="number-cell">{record.hari_kerja || 0}</td>
                                    <td className="number-cell">{formatCompact(record.beras_jumlah)}</td>
                                    <td className="number-cell">{formatCompact(record.jabatan_jumlah)}</td>
                                    <td className="number-cell">{formatCompact(record.masa_kerja_jumlah)}</td>
                                    <td className="number-cell total-cell">{formatCompact(record.total_tunjangan)}</td>
                                    <td className="number-cell">{record.lembur_jam || 0}</td>
                                    <td className="number-cell">{formatCompact(record.lembur_jumlah)}</td>
                                    <td className="number-cell">{formatCompact(record.total_premi)}</td>
                                    <td className="number-cell">{formatCompact(record.total_potongan)}</td>
                                    <td className="number-cell highlight-cell">{formatCompact(record.upah_bersih)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="footer-row">
                            <td colSpan="3"><strong>TOTAL ({history.length})</strong></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td className="number-cell"><strong>{formatCompact(totals.total_tunjangan)}</strong></td>
                            <td></td>
                            <td className="number-cell"><strong>{formatCompact(totals.lembur)}</strong></td>
                            <td className="number-cell"><strong>{formatCompact(totals.premi)}</strong></td>
                            <td className="number-cell"><strong>{formatCompact(totals.potongan)}</strong></td>
                            <td className="number-cell highlight-cell"><strong>{formatCompact(totals.upah_bersih)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="table-footer-note">
                <small>💡 Klik pada baris untuk melihat detail lengkap periode tersebut</small>
            </div>
        </div>
    );
}

function getMonthIndo(month) {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[month - 1] || '';
}

function formatCompact(value) {
    if (!value || value === 0) return '-';
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'jt';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'rb';
    }
    return value.toLocaleString('id-ID');
}

export default SalaryHistoryTable;
