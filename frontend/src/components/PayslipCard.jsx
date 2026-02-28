import React from 'react';
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

/**
 * PayslipCard - Compact payslip component for printing (4 per A4)
 * @param {Object} props
 * @param {Object} props.data - Employee checkroll data
 * @param {number} props.month - Month number
 * @param {number} props.year - Year
 */
export default function PayslipCard({ data, month, year }) {
    if (!data) return null;

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
    const hkKoreksi = getNum('koreksi_hk') || 0
    const rate = getNum('upah_dasar') || getNum('upah_harian')
    const gajiPokok = getNum('gaji_pokok') || getNum('upah_pokok') || (hk * rate)

    // Handle both nested attendance object and flat structure from API
    // JSON keys: hari_kerja, cuti_minggu_hari, cuti_tahunan_hari, cuti_sakit_haid_hari
    // These keys are likely in payroll_data (payroll) or employee (empInfo) if not in attendance object
    // Attendance service returns { summary: { total_hadir, cuti_minggu, ... } }

    const attHadir = att.summary?.total_hadir ?? getNum('hari_kerja') ?? getNum('kehadiran') ?? 0;
    const attMgg = att.summary?.cuti_minggu ?? getNum('cuti_minggu_hari') ?? 0;
    const attCuti = att.summary?.cuti_tahunan ?? getNum('cuti_tahunan_hari') ?? 0;
    const attSakit = att.summary?.cuti_sakit ?? getNum('cuti_sakit_haid_hari') ?? 0;
    const attLibur = att.summary?.libur ?? getNum('cuti_nasional_hari') ?? 0;
    const attAlpa = att.summary?.alpa ?? getNum('alpa') ?? 0;

    // Tunjangan Breakdown
    const tunjanganList = [
        { label: 'Beras', value: getNum('beras_jumlah') },
        { label: 'Jabatan', value: getNum('jabatan_jumlah') },
        { label: 'Masa Kerja', value: getNum('masa_kerja_jumlah') },
    ].filter(item => item.value > 0)

    // Premi Breakdown
    const premiList = []
    if (getNum('premi_brondol') > 0) premiList.push({ label: 'Brondol', value: getNum('premi_brondol') })

    // Dynamic premiums from premi object
    if (payroll.premi && typeof payroll.premi === 'object') {
        Object.entries(payroll.premi).forEach(([key, val]) => {
            if (key !== 'brondol' && key !== 'koreksi' && val > 0) {
                const label = key.replace(/premi_/i, '').replace(/_/g, ' ').toUpperCase()
                premiList.push({ label, value: val })
            }
        })
    }

    const totalPremi = getNum('total_premi')
    const lemburJam = getNum('lembur_jam')
    const lemburJumlah = getNum('lembur_jumlah')

    // Potongan Upah Kotor
    const potKotorList = []
    if (getNum('pot_koreksi') > 0) potKotorList.push({ label: 'Koreksi', value: getNum('pot_koreksi') })

    // Check for other koreksi variations (Restored for consistency)
    Object.entries(payroll).forEach(([key, val]) => {
        if (key.startsWith('koreksi_') && typeof val === 'number' && val > 0 && key !== 'koreksi_hk') {
            const label = key.replace('koreksi_', '').replace(/_/g, ' ').toUpperCase()
            // Avoid duplicates if pot_koreksi covers it (usually distinct keys in this system)
            if (!potKotorList.some(p => p.label === `KOREKSI ${label}`)) {
                potKotorList.push({ label: `Koreksi ${label}`, value: val })
            }
        }
    })

    const totalPotKotor = potKotorList.reduce((acc, curr) => acc + curr.value, 0)

    // Potongan Upah Bersih
    const potBersihList = [
        { label: 'BPJS Kes', value: getNum('pot_bpjs_kesehatan_pekerja') },
        { label: 'BPJS Pens', value: getNum('pot_bpjs_pensiun_pekerja') },
        { label: 'Astek', value: getNum('pot_astek') || getNum('pot_astek_jumlah') },
        { label: 'SPSI', value: getNum('pot_spsi') },
        { label: 'PPh 21', value: getNum('pot_pph21') },
    ].filter(item => item.value > 0)

    const premiPph = getNum('premi_pph') || getNum('PREMI_PPH');
    if (premiPph > 0) {
        potBersihList.push({ label: 'Premi PPh (+)', value: premiPph, isCredit: true })
    }

    const totalPotongan = getNum('total_potongan_bersih') || (getNum('total_potongan') - premiPph);
    const jumlahUpahKotor = getNum('jumlah_upah_kotor')
    // upahBersih should be Gross - Total Potongan Bersih
    const upahBersih = getNum('upah_bersih') || (jumlahUpahKotor - totalPotongan)

    return (
        <div className="payslip-card">
            {/* Header */}
            <div className="payslip-card-header">
                <div className="payslip-card-company">
                    <strong>PT REBINMAS JAYA</strong>
                </div>
                <div className="payslip-card-title">SLIP GAJI</div>
                <div className="payslip-card-period">
                    {getMonthName(month)} {year}
                </div>
            </div>

            {/* Employee Info */}
            <div className="payslip-card-info">
                <div className="payslip-info-row">
                    <span className="payslip-info-label">NIK</span>
                    <span className="payslip-info-value">: {emp_code}</span>
                </div>
                <div className="payslip-info-row">
                    <span className="payslip-info-label">Nama</span>
                    <span className="payslip-info-value">: {empInfo.nama || empInfo.EmpName || '-'}</span>
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
                    <span className="payslip-info-value">: H:{attHadir} M:{attMgg} L:{attLibur} C:{attCuti} S:{attSakit} A:{attAlpa}</span>
                </div>

                <div className="payslip-info-row">
                    <span className="payslip-info-label">HK/Rate</span>
                    <span className="payslip-info-value">: {hk} / {formatCurrency(rate)}</span>
                </div>
                {hkKoreksi !== 0 && (
                    <div className="payslip-info-row">
                        <span className="payslip-info-label">HK Koreksi</span>
                        <span className="payslip-info-value" style={{ color: hkKoreksi < 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>
                            : {hkKoreksi > 0 ? '+' : ''}{hkKoreksi}
                        </span>
                    </div>
                )}
            </div>

            {/* Content - Two Columns */}
            <div className="payslip-card-content">
                {/* Left: Penerimaan */}
                <div className="payslip-card-column">
                    <div className="payslip-column-header">PENERIMAAN</div>

                    <div className="payslip-item">
                        <span className="payslip-item-label">Gaji Pokok</span>
                        <span className="payslip-item-value">{formatCurrency(gajiPokok)}</span>
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
                            <span className="payslip-item-label">Lembur ({lemburJam}j)</span>
                            <span className="payslip-item-value">{formatCurrency(lemburJumlah)}</span>
                        </div>
                    )}

                    <div className="payslip-total-line">
                        <span className="payslip-item-label">Total Kotor</span>
                        <span className="payslip-item-value">{formatCurrency(jumlahUpahKotor)}</span>
                    </div>
                </div>

                {/* Right: Potongan */}
                <div className="payslip-card-column">
                    <div className="payslip-column-header">POTONGAN</div>

                    {potKotorList.length > 0 && (
                        <>
                            <div className="payslip-subheader">Pot. Upah Kotor:</div>
                            {potKotorList.map((item, idx) => (
                                <div key={`potk-${idx}`} className="payslip-item payslip-item-indent">
                                    <span className="payslip-item-label">- {item.label}</span>
                                    <span className="payslip-item-value payslip-negative">{formatCurrency(item.value)}</span>
                                </div>
                            ))}
                        </>
                    )}

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
                                                style={item.isCredit ? { color: '#059669', fontWeight: 'bold' } : {}}
                                            >
                                                {formatCurrency(item.value)}
                                            </span>
                                        </div>
                                        {/* Display Tax Calculation Breakdown below the PPh21 row */}
                                        {isTax && (payroll.status_ptkp || payroll.tarif_pajak_ter > 0) && (
                                            <div className="payslip-item payslip-item-indent payslip-tax-breakdown" style={{ fontSize: '0.7em', color: '#666', marginTop: '-2px', fontStyle: 'italic' }}>
                                                <span className="payslip-item-label">
                                                    (Bruto: Rp{formatCurrency(payroll.penghasilan_bruto)} • PTKP: {payroll.status_ptkp || '-'} • TER: {payroll.tarif_pajak_ter || 0}%)
                                                </span>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </>
                    )}

                    <div className="payslip-total-line">
                        <span className="payslip-item-label">Total Potongan</span>
                        <span className="payslip-item-value payslip-negative">{formatCurrency(totalPotongan)}</span>
                    </div>
                </div>
            </div>

            {/* Footer - Take Home Pay */}
            <div className="payslip-card-footer">
                <div className="payslip-thp-label">PENERIMAAN BERSIH</div>
                <div className="payslip-thp-value">Rp {formatCurrency(upahBersih)}</div>
            </div>


        </div>
    );
}
