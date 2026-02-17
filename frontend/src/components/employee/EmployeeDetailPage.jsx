/**
 * EmployeeDetailPage - Payslip Style + Matrix
 * Displays employee checkroll data as a formal payslip/receipt
 * followed by Attendance and Overtime matrices
 */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getEmployeeCheckroll } from '../../services/employeeDetailService'
import LoadingScreen from '../common/LoadingScreen'
import './EmployeeDetailPage.css'

// Helper to format currency
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    // Handle 0 explicitly if needed, but formatter works.
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

// ... existing code ...



// Helper to get month name in Indonesian
const getMonthName = (month) => {
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return months[month] || ''
}

// Helper to format day type to Indonesian
const formatDayType = (dayType, rawDayType) => {
    // If raw_day_type is provided, use it for proper mapping
    if (rawDayType) {
        const typeMap = {
            'WORKDAY_LONG': 'Hari Kerja Panjang',
            'WORKDAY_SHORT': 'Hari Kerja Pendek',
            'SUNDAY': 'Minggu',
            'HOLIDAY_REGULAR': 'Libur Nasional',
            'HOLIDAY_RELIGIOUS': 'Libur Keagamaan',
        };
        return typeMap[rawDayType] || dayType || '-';
    }

    // Fallback to display value
    const typeMap = {
        'Hari Kerja Panjang': 'Hari Kerja Panjang',
        'Hari Kerja Pendek': 'Hari Kerja Pendek',
        'Minggu': 'Minggu',
        'Libur Nasional': 'Libur Nasional',
        'Libur Keagamaan': 'Libur Keagamaan',
        'Hari Kerja': 'Hari Kerja',
    };
    return typeMap[dayType] || dayType || '-';
}

// Helper to get CSS class for day type badge
const getDayTypeClass = (dayType, rawDayType) => {
    // If raw_day_type is provided, use it for CSS class
    if (rawDayType) {
        const classMap = {
            'WORKDAY_LONG': 'day-type-workday-long',
            'WORKDAY_SHORT': 'day-type-workday-short',
            'SUNDAY': 'day-type-sunday',
            'HOLIDAY_REGULAR': 'day-type-holiday',
            'HOLIDAY_RELIGIOUS': 'day-type-holiday-religious',
        };
        return classMap[rawDayType] || 'day-type-default';
    }

    // Fallback to display value
    const classMap = {
        'Hari Kerja Panjang': 'day-type-workday-long',
        'Hari Kerja Pendek': 'day-type-workday-short',
        'Minggu': 'day-type-sunday',
        'Libur Nasional': 'day-type-holiday',
        'Libur Keagamaan': 'day-type-holiday-religious',
        'Hari Kerja': 'day-type-workday',
    };
    return classMap[dayType] || 'day-type-default';
}

// Attendance status colors (Restored)
const statusColors = {
    hadir: { bg: '#10b981', text: '#fff', label: 'H' },
    alpa: { bg: '#ef4444', text: '#fff', label: 'A' },
    sakit: { bg: '#f59e0b', text: '#fff', label: 'S' },
    cuti: { bg: '#8b5cf6', text: '#fff', label: 'C' },
    cuti_tahunan: { bg: '#8b5cf6', text: '#fff', label: 'C' },
    cuti_nasional: { bg: '#3b82f6', text: '#fff', label: 'L' },
    minggu: { bg: '#6b7280', text: '#fff', label: 'M' },
    libur: { bg: '#3b82f6', text: '#fff', label: 'L' },
    libur_nasional: { bg: '#3b82f6', text: '#fff', label: 'L' },
    libur_keagamaan: { bg: '#3b82f6', text: '#fff', label: 'K' },
    no_data: { bg: '#e5e7eb', text: '#9ca3af', label: '-' }
}

export default function EmployeeDetailPage({
    employeeData,  // Full row data passed from PayrollGrid
    month,
    year,
    division,
    onBack
}) {
    const { token } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [checkrollData, setCheckrollData] = useState(null)

    const empCode = employeeData?.nik || employeeData?.NIK || ''

    useEffect(() => {
        async function loadData() {
            if (!token || !empCode) {
                setError('Token atau NIK tidak tersedia')
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')

            try {
                const data = await getEmployeeCheckroll(token, empCode, month, year, division)
                console.log('[EmployeeDetailPage] Received Checkroll Data:', data)
                setCheckrollData(data)
            } catch (e) {
                console.error('Failed to load checkroll data:', e)
                setError('Gagal memuat data checkroll: ' + (e.message || e))
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [token, empCode, month, year, division])

    if (loading) {
        return <LoadingScreen isLoading={true} message="Memuat slip gaji..." />
    }

    if (error) {
        return (
            <div className="payslip-wrapper">
                <div className="error-screen">
                    <p>❌ {error}</p>
                    <button onClick={onBack} className="btn btn-secondary">Kembali</button>
                </div>
            </div>
        )
    }

    // Determine the source of data (priority: checkrollData -> employeeData)
    const data = checkrollData?.payroll_data || employeeData || {}
    const empInfo = checkrollData?.employee || employeeData || {}
    const attendance = checkrollData?.attendance || {}
    const overtime = checkrollData?.overtime || {}
    const harvest = checkrollData?.harvest || []

    // Helper to safely get numeric values
    const getNum = (key) => {
        const val = data[key] ?? empInfo[key]
        return typeof val === 'number' ? val : 0
    }

    // --- CALCULATIONS & DATA PREPARATION ---

    // 1. Gaji Pokok
    const hk = getNum('hari_kerja') || getNum('jumlah_hk')
    const rate = getNum('upah_dasar') || getNum('upah_harian')
    const gajiPokok = getNum('upah_pokok') || (hk * rate)

    // 2. Tunjangan Breakdown
    const tunjanganList = [
        { label: 'Tunjangan Beras', value: getNum('beras_jumlah') },
        { label: 'Tunjangan Jabatan', value: getNum('jabatan_jumlah') },
        { label: 'Tunjangan Masa Kerja', value: getNum('masa_kerja_jumlah') },
        // Add other tunjangan if any
    ].filter(item => item.value > 0)

    // 3. Premi Breakdown
    const premiList = []

    // Explicit premiums
    if (getNum('premi_brondol') > 0) premiList.push({ label: 'Premi Brondol', value: getNum('premi_brondol') })

    // Dynamic/Other premiums
    if (data.premi && typeof data.premi === 'object') {
        Object.entries(data.premi).forEach(([key, val]) => {
            if (key !== 'premi_brondol' && val > 0) {
                const label = key.replace(/_/g, ' ').replace(/premi /i, '').toUpperCase()
                premiList.push({ label: `Premi ${label}`, value: val })
            }
        })
    } else {
        Object.entries(data).forEach(([key, val]) => {
            if (key.startsWith('premi_') && key !== 'premi_brondol' && typeof val === 'number' && val > 0) {
                const label = key.replace('premi_', '').replace(/_/g, ' ').toUpperCase()
                if (!premiList.some(p => p.label === `Premi ${label}`)) {
                    premiList.push({ label: `Premi ${label}`, value: val })
                }
            }
        })
    }

    const totalPremi = getNum('total_premi')

    // 4. Lembur
    const lemburJam = getNum('lembur_jam')
    const lemburJumlah = getNum('lembur_jumlah')

    // 5. Potongan Breakdown
    const potKotorList = []
    if (getNum('pot_koreksi') > 0) potKotorList.push({ label: 'Koreksi', value: getNum('pot_koreksi') })

    Object.entries(data).forEach(([key, val]) => {
        if (key.startsWith('koreksi_') && typeof val === 'number' && val > 0) {
            const label = key.replace('koreksi_', '').replace(/_/g, ' ').toUpperCase()
            potKotorList.push({ label: `Koreksi ${label}`, value: val })
        }
    })

    const subtotalPotKotor = potKotorList.reduce((acc, curr) => acc + curr.value, 0)
    const totalPotKotor = getNum('potongan_upah_kotor_total') || subtotalPotKotor

    const potBersihList = [
        { label: 'BPJS Kesehatan', value: getNum('pot_bpjs_kesehatan_pekerja') },
        { label: 'BPJS Pensiun', value: getNum('pot_bpjs_pensiun_pekerja') },
        { label: 'Astek Pekerja', value: getNum('pot_astek') || getNum('pot_astek_jumlah') },
        { label: 'SPSI', value: getNum('pot_spsi') },
        { label: 'PPh 21', value: getNum('pot_pph21') },
    ].filter(item => item.value > 0)

    const standardPotKeys = ['pot_bpjs_kesehatan_pekerja', 'pot_bpjs_pensiun_pekerja', 'pot_astek', 'pot_astek_jumlah', 'pot_spsi', 'pot_pph21', 'pot_koreksi', 'potongan_upah_kotor_total', 'total_potongan', 'pot_bpjs_kesehatan_majikan', 'pot_bpjs_pensiun_majikan']

    Object.entries(data).forEach(([key, val]) => {
        if (key.startsWith('pot_') && !standardPotKeys.includes(key) && !key.includes('total') && typeof val === 'number' && val > 0) {
            const label = key.replace('pot_', '').replace(/_/g, ' ').toUpperCase()
            potBersihList.push({ label: label, value: val })
        }
    })

    const subtotalPotBersih = potBersihList.reduce((acc, curr) => acc + curr.value, 0)
    const totalPotongan = getNum('total_potongan')

    // Totals
    const jumlahUpahKotor = getNum('jumlah_upah_kotor')
    const upahBersih = getNum('upah_bersih')

    // --- CALENDAR DATA ---
    const daysOfWeek = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    const dateObj = new Date(year, month - 1, 1)
    const firstDayIndex = dateObj.getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const blanks = Array.from({ length: firstDayIndex }, (_, i) => i)
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    return (
        <div className="payslip-wrapper">
            {/* 1. PAYSLIP SHEET */}
            <div className="payslip-container">

                {/* HEADLINES */}
                <div className="payslip-header">
                    <div className="company-logo">
                        <img src="/images/rebinmas.webp" alt="Logo" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                    <div className="company-info">
                        <h2>PT REBINMAS JAYA</h2>
                        <h3>SLIP GAJI KARYAWAN <span style={{ fontSize: '0.8rem', color: '#999' }}>(Rev 2)</span></h3>
                        <p className="period">Periode: {getMonthName(month)} {year}</p>
                    </div>
                    <div className="payslip-id">
                        NO: {empCode}/{month}{year}
                    </div>
                </div>

                <hr className="dashed-line" />

                {/* EMPLOYEE INFO */}
                <div className="employee-info-grid">
                    <div className="info-row">
                        <span className="label">NIK</span>
                        <span className="separator">:</span>
                        <span className="value bold">{empCode}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">NAMA</span>
                        <span className="separator">:</span>
                        <span className="value bold">{empInfo.nama || empInfo.EmpName}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">JABATAN</span>
                        <span className="separator">:</span>
                        <span className="value">{empInfo.jabatan || '-'}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">UNIT/GANG</span>
                        <span className="separator">:</span>
                        <span className="value">{empInfo.gang_code || empInfo.GangCode} ({division})</span>
                    </div>
                    <div className="info-row">
                        <span className="label">STATUS</span>
                        <span className="separator">:</span>
                        <span className="value">{empInfo.status_karyawan || ''}</span>
                    </div>
                    <div className="info-row">
                        <span className="label">HK / RATE</span>
                        <span className="separator">:</span>
                        <span className="value">{hk} Hari / {formatCurrency(rate)}</span>
                    </div>
                </div>

                <hr className="dashed-line" />

                {/* CONTENT COLUMNS */}
                <div className="payslip-content">

                    {/* LEFT COLUMN: PENERIMAAN */}
                    <div className="content-column">
                        <h4 className="column-title">PENERIMAAN (EARNINGS)</h4>

                        <table className="details-table">
                            <tbody>
                                {/* Gaji Pokok */}
                                <tr>
                                    <td className="item-name">Gaji Pokok</td>
                                    <td className="item-amount">{formatCurrency(gajiPokok)}</td>
                                </tr>

                                {/* Tunjangan Group */}
                                {tunjanganList.length > 0 && (
                                    <>
                                        <tr className="group-header"><td colSpan="2">Tunjangan:</td></tr>
                                        {tunjanganList.map((item, idx) => (
                                            <tr key={`tunj-${idx}`}>
                                                <td className="item-name indent">- {item.label}</td>
                                                <td className="item-amount">{formatCurrency(item.value)}</td>
                                            </tr>
                                        ))}
                                    </>
                                )}

                                {/* Premi Group */}
                                {premiList.length > 0 && (
                                    <>
                                        <tr className="group-header"><td colSpan="2">Premi:</td></tr>
                                        {premiList.map((item, idx) => (
                                            <tr key={`prem-${idx}`}>
                                                <td className="item-name indent">- {item.label}</td>
                                                <td className="item-amount">{formatCurrency(item.value)}</td>
                                            </tr>
                                        ))}
                                    </>
                                )}

                                {/* Lembur */}
                                {lemburJumlah > 0 && (
                                    <tr>
                                        <td className="item-name">Lembur ({lemburJam} Jam)</td>
                                        <td className="item-amount">{formatCurrency(lemburJumlah)}</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="subtotal-row">
                                    <td>TOTAL KOTOR</td>
                                    <td>{formatCurrency(jumlahUpahKotor)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* VERTICAL DIVIDER */}
                    <div className="vertical-line"></div>

                    {/* RIGHT COLUMN: POTONGAN */}
                    <div className="content-column">
                        <h4 className="column-title">POTONGAN (DEDUCTIONS)</h4>

                        <table className="details-table">
                            <tbody>
                                {/* Potongan Kotor (Koreksi) */}
                                {potKotorList.length > 0 && (
                                    <>
                                        <tr className="group-header"><td colSpan="2">Potongan Upah Kotor:</td></tr>
                                        {potKotorList.map((item, idx) => (
                                            <tr key={`pot-kotor-${idx}`}>
                                                <td className="item-name indent">- {item.label}</td>
                                                <td className="item-amount red-text">{formatCurrency(item.value)}</td>
                                            </tr>
                                        ))}
                                        <tr className="sub-subtotal-row">
                                            <td className="indent"><i>Subtotal Pot. Kotor</i></td>
                                            <td className="red-text"><i>{formatCurrency(totalPotKotor)}</i></td>
                                        </tr>
                                    </>
                                )}

                                {/* Potongan Bersih */}
                                {potBersihList.length > 0 && (
                                    <>
                                        <tr className="group-header"><td colSpan="2">Potongan Upah Bersih:</td></tr>
                                        {potBersihList.map((item, idx) => (
                                            <tr key={`pot-bersih-${idx}`}>
                                                <td className="item-name indent">- {item.label}</td>
                                                <td className="item-amount red-text">{formatCurrency(item.value)}</td>
                                            </tr>
                                        ))}
                                        <tr className="sub-subtotal-row">
                                            <td className="indent"><i>Subtotal Pot. Bersih</i></td>
                                            <td className="red-text"><i>{formatCurrency(subtotalPotBersih)}</i></td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="subtotal-row">
                                    <td>TOTAL POTONGAN</td>
                                    <td className="red-text">{formatCurrency(totalPotongan)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <hr className="dashed-line" />

                {/* TAKE HOME PAY */}
                <div className="thp-section">
                    <div className="thp-label">PENERIMAAN BERSIH (TAKE HOME PAY)</div>
                    <div className="thp-amount">Rp {formatCurrency(upahBersih)}</div>
                    <div className="thp-terbilang">
                        {/* Placeholder for 'Terbilang' logic if needed later */}
                        Ref: {empCode} / {division}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="payslip-footer">
                    <div className="signatures">
                        <div className="sig-box">
                            <p>Dibuat Oleh,</p>
                            <br /><br /><br />
                            <p>( Estate Clerk )</p>
                        </div>
                        <div className="sig-box">
                            <p>Diperiksa Oleh,</p>
                            <br /><br /><br />
                            <p>( Assistant )</p>
                        </div>
                        <div className="sig-box">
                            <p>Disetujui Oleh,</p>
                            <br /><br /><br />
                            <p>( Estate Manager )</p>
                        </div>
                        <div className="sig-box">
                            <p>Diterima Oleh,</p>
                            <br /><br /><br />
                            <p>( {empInfo.nama || 'Karyawan'} )</p>
                        </div>
                    </div>
                    <div className="timestamp">
                        Dicetak pada: {new Date().toLocaleString('id-ID')}
                    </div>
                </div>

            </div>

            {/* 2. ATTENDANCE & OVERTIME MATRICES (Below Payslip) */}
            <div className="matrix-sections-container">

                {/* Attendance Matrix */}
                <div className="matrix-card">
                    <div className="matrix-header gradient-header-blue">
                        <h3>📅 Matriks Kehadiran</h3>
                        <div className="legend">
                            {[
                                { key: 'hadir', label: 'Hadir' },
                                { key: 'alpa', label: 'Alpa' },
                                { key: 'sakit', label: 'Sakit' },
                                { key: 'cuti', label: 'Cuti' },
                                { key: 'minggu', label: 'Minggu' },
                                { key: 'libur', label: 'Libur' },
                                { key: 'libur_keagamaan', label: 'Libur Kemenag' }
                            ].map(({ key, label }) => (
                                <span key={key} className="legend-item">
                                    <span className="legend-dot" style={{ background: statusColors[key]?.bg || '#e5e7eb' }}>{statusColors[key]?.label || '-'}</span>
                                    <span>{label}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="calendar-matrix-container">
                        <div className="calendar-matrix">
                            {daysOfWeek.map(day => <div key={`header-${day}`} className="calendar-day-header">{day}</div>)}
                            {blanks.map(blank => <div key={`blank-${blank}`} className="calendar-cell empty"></div>)}
                            {days.map(day => {
                                const dayData = attendance.matrix?.[day] || { status: 'no_data' }
                                const statusStyle = statusColors[dayData.status] || statusColors.no_data

                                const dateObj = new Date(year, month - 1, day)
                                const isFriday = dateObj.getDay() === 5
                                const hours = dayData.hours || 0
                                const isShort = hours > 0 && ((isFriday && hours < 5) || (!isFriday && hours < 7))

                                return (
                                    <div
                                        key={`cell-${day}`}
                                        className="calendar-cell"
                                        style={{
                                            background: isShort ? '#fee2e2' : statusStyle.bg,
                                            color: isShort ? '#b91c1c' : statusStyle.text,
                                            border: isShort ? '1px solid #ef4444' : '1px solid #e5e7eb'
                                        }}
                                        title={`Tanggal ${day}: ${dayData.status}${dayData.remarks ? ` - ${dayData.remarks}` : ''} (${hours} Jam)${isShort ? ' - Warning: Jam Kerja Kurang' : ''}`}
                                    >
                                        <div className="calendar-date">{day}</div>
                                        <div className="calendar-status">{statusStyle.label}</div>
                                        {hours > 0 && (
                                            <div style={{ fontSize: '0.6rem', marginTop: '1px', fontWeight: 'bold' }}>
                                                {hours} Jam {isShort && '⚠️'}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    {/* Attendance Summary */}
                    <div className="attendance-summary">
                        <div className="summary-item success">
                            <span className="summary-value">{attendance.summary?.total_hadir || 0}</span>
                            <span className="summary-label">Hadir</span>
                        </div>
                        <div className="summary-item warning">
                            <span className="summary-value">{attendance.summary?.cuti_tahunan || 0}</span>
                            <span className="summary-label">Cuti</span>
                        </div>
                        <div className="summary-item info">
                            <span className="summary-value">{attendance.summary?.cuti_sakit || 0}</span>
                            <span className="summary-label">Sakit</span>
                        </div>
                        <div className="summary-item danger">
                            <span className="summary-value">{attendance.summary?.alpa || 0}</span>
                            <span className="summary-label">Alpa</span>
                        </div>
                    </div>
                </div>

                {/* Overtime Matrix */}
                <div className="matrix-card">
                    <div className="matrix-header gradient-header-purple">
                        <h3>⏰ Matriks Lembur</h3>
                        <div className="overtime-total">
                            Total: <strong>{overtime.summary?.total_hours || 0}</strong> jam = <strong>RP {formatCurrency(overtime.list?.reduce((acc, curr) => acc + (curr.amount_formula || 0), 0) || 0)}</strong>
                        </div>
                    </div>
                    <div className="calendar-matrix-container">
                        <div className="calendar-matrix overtime-matrix">
                            {daysOfWeek.map(day => <div key={`ot-header-${day}`} className="calendar-day-header">{day}</div>)}
                            {blanks.map(blank => <div key={`ot-blank-${blank}`} className="calendar-cell empty"></div>)}
                            {days.map(day => {
                                const dayData = overtime.matrix?.[day] || { has_overtime: false, hours: 0 }
                                return (
                                    <div
                                        key={`ot-cell-${day}`}
                                        className={`calendar-cell overtime-cell ${dayData.has_overtime ? 'has-overtime' : ''}`}
                                        title={dayData.has_overtime ? `Tanggal ${day}: ${dayData.hours} jam` : `Tanggal ${day}: Tidak ada lembur`}
                                    >
                                        <div className="calendar-date">{day}</div>
                                        {dayData.has_overtime && (
                                            <div className="calendar-status">{dayData.hours} Jam</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Overtime List Detail - Per Transaksi */}
                    {overtime.list && overtime.list.length > 0 && (
                        <div className="overtime-list">
                            <h4>📋 Rincian Lembur Per Transaksi</h4>

                            {/* Summary Table */}
                            <div className="overtime-summary-box">
                                <table className="overtime-summary-table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Hari</th>
                                            <th>Tipe Hari</th>
                                            <th>Pekerjaan</th>
                                            <th>Jam</th>
                                            <th>Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overtime.list
                                            .sort((a, b) => {
                                                // Sort by date
                                                const dateA = a.date || a.trx_date || '';
                                                const dateB = b.date || b.trx_date || '';
                                                return dateA.localeCompare(dateB);
                                            })
                                            .map((trx, idx) => {
                                                const date = trx.date || trx.trx_date || '';
                                                const dayName = trx.day_name || trx.hari || '-';
                                                const dayType = trx.day_type || trx.tipe_hari || '-';
                                                const rawDayType = trx.raw_day_type || null;
                                                const taskDesc = trx.task_desc || trx.task_code || 'Lain-lain';
                                                const hours = trx.hours || 0;
                                                const amount = trx.amount_formula || trx.amount || 0;

                                                // Format date DD/MM/YYYY
                                                const formattedDate = date ? new Date(date).toLocaleDateString('id-ID', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                }) : '-';

                                                return (
                                                    <tr key={idx}>
                                                        <td>{formattedDate}</td>
                                                        <td>{dayName}</td>
                                                        <td>
                                                            <span className={`day-type-badge ${getDayTypeClass(dayType, rawDayType)}`}>
                                                                {formatDayType(dayType, rawDayType)}
                                                            </span>
                                                        </td>
                                                        <td>{taskDesc}</td>
                                                        <td className="hours-cell">{hours}</td>
                                                        <td className="amount-cell">{formatCurrency(amount)}</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Total Summary */}
                            <div className="overtime-total-summary">
                                <div className="summary-row">
                                    <span>Total Transaksi:</span>
                                    <strong>{overtime.list.length}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Total Jam:</span>
                                    <strong>{overtime.list.reduce((sum, t) => sum + (t.hours || 0), 0)}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Total Lembur:</span>
                                    <strong>{formatCurrency(overtime.list.reduce((sum, t) => sum + (t.amount_formula || t.amount || 0), 0))}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ACTION BUTTONS (No Print) */}
            <div className="action-buttons no-print">
                <button onClick={onBack} className="btn btn-secondary">Tutup / Kembali</button>
                <button onClick={() => window.print()} className="btn btn-primary">🖨️ Cetak Slip Gaji</button>
                {/* Harvest Matrix (Only if data exists) */}
                {harvest && harvest.length > 0 && (
                    <div className="matrix-card">
                        <div className="matrix-header gradient-header-orange">
                            <h3>🌴 Matriks Panen</h3>
                            <div className="overtime-total">
                                Total: <strong>{formatCurrency(harvest.reduce((sum, h) => sum + (h.TotalWeight || 0), 0))}</strong> Kg / <strong>{formatCurrency(harvest.reduce((sum, h) => sum + (h.TotalBunches || 0), 0))}</strong> Jjg
                            </div>
                        </div>

                        <div className="overtime-list">
                            <div className="overtime-summary-box">
                                <table className="overtime-summary-table">
                                    <thead>
                                        <tr>
                                            <th>Tanggal</th>
                                            <th>Gang</th>
                                            <th>Lokasi</th>
                                            <th style={{ textAlign: 'right' }}>Berat (Kg)</th>
                                            <th style={{ textAlign: 'right' }}>Janjang</th>
                                            <th style={{ textAlign: 'right' }}>Upah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {harvest.map((h, idx) => (
                                            <tr key={idx}>
                                                <td>{new Date(h.TrxDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                                <td>{h.GrpRef || '-'}</td>
                                                <td>{h.ChargeTo || '-'}</td>
                                                <td style={{ textAlign: 'right', fontWeight: h.TotalWeight > 0 ? 'bold' : 'normal' }}>
                                                    {formatCurrency(h.TotalWeight)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(h.TotalBunches)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(h.Amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
                                            <td colSpan="3">Total</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(harvest.reduce((sum, h) => sum + (h.TotalWeight || 0), 0))}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(harvest.reduce((sum, h) => sum + (h.TotalBunches || 0), 0))}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(harvest.reduce((sum, h) => sum + (h.Amount || 0), 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
