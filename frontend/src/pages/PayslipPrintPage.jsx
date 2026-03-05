import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBatchEmployeeCheckroll } from '../services/payslipService';
import PayslipCard from '../components/PayslipCard';
import '../styles/payslip-print.css';

/**
 * PayslipPrintPage - Page for printing multiple employee payslips
 * Layout: 4 payslips per A4 page
 */
export default function PayslipPrintPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payslipData, setPayslipData] = useState([]);
    const [meta, setMeta] = useState(null);

    // Get params from URL
    const empCodes = searchParams.get('emp_codes')?.split(',') || [];
    const month = parseInt(searchParams.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();
    const division = searchParams.get('division') || '';

    useEffect(() => {
        async function loadData() {
            if (!token || empCodes.length === 0) {
                setError('Tidak ada karyawan yang dipilih');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const result = await getBatchEmployeeCheckroll(token, empCodes, month, year);

                if (result.success) {
                    setPayslipData(result.data || []);
                    setMeta(result.meta);
                } else {
                    setError('Gagal memuat data slip gaji');
                }
            } catch (err) {
                console.error('Failed to load payslip data:', err);
                setError('Gagal memuat data: ' + (err.message || 'Unknown error'));
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [token, empCodes.join(','), month, year]);

    const handlePrint = () => {
        window.print();
    };

    const handleBack = () => {
        navigate(-1);
    };

    // Chunk data into groups of 4 for each A4 page
    const chunkArray = (array, size) => {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    };

    const payslipChunks = chunkArray(payslipData, 4);

    // Get month name
    const getMonthName = (m) => {
        const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return months[m] || '';
    };

    if (loading) {
        return (
            <div className="payslip-preview-container">
                <div className="payslip-loading">
                    <div className="payslip-loading-spinner"></div>
                    <p style={{ marginTop: '1rem', color: '#666' }}>
                        Memuat data slip gaji...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="payslip-preview-container">
                <div className="payslip-error">
                    <p>❌ {error}</p>
                    <button
                        onClick={handleBack}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Kembali
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="payslip-preview-container">
            {/* Toolbar - Hidden when printing */}
            <div className="payslip-preview-toolbar">
                <div className="payslip-preview-title">
                    Preview Slip Gaji
                    <span style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1rem' }}>
                        {getMonthName(month)} {year}
                    </span>
                </div>
                <div className="payslip-preview-actions">
                    <div style={{ marginRight: '1rem', color: '#666', fontSize: '0.9rem' }}>
                        {payslipData.length} karyawan
                        {meta && ` (${meta.successful} berhasil${meta.failed > 0 ? `, ${meta.failed} gagal` : ''})`}
                    </div>
                    <button className="payslip-preview-btn" onClick={handleBack}>
                        ← Kembali
                    </button>
                    <button className="payslip-preview-btn payslip-preview-btn-primary" onClick={handlePrint}>
                        🖨️ Print
                    </button>
                </div>
            </div>

            {/* Print Pages */}
            <div className="payslip-print-container">
                {payslipChunks.map((chunk, chunkIndex) => (
                    <div key={chunkIndex} className="payslip-a4-page">
                        <div className="payslip-grid">
                            {chunk.map((employeeData, slotIndex) => (
                                <PayslipCard
                                    key={employeeData.emp_code || slotIndex}
                                    data={employeeData}
                                    month={month}
                                    year={year}
                                />
                            ))}
                            {/* Empty placeholders to maintain grid if less than 4 */}
                            {chunk.length < 4 && Array.from({ length: 4 - chunk.length }).map((_, i) => (
                                <div key={`empty-${i}`} className="payslip-card" style={{ border: 'none', visibility: 'hidden' }}></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Print Instructions - Hidden when printing */}
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }} className="no-print">
                <p style={{ marginBottom: '0.5rem' }}>
                    💡 <strong>Tips Print:</strong> Gunakan pengaturan <strong>Landscape (Mendatar)</strong> di dialog print browser Anda.
                </p>
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                    Pastikan Skala diatur ke <strong>Default (100%)</strong> agar 4 slip muat dalam 1 lembar A4.
                </p>
                <button
                    className="payslip-preview-btn payslip-preview-btn-primary"
                    onClick={handlePrint}
                    style={{ marginTop: '1rem' }}
                >
                    🖨️ Print Sekarang
                </button>
            </div>
        </div>
    );
}
