import React, { useState } from 'react';
import '../styles/payslip-print.css';

// Helper to format currency
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0'
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

// Helper to get month name in Indonesian
const getMonthName = (month) => {
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return months[month] || ''
}

const formatIncomeKeyLabel = (key) => {
    return key
        .replace(/^pendapatan_/, '')
        .replace(/_/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

const isPositiveAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * PayslipCard - Compact payslip component for printing (4 per A4)
 * @param {Object} props
 * @param {Object} props.data - Employee checkroll data
 * @param {number} props.month - Month number
 * @param {number} props.year - Year
 */
export default function PayslipCard({ data, month, year }) {
    const [showAddress, setShowAddress] = useState(false);

    if (!data || !data.payroll_data) {
        return (
            <div className="payslip-card">
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    Data Gaji Tidak Ditemukan ({data?.emp_code || 'N/A'})
                </div>
            </div>
        );
    }

    const { emp_code, employee, payroll_data, attendance } = data;

    // Get data from payroll_data or employee
    const empInfo = employee || {};
    const payroll = payroll_data || {};
    const att = attendance || {};

    // Helper to safely get numeric values
    const getNum = (key) => {
        const val = payroll[key] ?? empInfo[key]
        return typeof val === 'number' ? val : 0
    }

    // --- CALCULATIONS ---
    const hk = getNum('jumlah_hk') || getNum('hari_kerja')
    const rate = getNum('upah_dasar') || getNum('upah_harian')
    const gajiPokok = getNum('gaji_pokok') || getNum('upah_pokok') || (hk * rate)

    // Handle both nested attendance object and flat structure from API
    const attHadir = att.summary?.total_hadir ?? getNum('hari_kerja') ?? getNum('kehadiran') ?? 0;
    const attMgg = att.summary?.cuti_minggu ?? getNum('cuti_minggu_hari') ?? 0;
    const attCuti = att.summary?.cuti_tahunan ?? getNum('cuti_tahunan_hari') ?? 0;
    const attSakit = att.summary?.cuti_sakit ?? getNum('cuti_sakit_haid_hari') ?? 0;
    const attLibur = att.summary?.libur ?? getNum('cuti_nasional_hari') ?? 0;
    const attAlpa = att.summary?.alpa ?? getNum('alpa') ?? 0;

    // --- GAJI POKOK BREAKDOWN ---
    // User requested to show days x rate for each type
    const gpBreakdown = [
        { label: 'Kehadiran', days: attHadir, amount: attHadir * rate },
        { label: 'Minggu', days: attMgg, amount: attMgg * rate },
        { label: 'Cuti', days: attCuti, amount: attCuti * rate },
        { label: 'Sakit', days: attSakit, amount: attSakit * rate },
        { label: 'Libur Nas', days: attLibur, amount: attLibur * rate },
    ].filter(item => item.days > 0);

    // Tunjangan Breakdown
    const tunjanganList = [
        { label: 'Beras', value: getNum('beras_jumlah') || getNum('tunjangan_beras') },
        { label: 'Jabatan', value: getNum('jabatan_jumlah') || getNum('tunjangan_jabatan') },
        { label: 'Masa Kerja', value: getNum('masa_kerja_jumlah') || getNum('tunjangan_masa_kerja') },
    ].filter(item => item.value > 0)

    // Premi Breakdown
    const premiList = []
    if (getNum('premi_brondol') > 0) premiList.push({ label: 'Brondol', value: getNum('premi_brondol') })

    // Dynamic premiums from premi object (API format)
    if (payroll.premi && typeof payroll.premi === 'object') {
        Object.entries(payroll.premi).forEach(([key, val]) => {
            if (key !== 'brondol' && key !== 'koreksi' && val > 0) {
                const label = key.replace(/premi_/i, '').replace(/_/g, ' ').toUpperCase()
                premiList.push({ label, value: val })
            }
        })
    } else {
        // Fallback: Handle flat premi_* fields from UI data
        Object.entries(payroll).forEach(([key, val]) => {
            if (key.startsWith('premi_') && key !== 'premi_brondol' && key !== 'premi_pph' && typeof val === 'number' && val > 0) {
                const label = key.replace('premi_', '').replace(/_/g, ' ').toUpperCase()
                premiList.push({ label, value: val })
            }
        })
    }

    const totalPremi = getNum('total_premi')
    const lemburJam = getNum('lembur_jam') || getNum('total_jam_lembur')
    const lemburJumlah = getNum('lembur_jumlah') || getNum('total_upah_lembur') || getNum('upah_lembur')

    // Potongan koreksi tetap dihitung di total, tetapi detailnya tidak dicetak agar tidak dobel.
    const dynamicKoreksiTotal = Object.entries(payroll).reduce((sum, [key, val]) => {
        if (!key.startsWith('koreksi_') || key === 'koreksi_hk') return sum
        return sum + (typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : 0)
    }, 0)
    const totalPotKotor = getNum('potongan_upah_kotor_total') || getNum('pot_koreksi') || dynamicKoreksiTotal

    // Potongan Upah Bersih
    const potBersihList = [
        { label: 'BPJS Kes (1%)', value: getNum('pot_bpjs_kesehatan_pekerja') || getNum('pot_bpjs_kesehatan') },
        { label: 'BPJS Pens (1%)', value: getNum('pot_bpjs_pensiun_pekerja') || getNum('pot_bpjs_pensiun') },
        { label: 'Astek (2%)', value: getNum('pot_astek') || getNum('pot_astek_jumlah') || getNum('pot_jht') },
        { label: 'SPSI', value: getNum('pot_spsi') },
        { label: 'PPh 21', value: getNum('pot_pph21') || getNum('pph21_ter') },
        { label: 'Potongan PPh21', value: getNum('POTONGAN_PPH21') },
    ].filter(item => item.value > 0)

    // Dynamic deductions from 'potongan_' fields in payroll record
    Object.entries(payroll).forEach(([key, val]) => {
        if (key.startsWith('potongan_') && typeof val === 'number' && val > 0) {
            const label = key.replace('potongan_', '').replace(/_/g, ' ').toUpperCase()
            // Avoid duplicates with hardcoded list
            const isDuplicate = ['PPJK', 'BPJS', 'ASTEK', 'SPSI', 'PPH21'].some(k => label.includes(k))
            if (!isDuplicate && !potBersihList.some(p => p.label.toUpperCase() === label)) {
                potBersihList.push({ label, value: val })
            }
        }
    })

    const premiPph = getNum('premi_pph') || getNum('PREMI_PPH');
    if (premiPph > 0) {
        potBersihList.push({ label: 'Premi PPh (+)', value: premiPph, isCredit: true })
    }

    // --- THR & OTHER INCOMES ---
    const otherIncomeItems = []
    const otherIncomeSeen = new Set()
    const pushOtherIncome = (label, amount, type = null) => {
        const value = Number(amount) || 0
        if (value <= 0) return
        const cleanLabel = String(label || type || 'Pendapatan Lainnya').trim()
        const cleanType = type ? String(type).trim().toUpperCase() : ''
        const key = `${cleanType}:${cleanLabel}`.toLowerCase()
        if (otherIncomeSeen.has(key)) return
        otherIncomeSeen.add(key)
        otherIncomeItems.push({ name: cleanLabel, amount: value, type: cleanType })
    }

    pushOtherIncome('THR', getNum('thr_jumlah') || getNum('pendapatan_thr'), 'THR')
    pushOtherIncome('Bonus', getNum('bonus_jumlah') || getNum('pendapatan_bonus'), 'BONUS')
    pushOtherIncome('Custom', getNum('pendapatan_custom'), 'CUSTOM')
    pushOtherIncome('Pendapatan Tidak Tetap', getNum('pendapatan_tidak_tetap'), 'CUSTOM')

    if (Array.isArray(payroll.other_incomes)) {
        payroll.other_incomes.forEach((income) => {
            const type = String(income?.type || '').trim().toUpperCase()
            const label = income?.name || income?.income_name || type || 'Pendapatan Lainnya'
            pushOtherIncome(label, income?.amount, type || null)
        })
    }

    const excludedOtherIncomeKeys = new Set([
        'pendapatan_thr',
        'pendapatan_bonus',
        'pendapatan_custom',
        'pendapatan_tidak_tetap',
        'pendapatan_lainnya',
        'total_pendapatan_lainnya',
    ])

    Object.entries(payroll).forEach(([key, val]) => {
        if (!key.startsWith('pendapatan_') || excludedOtherIncomeKeys.has(key)) return
        if (!isPositiveAmount(val)) return
        const label = formatIncomeKeyLabel(key)
        pushOtherIncome(label, val, label.toUpperCase())
    })

    const totalOtherIncome = getNum('total_pendapatan_lainnya') || getNum('pendapatan_lainnya') || otherIncomeItems.reduce((sum, item) => sum + item.amount, 0)
    const detailedOtherIncomeTotal = otherIncomeItems.reduce((sum, item) => sum + item.amount, 0)

    if (otherIncomeItems.length === 0 && totalOtherIncome > 0) {
        pushOtherIncome('Pendapatan Lainnya', totalOtherIncome, null)
    } else if (totalOtherIncome > detailedOtherIncomeTotal) {
        pushOtherIncome('Lainnya', totalOtherIncome - detailedOtherIncomeTotal, null)
    }

    const thrList = otherIncomeItems.filter((item) => item.type === 'THR' || item.name.toUpperCase().includes('THR'))
    const otherIncomeDeductionTotal = otherIncomeItems.reduce((sum, item) => sum + item.amount, 0)

    // Total Kotor includes Gross regular + THR/Bonus
    const totalPotongan = getNum('total_potongan_bersih') || getNum('total_potongan') || (totalPotKotor + potBersihList.reduce((acc, curr) => acc + (curr.isCredit ? -curr.value : curr.value), 0) + otherIncomeDeductionTotal + premiPph);
    const jumlahUpahKotor = getNum('jumlah_upah_kotor') || getNum('penghasilan_bruto')
    // upahBersih should be Gross - Total Potongan Bersih
    const upahBersih = getNum('upah_bersih') || (jumlahUpahKotor - totalPotongan)

    return (
        <div className="payslip-card">
            {/* Watermark */}
            <div className="payslip-watermark" aria-hidden="true">
                {Array.from({ length: 12 }, (_, idx) => (
                    <span key={idx} className="payslip-watermark__tile">REBINMAS JAYA</span>
                ))}
            </div>

            {/* Header */}
            <div className="payslip-card-header">
                <div className="payslip-card-company">
                    <strong>PT REBINMAS JAYA</strong>
                </div>
                <div className="payslip-card-title">SLIP GAJI KARYAWAN</div>
                <div className="payslip-card-period">
                    Periode: {getMonthName(month)} {year}
                </div>
            </div>

            {/* Employee Info - 2 Columns to save space */}
            <div className="payslip-card-info">
                <div className="payslip-info-row">
                    <span className="payslip-info-label">NIK/Nama</span>
                    <span className="payslip-info-value">: {emp_code} - {empInfo.nama || empInfo.EmpName || '-'}</span>
                </div>
                <div className="payslip-info-row">
                    <span className="payslip-info-label">Jabatan</span>
                    <span className="payslip-info-value">: {empInfo.jabatan || '-'}</span>
                </div>
                <div className="payslip-info-row">
                    <span className="payslip-info-label">Gang</span>
                    <span className="payslip-info-value">: {empInfo.gang_code || empInfo.GangCode || '-'}</span>
                </div>
                <div className="payslip-info-row">
                    <span className="payslip-info-label">Absensi</span>
                    <span className="payslip-info-value">: H:{attHadir} M:{attMgg} L:{attLibur} C:{attCuti} S:{attSakit}</span>
                </div>
                <div className="payslip-info-row">
                    <span className="payslip-info-label">HK/Rate</span>
                    <span className="payslip-info-value">: {hk} / {formatCurrency(rate)}</span>
                </div>
                <div className="payslip-info-row">
                    <span className="payslip-info-label">PTKP</span>
                    <span className="payslip-info-value">: {payroll.status_ptkp || '-'} ({payroll.kategori_ter || '-'})</span>
                </div>
                {/* Alamat - collapsible, hidden by default */}
                {empInfo.alamat && empInfo.alamat.trim() && (
                    <>
                        <div
                            className="payslip-info-row payslip-address-toggle"
                            onClick={() => setShowAddress(!showAddress)}
                            style={{ cursor: 'pointer' }}
                            title={showAddress ? 'Klik untuk sembunyikan alamat' : 'Klik untuk tampilkan alamat'}
                        >
                            <span className="payslip-info-label">Alamat</span>
                            <span className="payslip-info-value payslip-address-toggle-icon">
                                : {showAddress ? '▲ Tampilkan' : '▼ Tampilkan'}
                            </span>
                        </div>
                        {showAddress && (
                            <div className="payslip-info-row payslip-address-row">
                                <span className="payslip-info-label"></span>
                                <span className="payslip-info-value payslip-address-text">
                                    {empInfo.alamat}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Content - Two Columns */}
            <div className="payslip-card-content">
                {/* Left: Penerimaan */}
                <div className="payslip-card-column">
                    <div className="payslip-column-header">PENERIMAAN (Income)</div>

                    <div className="payslip-subheader">Gaji Pokok:</div>
                    {gpBreakdown.map((item, idx) => (
                        <div key={`gp-${idx}`} className="payslip-item payslip-item-indent">
                            <span className="payslip-item-label">- {item.label} ({item.days} hr)</span>
                            <span className="payslip-item-value">{formatCurrency(item.amount)}</span>
                        </div>
                    ))}
                    <div className="payslip-item" style={{ borderTop: '0.5px solid #ccc', marginTop: '1px' }}>
                        <span className="payslip-item-label" style={{ fontWeight: 'bold', paddingLeft: '2mm' }}>Subtotal Gaji Pokok</span>
                        <span className="payslip-item-value" style={{ fontWeight: 'bold' }}>{formatCurrency(gajiPokok)}</span>
                    </div>

                    {tunjanganList.length > 0 && (
                        <>
                            <div className="payslip-subheader">Tunjangan:</div>
                            {tunjanganList.map((item, idx) => (
                                <div key={`tunj-${idx}`} className="payslip-item payslip-item-indent">
                                    <span className="payslip-item-label">- {item.label}</span>
                                    <span className="payslip-item-value">{formatCurrency(item.value)}</span>
                                </div>
                            ))}
                        </>
                    )}

                    {premiList.length > 0 && (
                        <>
                            <div className="payslip-subheader">Premi:</div>
                            {premiList.map((item, idx) => (
                                <div key={`premi-${idx}`} className="payslip-item payslip-item-indent">
                                    <span className="payslip-item-label">- {item.label}</span>
                                    <span className="payslip-item-value">{formatCurrency(item.value)}</span>
                                </div>
                            ))}
                        </>
                    )}

                    {lemburJumlah > 0 && (
                        <div className="payslip-item">
                            <span className="payslip-item-label" style={{ fontWeight: 'bold' }}>Lembur ({lemburJam}j)</span>
                            <span className="payslip-item-value">{formatCurrency(lemburJumlah)}</span>
                        </div>
                    )}

                    {otherIncomeItems.length > 0 && (
                        <>
                            <div className="payslip-subheader">Pendapatan Lainnya:</div>
                            {otherIncomeItems.map((item, idx) => (
                                <div key={`other-income-${idx}`} className="payslip-item payslip-item-indent">
                                    <span className="payslip-item-label">- {item.name}</span>
                                    <span className="payslip-item-value">{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                        </>
                    )}

                    <div className="total-line-wrapper">
                        <div className="payslip-total-line">
                            <span className="payslip-item-label">TOTAL PENDAPATAN KOTOR</span>
                            <span className="payslip-item-value">{formatCurrency(jumlahUpahKotor)}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Potongan */}
                <div className="payslip-card-column">
                    <div className="payslip-column-header">POTONGAN (Deduction)</div>

                    {potBersihList.length > 0 && (
                        <>
                            <div className="payslip-subheader">Pot. Upah Bersih:</div>
                            {potBersihList.map((item, idx) => {
                                const isTax = item.label.toLowerCase().includes('pph 21');
                                return (
                                    <React.Fragment key={`potb-${idx}`}>
                                        <div className="payslip-item payslip-item-indent">
                                            <span className="payslip-item-label">{item.isCredit ? '+' : '-'} {item.label}</span>
                                            <span
                                                className={`payslip-item-value ${item.isCredit ? '' : 'payslip-negative'}`}
                                                style={{ fontWeight: item.isCredit ? 'bold' : undefined }}
                                            >
                                                {formatCurrency(item.value)}
                                            </span>
                                        </div>
                                        {/* Display Tax Calculation Breakdown below the PPh21 row */}
                                        {isTax && (payroll.tarif_pajak_ter > 0 || payroll.pph21_ter > 0) && (
                                            <div className="payslip-tax-breakdown">
                                                <div style={{ borderBottom: '0.5px dashed #ccc', margin: '1mm 0', paddingBottom: '0.5mm', fontWeight: 'bold' }}>
                                                    Detail Kalkulasi PPh21 (TER):
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Bruto (DPP):</span>
                                                    <span>Rp{formatCurrency(payroll.penghasilan_bruto)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Tarif {payroll.kategori_ter || 'TER'} ({payroll.status_ptkp}):</span>
                                                    <span>{Number(payroll.tarif_pajak_ter).toFixed(2)}%</span>
                                                </div>
                                                <div style={{ borderTop: '0.5px solid #666', marginTop: '0.5mm', paddingTop: '0.5mm', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                                    <span>Pajak Terhutang:</span>
                                                    <span>Rp{formatCurrency(payroll.pph21_ter)}</span>
                                                </div>
                                                <div style={{ fontSize: '7px', fontStyle: 'italic', color: '#666', marginTop: '0.5mm' }}>
                                                    * Rumus: Bruto x Tarif Efektif Rata-rata
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </>
                    )}

                    {otherIncomeItems.length > 0 && (
                        <>
                            <div className="payslip-subheader">Pendapatan Lainnya Dibayar:</div>
                            {otherIncomeItems.map((item, idx) => (
                                <div key={`other-income-deduction-${idx}`} className="payslip-item payslip-item-indent">
                                    <span className="payslip-item-label">- {item.name}</span>
                                    <span className="payslip-item-value payslip-negative">{formatCurrency(item.amount)}</span>
                                </div>
                            ))}
                            <div className="payslip-income-deduction-note">
                                <strong>Sudah dibayarkan.</strong> Pendapatan lainnya ditambahkan ke Upah Kotor sebagai dasar perhitungan, lalu dikurangkan dari Upah Bersih karena sudah dibayarkan sebelumnya.
                            </div>
                        </>
                    )}

                    <div className="total-line-wrapper">
                        <div className="payslip-total-line">
                            <span className="payslip-item-label">TOTAL POTONGAN</span>
                            <span className="payslip-item-value payslip-negative">{formatCurrency(totalPotongan)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* THR Note Section - Only show if there is THR or in March */}
            {(thrList.length > 0 || month === 3) && (
                <div className="payslip-note-section">
                    <div className="payslip-note-text">
                        <strong>Keterangan:</strong> THR yang dibayarkan bulan lalu belum dipotong pajak. 
                        Sesuai peraturan perpajakan, pemotongan pajak atas THR dilakukan pada penggajian bulan berjalan ini 
                        (digabungkan dengan penghasilan rutin).
                    </div>
                </div>
            )}

            {/* Footer - Take Home Pay */}
            <div className="payslip-card-footer">
                <div className="payslip-thp-label">PENERIMAAN BERSIH (Take Home Pay)</div>
                <div className="payslip-thp-value">Rp {formatCurrency(upahBersih)}</div>
            </div>

            {/* Signature Section */}
            <div className="payslip-card-signature">
                <div className="payslip-sig-box">
                    <div className="payslip-sig-label">Dibuat Oleh,</div>
                    <div className="payslip-sig-line"></div>
                    <div className="payslip-sig-name">Admin Payroll</div>
                </div>
                <div className="payslip-sig-box">
                    <div className="payslip-sig-label">Diterima Oleh,</div>
                    <div className="payslip-sig-line"></div>
                    <div className="payslip-sig-name">{empInfo.nama || empInfo.EmpName || '-'}</div>
                </div>
            </div>
        </div>
    );
}
