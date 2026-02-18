import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeHistory } from '../../services/employeeDetailService';
import './SalaryHistoryTable.css';

/**
 * SalaryHistoryTable - Comprehensive tabular view of salary history
 * Displays all daftar upah fields in a structured table with sortable columns.
 */
export default function SalaryHistoryTable({ empCode, months = 12 }) {
    const [historyData, setHistoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortField, setSortField] = useState('period_year');
    const [sortDir, setSortDir] = useState('desc');
    const [expandedColumns, setExpandedColumns] = useState({
        absensi: false,
        tunjangan: false,
        potongan: false,
        pajak: false,
    });
    const { token } = useAuth();

    useEffect(() => {
        if (!empCode || !token) return;
        setLoading(true);
        setError(null);
        getEmployeeHistory(token, empCode, { months, includeCurrent: false })
            .then(res => setHistoryData(res.data || []))
            .catch(err => setError(err.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, [empCode, months, token]);

    const fmt = (value) => {
        if (value === null || value === undefined || value === '') return '-';
        const num = Number(value);
        if (isNaN(num)) return value;
        if (num === 0) return '0';
        return new Intl.NumberFormat('id-ID').format(Math.round(num));
    };

    const sorted = useMemo(() => {
        if (!historyData.length) return [];
        return [...historyData].sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];
            if (sortField === 'period_year') {
                aVal = a.period_year * 100 + a.period_month;
                bVal = b.period_year * 100 + b.period_month;
            }
            if (typeof aVal === 'string') {
                return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [historyData, sortField, sortDir]);

    const totals = useMemo(() => {
        if (!historyData.length) return {};
        const sum = (field) => historyData.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
        return {
            gaji_pokok: sum('gaji_pokok'),
            total_tunjangan: sum('total_tunjangan'),
            lembur_jumlah: sum('lembur_jumlah'),
            total_premi: sum('total_premi'),
            total_potongan: sum('total_potongan'),
            jumlah_upah_kotor: sum('jumlah_upah_kotor'),
            upah_bersih: sum('upah_bersih'),
        };
    }, [historyData]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const toggleColumnGroup = (group) => {
        setExpandedColumns(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <span className="sht-sort-icon">⇅</span>;
        return <span className="sht-sort-icon active">{sortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    if (loading) {
        return (
            <div className="sht-table-container sht-table-loading">
                <div className="sht-spinner" />
                <p>Loading salary history...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="sht-table-container sht-table-error">
                <p>⚠ {error}</p>
            </div>
        );
    }

    if (!historyData.length) {
        return (
            <div className="sht-table-container sht-table-empty">
                <p>📭 No salary history data available</p>
            </div>
        );
    }

    return (
        <div className="sht-table-container">
            <div className="sht-table-toolbar">
                <div className="sht-table-info">
                    📊 {historyData.length} periode dimuat
                </div>
                <div className="sht-column-toggles">
                    {Object.entries({
                        absensi: '📋 Absensi',
                        tunjangan: '🎁 Tunjangan',
                        potongan: '📉 Potongan Detail',
                        pajak: '🏛️ Pajak'
                    }).map(([key, label]) => (
                        <button
                            key={key}
                            className={`sht-toggle-btn ${expandedColumns[key] ? 'active' : ''}`}
                            onClick={() => toggleColumnGroup(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="sht-table-scroll">
                <table className="sht-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('period_year')} className="sht-th-sticky">
                                Periode <SortIcon field="period_year" />
                            </th>
                            <th>Gang</th>

                            {/* Absensi */}
                            <th onClick={() => handleSort('jumlah_hk')}>HK <SortIcon field="jumlah_hk" /></th>
                            {expandedColumns.absensi && <>
                                <th>Hari Kerja</th>
                                <th>Jam Kerja</th>
                                <th>CT</th>
                                <th>CS</th>
                                <th>CM</th>
                                <th>CN</th>
                            </>}

                            {/* Penggajian */}
                            <th>Upah Dasar</th>
                            <th onClick={() => handleSort('gaji_pokok')}>Gaji Pokok <SortIcon field="gaji_pokok" /></th>

                            {/* Tunjangan */}
                            {expandedColumns.tunjangan && <>
                                <th>Beras</th>
                                <th>Jabatan</th>
                                <th>Masa Kerja</th>
                            </>}
                            <th onClick={() => handleSort('total_tunjangan')}>Tot. Tunj. <SortIcon field="total_tunjangan" /></th>

                            {/* Lembur & Premi */}
                            <th onClick={() => handleSort('lembur_jumlah')}>Lembur <SortIcon field="lembur_jumlah" /></th>
                            <th onClick={() => handleSort('total_premi')}>Premi <SortIcon field="total_premi" /></th>

                            {/* Potongan */}
                            {expandedColumns.potongan && <>
                                <th>SPSI</th>
                                <th>PPH21</th>
                                <th>ASTEK</th>
                                <th>BPJS Kes</th>
                                <th>BPJS Pens</th>
                                <th>Koreksi</th>
                            </>}
                            <th onClick={() => handleSort('total_potongan')}>Tot. Pot. <SortIcon field="total_potongan" /></th>

                            {/* Pajak */}
                            {expandedColumns.pajak && <>
                                <th>PTKP</th>
                                <th>TER</th>
                                <th>Tarif %</th>
                                <th>PPH21 TER</th>
                            </>}

                            {/* Totals */}
                            <th onClick={() => handleSort('jumlah_upah_kotor')}>Upah Kotor <SortIcon field="jumlah_upah_kotor" /></th>
                            <th onClick={() => handleSort('upah_bersih')} className="sht-th-net">
                                Upah Bersih <SortIcon field="upah_bersih" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row, idx) => (
                            <tr key={`${row.period_year}_${row.period_month}`}>
                                <td className="sht-td-period">{row.period_label}</td>
                                <td className="sht-td-gang">{row.gang_code || '-'}</td>

                                {/* Absensi */}
                                <td className="sht-td-num">{row.jumlah_hk || 0}</td>
                                {expandedColumns.absensi && <>
                                    <td className="sht-td-num sht-td-dim">{row.hari_kerja || 0}</td>
                                    <td className="sht-td-num sht-td-dim">{fmt(row.total_jam_kerja)}</td>
                                    <td className="sht-td-num sht-td-dim">{row.cuti_tahunan_hari || 0}</td>
                                    <td className="sht-td-num sht-td-dim">{row.cuti_sakit_haid_hari || 0}</td>
                                    <td className="sht-td-num sht-td-dim">{row.cuti_minggu_hari || 0}</td>
                                    <td className="sht-td-num sht-td-dim">{row.cuti_nasional_hari || 0}</td>
                                </>}

                                {/* Penggajian */}
                                <td className="sht-td-num sht-td-dim">{fmt(row.upah_dasar)}</td>
                                <td className="sht-td-num">{fmt(row.gaji_pokok)}</td>

                                {/* Tunjangan */}
                                {expandedColumns.tunjangan && <>
                                    <td className="sht-td-num sht-td-dim">{fmt(row.beras_jumlah)}</td>
                                    <td className="sht-td-num sht-td-dim">{fmt(row.jabatan_jumlah)}</td>
                                    <td className="sht-td-num sht-td-dim">{fmt(row.masa_kerja_jumlah)}</td>
                                </>}
                                <td className="sht-td-num">{fmt(row.total_tunjangan)}</td>

                                {/* Lembur & Premi */}
                                <td className="sht-td-num">{fmt(row.lembur_jumlah)}</td>
                                <td className="sht-td-num">{fmt(row.total_premi)}</td>

                                {/* Potongan */}
                                {expandedColumns.potongan && <>
                                    <td className="sht-td-num sht-td-neg">{fmt(row.pot_spsi)}</td>
                                    <td className="sht-td-num sht-td-neg">{fmt(row.pot_pph21)}</td>
                                    <td className="sht-td-num sht-td-neg">{fmt(row.pot_astek_pekerja || row.pot_astek)}</td>
                                    <td className="sht-td-num sht-td-neg">{fmt(row.pot_bpjs_kesehatan_pekerja)}</td>
                                    <td className="sht-td-num sht-td-neg">{fmt(row.pot_bpjs_pensiun_pekerja)}</td>
                                    <td className="sht-td-num sht-td-neg">{fmt(row.pot_koreksi)}</td>
                                </>}
                                <td className="sht-td-num sht-td-neg">{fmt(row.total_potongan)}</td>

                                {/* Pajak */}
                                {expandedColumns.pajak && <>
                                    <td className="sht-td-dim">{row.status_ptkp || '-'}</td>
                                    <td className="sht-td-dim">{row.kategori_ter || '-'}</td>
                                    <td className="sht-td-num sht-td-dim">{row.tarif_pajak_ter || 0}%</td>
                                    <td className="sht-td-num sht-td-dim">{fmt(row.pph21_ter)}</td>
                                </>}

                                {/* Totals */}
                                <td className="sht-td-num">{fmt(row.jumlah_upah_kotor)}</td>
                                <td className="sht-td-num sht-td-net">{fmt(row.upah_bersih)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="sht-totals-row">
                            <td colSpan={2 + (expandedColumns.absensi ? 6 : 0)}>TOTAL</td>

                            <td className="sht-td-num">{expandedColumns.absensi ? '' : ''}</td>
                            <td className="sht-td-num">{fmt(totals.gaji_pokok)}</td>
                            <td className="sht-td-num">{fmt(totals.gaji_pokok)}</td>

                            {expandedColumns.tunjangan && <td colSpan={3}></td>}
                            <td className="sht-td-num">{fmt(totals.total_tunjangan)}</td>

                            <td className="sht-td-num">{fmt(totals.lembur_jumlah)}</td>
                            <td className="sht-td-num">{fmt(totals.total_premi)}</td>

                            {expandedColumns.potongan && <td colSpan={6}></td>}
                            <td className="sht-td-num sht-td-neg">{fmt(totals.total_potongan)}</td>

                            {expandedColumns.pajak && <td colSpan={4}></td>}

                            <td className="sht-td-num">{fmt(totals.jumlah_upah_kotor)}</td>
                            <td className="sht-td-num sht-td-net">{fmt(totals.upah_bersih)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
