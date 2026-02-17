/**
 * SalaryHistoryTimeline Component
 *
 * Displays a timeline of an employee's salary history across multiple periods
 * Shows key metrics for each period with expandable details
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeHistory, formatMonthName, formatCurrency } from '../../services/historyService';
import './SalaryHistoryTimeline.css';

export function SalaryHistoryTimeline({ empCode, onPeriodClick }) {
    const { token } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        async function loadHistory() {
            if (!token || !empCode) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await getEmployeeHistory(token, empCode);
                if (response.success) {
                    setHistory(response.data);
                } else {
                    setError(response.error || 'Failed to load history');
                }
            } catch (err) {
                console.error('[SalaryHistoryTimeline] Error:', err);
                setError(err.message || 'Failed to load history');
            } finally {
                setLoading(false);
            }
        }

        loadHistory();
    }, [token, empCode]);

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const handlePeriodClick = (record) => {
        if (onPeriodClick) {
            onPeriodClick(record);
        }
    };

    if (loading) {
        return (
            <div className="salary-history-timeline loading">
                <div className="spinner"></div>
                <p>Memuat riwayat gaji...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="salary-history-timeline error">
                <p>❌ {error}</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="salary-history-timeline empty">
                <p>Tidak ada riwayat gaji ditemukan</p>
            </div>
        );
    }

    return (
        <div className="salary-history-timeline">
            <h3>📜 Riwayat Gaji Per Bulan</h3>
            <div className="timeline-container">
                {history.map((record, index) => (
                    <div key={record.id || index} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                            <SalaryHistoryCard
                                record={record}
                                isExpanded={expandedId === record.id}
                                onToggle={() => toggleExpand(record.id)}
                                onPeriodClick={() => handlePeriodClick(record)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SalaryHistoryCard({ record, isExpanded, onToggle, onPeriodClick }) {
    const monthName = formatMonthName(record.period_month);
    const periodLabel = `${monthName} ${record.period_year}`;

    // Calculate some derived values
    const totalTunjangan = (record.beras_jumlah || 0) +
                          (record.jabatan_jumlah || 0) +
                          (record.masa_kerja_jumlah || 0);
    const totalPotongan = (record.pot_spsi || 0) +
                          (record.pot_pph21 || 0) +
                          (record.pot_koreksi || 0) +
                          (record.pot_bpjs_pekerja_total || 0);

    return (
        <div className={`history-card ${isExpanded ? 'expanded' : ''}`}>
            <div className="history-card-header" onClick={onToggle}>
                <div className="history-period">
                    <span className="period-label">{periodLabel}</span>
                    <span className="gang-label">{record.gang_description || record.gang_code}</span>
                </div>
                <div className="history-summary">
                    <div className="summary-item">
                        <span className="label">HK</span>
                        <span className="value">{record.jumlah_hk || 0}</span>
                    </div>
                    <div className="summary-item">
                        <span className="label">Gaji Pokok</span>
                        <span className="value">{formatCurrency(record.gaji_pokok)}</span>
                    </div>
                    <div className="summary-item highlight">
                        <span className="label">Upah Bersih</span>
                        <span className="value">{formatCurrency(record.upah_bersih)}</span>
                    </div>
                </div>
                <div className="expand-icon">
                    {isExpanded ? '▼' : '▶'}
                </div>
            </div>

            {isExpanded && (
                <div className="history-card-body">
                    <div className="detail-grid">
                        {/* Attendance Section */}
                        <div className="detail-section">
                            <h4>Absensi</h4>
                            <div className="detail-row">
                                <span>Hari Kerja</span>
                                <span>{record.hari_kerja || 0} hari</span>
                            </div>
                            <div className="detail-row">
                                <span>Jumlah HK</span>
                                <span>{record.jumlah_hk || 0}</span>
                            </div>
                            <div className="detail-row">
                                <span>Cuti Tahunan</span>
                                <span>{record.cuti_tahunan_hari || 0} hari</span>
                            </div>
                            <div className="detail-row">
                                <span>Cuti Sakit/Haid</span>
                                <span>{record.cuti_sakit_haid_hari || 0} hari</span>
                            </div>
                        </div>

                        {/* Tunjangan Section */}
                        <div className="detail-section">
                            <h4>Tunjangan</h4>
                            <div className="detail-row">
                                <span>Beras</span>
                                <span>{formatCurrency(record.beras_jumlah)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Jabatan</span>
                                <span>{formatCurrency(record.jabatan_jumlah)}</span>
                            </div>
                            <div className="detail-row">
                                <span>Masa Kerja</span>
                                <span>{formatCurrency(record.masa_kerja_jumlah)}</span>
                            </div>
                            <div className="detail-row total">
                                <span>Total Tunjangan</span>
                                <span>{formatCurrency(totalTunjangan)}</span>
                            </div>
                        </div>

                        {/* Lembur Section */}
                        <div className="detail-section">
                            <h4>Lembur</h4>
                            <div className="detail-row">
                                <span>Total Jam</span>
                                <span>{record.lembur_jam || 0} jam</span>
                            </div>
                            <div className="detail-row total">
                                <span>Total Lembur</span>
                                <span>{formatCurrency(record.lembur_jumlah)}</span>
                            </div>
                        </div>

                        {/* Premi Section */}
                        <div className="detail-section">
                            <h4>Premi</h4>
                            <div className="detail-row">
                                <span>Brondol</span>
                                <span>{formatCurrency(record.premi_brondol)}</span>
                            </div>
                            <div className="detail-row total">
                                <span>Total Premi</span>
                                <span>{formatCurrency(record.total_premi)}</span>
                            </div>
                        </div>

                        {/* Potongan Section */}
                        <div className="detail-section">
                            <h4>Potongan</h4>
                            <div className="detail-row">
                                <span>SPSI</span>
                                <span>{formatCurrency(record.pot_spsi)}</span>
                            </div>
                            <div className="detail-row">
                                <span>PPH21</span>
                                <span>{formatCurrency(record.pot_pph21)}</span>
                            </div>
                            <div className="detail-row">
                                <span>BPJS</span>
                                <span>{formatCurrency(record.pot_bpjs_pekerja_total)}</span>
                            </div>
                            <div className="detail-row total">
                                <span>Total Potongan</span>
                                <span>{formatCurrency(record.total_potongan)}</span>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="detail-section summary-section">
                            <h4>Ringkasan</h4>
                            <div className="detail-row">
                                <span>Upah Kotor</span>
                                <span>{formatCurrency(record.jumlah_upah_kotor)}</span>
                            </div>
                            <div className="detail-row highlight">
                                <span>Upah Bersih</span>
                                <span className="large-value">{formatCurrency(record.upah_bersih)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="history-card-actions">
                        <button className="btn btn-primary" onClick={onPeriodClick}>
                            Lihat Detail Lengkap →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SalaryHistoryTimeline;
