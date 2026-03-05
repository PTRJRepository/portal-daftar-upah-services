import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBatchEmployeeCheckroll, savePayslipHistory } from '../services/payslipService';
import PayslipCard from '../components/PayslipCard';
import { generatePDF } from '../utils/pdfGenerator';
import { Download, Printer, ArrowLeft, FileText, Database, RefreshCw } from 'lucide-react';
import '../styles/payslip-print.css';

/**
 * PayslipPrintPage - Page for printing multiple employee payslips
 * Layout: 4 payslips per A4 page
 */
export default function PayslipPrintPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const printRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
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
                // OPTIMIZATION: Check if data exists in localStorage from CustomPayrollTable
                const storageKey = `payroll_cache_${division}_${month}_${year}`;
                const cached = localStorage.getItem(storageKey);

                if (cached) {
                    const { data: employeeDataMap, timestamp } = JSON.parse(cached);
                    // Check if cache is fresh (less than 15 minutes old)
                    const isFresh = Date.now() - timestamp < 15 * 60 * 1000;

                    if (isFresh) {
                        const localResults = [];
                        const missingInCache = [];

                        empCodes.forEach(code => {
                            const upperCode = code.toUpperCase();
                            const row = employeeDataMap[upperCode];
                            if (row) {
                                // Transform row into the format PayslipCard expects
                                localResults.push({
                                    emp_code: row.emp_code || row.nik,
                                    month,
                                    year,
                                    employee: {
                                        nama: row.nama,
                                        jabatan: row.jabatan_estate || row.task_desc,
                                        gang_code: row.gang_code
                                    },
                                    attendance: {
                                        summary: {
                                            total_hadir: row.hari_kerja || row.kehadiran || 0,
                                            cuti_tahunan: row.cuti_tahunan_hari || 0,
                                            cuti_sakit: row.cuti_sakit_haid_hari || 0,
                                            cuti_minggu: row.cuti_minggu_hari || 0,
                                            libur: row.cuti_nasional_hari || 0,
                                            alpa: row.alpa || 0
                                        }
                                    },
                                    payroll_data: row
                                });
                            } else {
                                missingInCache.push(code);
                            }
                        });

                        // If everything was in cache, we're done!
                        if (missingInCache.length === 0) {
                            console.log('[PayslipPrintPage] Using 100% cached data from localStorage');
                            setPayslipData(localResults);
                            setLoading(false);
                            return;
                        }

                        // If some were missing, we could potentially fetch only those, 
                        // but for simplicity, if cache is incomplete we just proceed to batch fetch
                    }
                }

                console.log('[PayslipPrintPage] Fetching data from API...');
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

    const handleSaveHistory = async () => {
        if (!token) return;

        setSaving(true);
        setError('');
        setSuccessMessage('');

        try {
            const result = await savePayslipHistory(token, month, year, division);
            if (result.success) {
                setSuccessMessage('✅ Data slip gaji berhasil disimpan ke history database.');
                // Hide message after 5 seconds
                setTimeout(() => setSuccessMessage(''), 5000);
            } else {
                setError('Gagal menyimpan data ke history: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            setError('Error saat menyimpan: ' + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleExportPDF = async () => {
        if (!printRef.current) return;
        setExporting(true);
        try {
            const filename = `Slip_Gaji_${division || 'Batch'}_${getMonthName(month)}_${year}.pdf`;
            await generatePDF(printRef.current, filename, {
                jsPDF: { orientation: 'portrait' },
                margin: [0, 0, 0, 0]
            });
        } catch (err) {
            console.error('PDF Export error:', err);
        } finally {
            setExporting(false);
        }
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
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <ArrowLeft size={16} /> Kembali
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
                    {successMessage && (
                        <span style={{ color: '#059669', fontSize: '0.9rem', marginLeft: '1.5rem', fontWeight: '600' }}>
                            {successMessage}
                        </span>
                    )}
                </div>
                <div className="payslip-preview-actions">
                    <div style={{ marginRight: '1rem', color: '#666', fontSize: '0.9rem' }}>
                        {payslipData.length} karyawan
                        {meta && ` (${meta.successful} berhasil${meta.failed > 0 ? `, ${meta.failed} gagal` : ''})`}
                    </div>
                    <button className="payslip-preview-btn" onClick={handleBack}>
                        <ArrowLeft size={16} /> Kembali
                    </button>
                    <button
                        className="payslip-preview-btn"
                        onClick={handleSaveHistory}
                        disabled={saving}
                        style={successMessage ? { borderColor: '#059669', color: '#059669' } : {}}
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                        {saving ? 'Menyimpan...' : 'Simpan ke History'}
                    </button>
                    <button
                        className="payslip-preview-btn"
                        onClick={handleExportPDF}
                        disabled={exporting}
                    >
                        {exporting ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
                        {exporting ? 'Memproses...' : 'Simpan PDF'}
                    </button>
                    <button className="payslip-preview-btn payslip-preview-btn-primary" onClick={handlePrint}>
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>

            {/* Print Pages */}
            <div className="payslip-print-container" ref={printRef}>
                {payslipChunks.map((chunk, chunkIndex) => (
                    <div
                        key={chunkIndex}
                        className="payslip-a4-page"
                        style={chunkIndex === payslipChunks.length - 1 ? { pageBreakAfter: 'auto' } : {}}
                    >
                        <div className="payslip-grid">
                            {chunk.map((employeeData, slotIndex) => (
                                <PayslipCard
                                    key={employeeData.emp_code || slotIndex}
                                    data={employeeData}
                                    month={month}
                                    year={year}
                                />
                            ))}
                            {/* No empty placeholders - grid handles incomplete pages */}
                        </div>
                    </div>
                ))}
            </div>

            {/* Print Instructions - Hidden when printing */}
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }} className="no-print">
                <p style={{ marginBottom: '0.5rem' }}>
                    💡 <strong>Tips Print:</strong> Gunakan pengaturan <strong>Portrait (Tegak)</strong> di dialog print browser Anda agar 4 slip muat dalam 1 lembar A4.
                </p>
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                    Pastikan Skala diatur ke <strong>Default (100%)</strong>.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        className="payslip-preview-btn"
                        onClick={handleSaveHistory}
                        disabled={saving}
                    >
                        {saving ? 'Menyimpan History...' : '💾 Simpan ke History Database'}
                    </button>
                    <button
                        className="payslip-preview-btn"
                        onClick={handleExportPDF}
                        disabled={exporting}
                    >
                        {exporting ? 'Memproses PDF...' : '📄 Simpan sebagai PDF'}
                    </button>
                    <button
                        className="payslip-preview-btn payslip-preview-btn-primary"
                        onClick={handlePrint}
                    >
                        🖨️ Print Sekarang
                    </button>
                </div>
            </div>
        </div>
    );
}
