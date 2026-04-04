/**
 * GangAttendanceMatrix - Displays attendance matrix for all employees in a gang
 * Shows a grid with employee names as rows and days 1-31 as columns
 * Each cell is color-coded by attendance status
 * Also shows payroll summary (upah kotor, koreksi, upah bersih) per employee
 * 
 * Data sourced from extend_db_ptrj (history_gang_member + history_taskreg)
 * EmpCode is the primary key — NIK and bank account derived from it
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getGangAttendanceMatrix } from '../services/employeeDetailService'
import { fetchGangs } from '../services/gangService'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

// Status config: label, color, background
const STATUS_CONFIG = {
    H: { label: 'Hadir', color: '#15803d', bg: '#dcfce7', short: 'H' },
    C: { label: 'Cuti Tahunan', color: '#9333ea', bg: '#f3e8ff', short: 'C' },
    S: { label: 'Sakit', color: '#dc2626', bg: '#fef2f2', short: 'S' },
    M: { label: 'Minggu', color: '#6b7280', bg: '#f3f4f6', short: 'M' },
    N: { label: 'Libur Nasional', color: '#ea580c', bg: '#fff7ed', short: 'N' },
    A: { label: 'Alpa', color: '#dc2626', bg: '#fecaca', short: 'A' },
    L: { label: 'Libur', color: '#ea580c', bg: '#fff7ed', short: 'L' },
    '-': { label: 'No Data', color: '#d1d5db', bg: '#f9fafb', short: '-' }
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Helper: format currency
const fmtCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '-'
    return new Intl.NumberFormat('id-ID', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
}

export default function GangAttendanceMatrix({ token, gangCodes, month, year, division, includeFaceVerification = true }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [expandedGangs, setExpandedGangs] = useState(new Set())
    const [resolvedGangCodes, setResolvedGangCodes] = useState(null)
    const [payrollMap, setPayrollMap] = useState({}) // emp_code -> payroll detail
    const [showPayroll, setShowPayroll] = useState(true) // toggle detail uang

    // Fetch gangs independently when gangCodes is empty but division is provided
    useEffect(() => {
        if (gangCodes && gangCodes.length > 0) {
            setResolvedGangCodes(gangCodes)
            return
        }
        if (!division || !token) {
            setResolvedGangCodes([])
            return
        }

        let cancelled = false
        const loadGangs = async () => {
            try {
                const gangs = await fetchGangs(token, division, null, true)
                if (!cancelled && gangs && gangs.length > 0) {
                    setResolvedGangCodes(gangs.map(g => g.gang_code))
                } else {
                    setResolvedGangCodes([])
                }
            } catch (e) {
                console.error('[GangAttendanceMatrix] Failed to load gangs:', e)
                if (!cancelled) setResolvedGangCodes([])
            }
        }
        loadGangs()
        return () => { cancelled = true }
    }, [gangCodes, division, token])

    // Fetch payroll details from payroll_history_detail
    const fetchPayrollDetails = useCallback(async (gangCodesList) => {
        if (!gangCodesList || gangCodesList.length === 0 || !month || !year || !token) return
        try {
            const params = new URLSearchParams({
                month: String(month),
                year: String(year),
                gang_codes: gangCodesList.join(',')
            })
            const resp = await fetch(`${API}/payroll/gang-payroll-summary?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (resp.ok) {
                const json = await resp.json()
                if (json.data) {
                    const map = {}
                    for (const row of json.data) {
                        const key = (row.emp_code || '').trim().toUpperCase()
                        map[key] = row
                    }
                    setPayrollMap(map)
                }
            }
        } catch (e) {
            console.warn('[GangAttendanceMatrix] payroll detail fetch failed:', e)
        }
    }, [token, month, year])

    const fetchData = useCallback(async () => {
        const codes = resolvedGangCodes
        if (!codes || codes.length === 0 || !month || !year) return

        setLoading(true)
        setError(null)
        try {
            const result = await getGangAttendanceMatrix(token, codes, month, year, includeFaceVerification)
            setData(result)
            // DEBUG: Check for short days in fetched data
            if (result?.data) {
                for (const gang of result.data) {
                    for (const emp of gang.employees || []) {
                        const shortDays = Object.entries(emp.daily || {})
                            .filter(([_, d]) => d?.is_short)
                            .map(([day, d]) => `day${day}:${d.status},${d.hours}h,is_short=${d.is_short}`)
                        if (shortDays.length > 0) {
                            console.log(`[FRONTEND DEBUG] ${emp.emp_name} short days:`, shortDays.join(', '))
                        }
                    }
                }
            }
            // Auto-expand all gangs
            if (result?.data) {
                setExpandedGangs(new Set(result.data.map(g => g.gang_code)))
            }
            // Fetch payroll details in parallel
            fetchPayrollDetails(codes)
        } catch (err) {
            setError(err.message || 'Gagal memuat data matrix absensi')
        } finally {
            setLoading(false)
        }
    }, [token, resolvedGangCodes, month, year, includeFaceVerification, fetchPayrollDetails])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const toggleGang = (gangCode) => {
        setExpandedGangs(prev => {
            const next = new Set(prev)
            if (next.has(gangCode)) next.delete(gangCode)
            else next.add(gangCode)
            return next
        })
    }

    const handlePrint = () => {
        if (data?.data) {
            setExpandedGangs(new Set(data.data.map(g => g.gang_code)))
            setTimeout(() => {
                window.print()
            }, 500)
        }
    }

    if (!gangCodes || gangCodes.length === 0) {
        // Check if we're still resolving gangs
        if (resolvedGangCodes === null) {
            return (
                <div className="gam-inline-container">
                    <div className="gam-header">
                        <div className="gam-header-left">
                            <h2>📋 Matrix Absensi Gang</h2>
                            <span className="gam-period">{MONTHS[month - 1]} {year}</span>
                            {division && <span className="gam-division-badge">{division}</span>}
                        </div>
                    </div>
                    <div className="gam-loading">
                        <div className="gam-spinner" />
                        <p>Memuat daftar gang...</p>
                    </div>
                </div>
            )
        }
        return (
            <div className="gam-inline-container">
                <div className="gam-header">
                    <div className="gam-header-left">
                        <h2>📋 Matrix Absensi Gang</h2>
                        <span className="gam-period">{MONTHS[month - 1]} {year}</span>
                        {division && <span className="gam-division-badge">{division}</span>}
                    </div>
                </div>
                <div className="gam-empty-state">
                    <div className="gam-empty-icon">📊</div>
                    <h3>Matrix Absensi Belum Tersedia</h3>
                    <p>Data daftar upah sedang dimuat atau belum tersedia untuk periode ini. Matrix absensi akan muncul setelah data karyawan berhasil dimuat.</p>
                    <div className="gam-empty-hint">
                        <span>💡</span> Pastikan data payroll sudah digenerate untuk periode <strong>{MONTHS[month - 1]} {year}</strong>
                    </div>
                </div>
            </div>
        )
    }

    if (loading || resolvedGangCodes === null) {
        return (
            <div className="gam-inline-container">
                <div className="gam-header">
                    <div className="gam-header-left">
                        <h2>📋 Matrix Absensi Gang</h2>
                        <span className="gam-period">{MONTHS[month - 1]} {year}</span>
                        {division && <span className="gam-division-badge">{division}</span>}
                    </div>
                </div>
                <div className="gam-loading">
                    <div className="gam-spinner" />
                    <p>{resolvedGangCodes === null ? 'Memuat daftar gang...' : 'Memuat matrix absensi dari data historis...'}</p>
                    {resolvedGangCodes !== null && <span className="gam-loading-detail">Mengambil data {resolvedGangCodes.length} gang...</span>}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="gam-inline-container">
                <div className="gam-header">
                    <div className="gam-header-left">
                        <h2>📋 Matrix Absensi Gang</h2>
                        <span className="gam-period">{MONTHS[month - 1]} {year}</span>
                        {division && <span className="gam-division-badge">{division}</span>}
                    </div>
                </div>
                <div className="gam-error">
                    <div className="gam-error-icon">⚠️</div>
                    <p>{error}</p>
                    <button onClick={fetchData} className="gam-retry-btn">🔄 Coba Lagi</button>
                </div>
            </div>
        )
    }

    const gangs = data?.data || []
    const meta = data?.meta || {}

    return (
        <div className="gam-inline-container">
            {/* Header */}
            <div className="gam-header">
                <div className="gam-header-left">
                    <h2>📋 Matrix Absensi Gang</h2>
                    <span className="gam-period">{MONTHS[month - 1]} {year}</span>
                    <span className="gam-source-badge">📂 Data Historis (extend_db)</span>
                </div>
                <div className="gam-header-right">
                    <button
                        onClick={() => setShowPayroll(!showPayroll)}
                        className="gam-toggle-payroll-btn"
                        title={showPayroll ? 'Sembunyikan Detail Uang' : 'Tampilkan Detail Uang'}
                    >
                        💰 {showPayroll ? 'Sembunyikan Uang' : 'Detail Uang'}
                    </button>
                    <button onClick={handlePrint} className="gam-print-btn" title="Cetak Matrix Absensi">
                        🖨️ Print
                    </button>
                    {meta.execution_time_ms && (
                        <span className="gam-meta">{meta.total_employees} karyawan • {meta.execution_time_ms}ms</span>
                    )}
                </div>
            </div>

            {/* Legend */}
                <div className="gam-legend">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <span key={key} className="gam-legend-item" style={{ background: cfg.bg, color: cfg.color }}>
                            <strong>{cfg.short}</strong> {cfg.label}
                        </span>
                    ))}
                    {includeFaceVerification && (
                        <>
                            <span className="gam-legend-divider" />
                            <span className="gam-face-legend-item" style={{ color: '#059669', background: '#d1fae5' }}>
                                <strong>V</strong> Face OK
                            </span>
                            <span className="gam-face-legend-item" style={{ color: '#dc2626', background: '#fef2f2' }}>
                                <strong>X</strong> No Face
                            </span>
                        </>
                    )}
                </div>

                {/* Content */}
                <div className="gam-content">
                    {gangs.length === 0 ? (
                        <div className="gam-empty">Tidak ada data absensi untuk gang yang dipilih pada periode ini. Pastikan data sudah di-seed ke database historis.</div>
                    ) : (
                        gangs.map(gang => {
                            const isExpanded = expandedGangs.has(gang.gang_code)
                            const days = Array.from({ length: gang.days_in_month }, (_, i) => i + 1)

                            return (
                                <div key={gang.gang_code} className="gam-gang-section">
                                    {/* Gang header */}
                                    <div className="gam-gang-header" onClick={() => toggleGang(gang.gang_code)}>
                                        <span className="gam-toggle-icon">{isExpanded ? '▼' : '▶'}</span>
                                        <strong>{gang.gang_code}</strong>
                                        <span className="gam-gang-desc">{gang.gang_description}</span>
                                        <span className="gam-gang-count">{gang.employees.length} karyawan</span>
                                    </div>

                                    {isExpanded && (
                                        <div className="gam-table-wrapper">
                                            <table className="gam-table">
                                                <thead>
                                                    <tr>
                                                        <th className="gam-th-no">No</th>
                                                        <th className="gam-th-empcode">EmpCode</th>
                                                        <th className="gam-th-name">Nama</th>
                                                        <th className="gam-th-nik">NIK</th>
                                                        {days.map(d => {
                                                            const isSunday = gang.sundays?.includes(d)
                                                            const isHoliday = gang.holidays?.[d]
                                                            return (
                                                                <th key={d}
                                                                    className={`gam-th-day ${isSunday ? 'gam-sunday' : ''} ${isHoliday ? 'gam-holiday' : ''}`}
                                                                    title={isHoliday || (isSunday ? 'Minggu' : `Tanggal ${d}`)}
                                                                >
                                                                    {d}
                                                                </th>
                                                            )
                                                        })}
                                                        <th className="gam-th-sum" title="Hadir">H</th>
                                                        <th className="gam-th-sum" title="Cuti">C</th>
                                                        <th className="gam-th-sum" title="Sakit">S</th>
                                                        <th className="gam-th-sum" title="Alpa">A</th>
                                                        <th className="gam-th-sum" title="Total HK">HK</th>
                                                        {showPayroll && (
                                                            <>
                                                                <th className="gam-th-money" title="Upah Kotor">Upah Kotor</th>
                                                                <th className="gam-th-money gam-th-koreksi" title="Koreksi HK">Koreksi</th>
                                                                <th className="gam-th-money gam-th-koreksi" title="Potongan Koreksi">Pot. Koreksi</th>
                                                                <th className="gam-th-money" title="PPh21">PPh21</th>
                                                                <th className="gam-th-money gam-th-upah-bersih" title="Upah Bersih">Upah Bersih</th>
                                                            </>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gang.employees.map((emp, idx) => {
                                                        const empKey = (emp.emp_code || '').trim().toUpperCase()
                                                        const payroll = payrollMap[empKey]
                                                        const hasKoreksi = payroll && (Number(payroll.koreksi_hk) !== 0 || Number(payroll.pot_koreksi) !== 0)
                                                        return (
                                                        <tr key={emp.emp_code} className={hasKoreksi ? 'gam-row-koreksi' : ''}>
                                                            <td className="gam-td-no">{idx + 1}</td>
                                                            <td className="gam-td-empcode" title={`Rekening: ${emp.bank_acc_no || '-'}`}>
                                                                {emp.emp_code}
                                                            </td>
                                                            <td className="gam-td-name" title={`${emp.emp_name} (${emp.emp_code})`}>
                                                                {emp.emp_name}
                                                                {hasKoreksi && <span className="gam-koreksi-badge" title="Ada Koreksi">⚠️</span>}
                                                            </td>
                                                            <td className="gam-td-nik">{emp.new_nik || emp.nik || '-'}</td>
                                                            {days.map(d => {
                                                                const dayData = emp.daily?.[d]
                                                                const status = dayData?.status || '-'
                                                                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['-']
                                                                const faceVerif = emp.face_verification?.[d]
                                                                const hasFaceData = faceVerif !== undefined
                                                                const faceOk = faceVerif === true
                                                                const isShort = dayData?.is_short
                                                                // Symbol for kurang jam
                                                                const shortSymbol = isShort ? ' ▼' : ''
                                                                return (
                                                                    <td key={d}
                                                                        className={`gam-td-cell ${hasFaceData ? (faceOk ? 'gam-cell-face-ok' : 'gam-cell-face-no') : ''}`}
                                                                        style={{ background: cfg.bg, color: cfg.color }}
                                                                        title={`${emp.emp_name} - Tgl ${d}: ${cfg.label}${hasFaceData ? (faceOk ? ' [FACE OK]' : ' [NO FACE]') : ''}${dayData?.hours ? ` (${dayData.hours} jam)` : ''}${dayData?.amount ? ` = Rp ${fmtCurrency(dayData.amount)}` : ''}${isShort ? ' ▼ KURANG JAM' : ''}`}
                                                                    >
                                                                        {hasFaceData && <span className={`gam-face-badge ${faceOk ? 'gam-face-badge-ok' : 'gam-face-badge-no'}`}>{faceOk ? 'V' : 'X'}</span>}
                                                                        <span className="gam-cell-status">{cfg.short}{shortSymbol}</span>
                                                                    </td>
                                                                )
                                                            })}
                                                            <td className="gam-td-sum gam-sum-hadir">{emp.summary?.hadir || 0}</td>
                                                            <td className="gam-td-sum gam-sum-cuti">{emp.summary?.cuti_tahunan || 0}</td>
                                                            <td className="gam-td-sum gam-sum-sakit">{emp.summary?.cuti_sakit || 0}</td>
                                                            <td className="gam-td-sum gam-sum-alpa">{emp.summary?.alpa || 0}</td>
                                                            <td className="gam-td-sum gam-sum-hk">{emp.summary?.total_hk || 0}</td>
                                                            {showPayroll && (
                                                                <>
                                                                    <td className="gam-td-money">{payroll ? fmtCurrency(payroll.jumlah_upah_kotor) : '-'}</td>
                                                                    <td className={`gam-td-money ${hasKoreksi ? 'gam-td-koreksi-val' : ''}`} title={payroll ? `Koreksi HK: ${payroll.koreksi_hk || 0}` : ''}>
                                                                        {payroll ? fmtCurrency(payroll.koreksi_hk) : '-'}
                                                                    </td>
                                                                    <td className={`gam-td-money ${hasKoreksi ? 'gam-td-koreksi-val' : ''}`} title={payroll ? `Pot Koreksi: ${payroll.pot_koreksi || 0}` : ''}>
                                                                        {payroll ? fmtCurrency(payroll.pot_koreksi) : '-'}
                                                                    </td>
                                                                    <td className="gam-td-money">{payroll ? fmtCurrency(payroll.pph21_ter) : '-'}</td>
                                                                    <td className="gam-td-money gam-td-upah-bersih">{payroll ? fmtCurrency(payroll.upah_bersih) : '-'}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                        )
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="gam-total-row">
                                                        <td colSpan={4} className="gam-td-total-label">TOTAL</td>
                                                        {days.map(d => {
                                                            const hadirCount = gang.employees.filter(e => e.daily?.[d]?.status === 'H').length
                                                            return (
                                                                <td key={d} className="gam-td-total" title={`${hadirCount} hadir pada tgl ${d}`}>
                                                                    {hadirCount || ''}
                                                                </td>
                                                            )
                                                        })}
                                                        <td className="gam-td-total">{gang.employees.reduce((s, e) => s + (e.summary?.hadir || 0), 0)}</td>
                                                        <td className="gam-td-total">{gang.employees.reduce((s, e) => s + (e.summary?.cuti_tahunan || 0), 0)}</td>
                                                        <td className="gam-td-total">{gang.employees.reduce((s, e) => s + (e.summary?.cuti_sakit || 0), 0)}</td>
                                                        <td className="gam-td-total">{gang.employees.reduce((s, e) => s + (e.summary?.alpa || 0), 0)}</td>
                                                        <td className="gam-td-total">{gang.employees.reduce((s, e) => s + (e.summary?.total_hk || 0), 0)}</td>
                                                        {showPayroll && (
                                                            <>
                                                                <td className="gam-td-total gam-td-money-total">
                                                                    {fmtCurrency(gang.employees.reduce((s, e) => {
                                                                        const p = payrollMap[(e.emp_code || '').trim().toUpperCase()]
                                                                        return s + (p ? (Number(p.jumlah_upah_kotor) || 0) : 0)
                                                                    }, 0))}
                                                                </td>
                                                                <td className="gam-td-total gam-td-money-total">
                                                                    {fmtCurrency(gang.employees.reduce((s, e) => {
                                                                        const p = payrollMap[(e.emp_code || '').trim().toUpperCase()]
                                                                        return s + (p ? (Number(p.koreksi_hk) || 0) : 0)
                                                                    }, 0))}
                                                                </td>
                                                                <td className="gam-td-total gam-td-money-total">
                                                                    {fmtCurrency(gang.employees.reduce((s, e) => {
                                                                        const p = payrollMap[(e.emp_code || '').trim().toUpperCase()]
                                                                        return s + (p ? (Number(p.pot_koreksi) || 0) : 0)
                                                                    }, 0))}
                                                                </td>
                                                                <td className="gam-td-total gam-td-money-total">
                                                                    {fmtCurrency(gang.employees.reduce((s, e) => {
                                                                        const p = payrollMap[(e.emp_code || '').trim().toUpperCase()]
                                                                        return s + (p ? (Number(p.pph21_ter) || 0) : 0)
                                                                    }, 0))}
                                                                </td>
                                                                <td className="gam-td-total gam-td-money-total gam-td-upah-bersih">
                                                                    {fmtCurrency(gang.employees.reduce((s, e) => {
                                                                        const p = payrollMap[(e.emp_code || '').trim().toUpperCase()]
                                                                        return s + (p ? (Number(p.upah_bersih) || 0) : 0)
                                                                    }, 0))}
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

            <style>{`
                .gam-inline-container {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    width: 100%;
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    overflow-x: auto;
                    overflow-y: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .gam-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e5e7eb;
                    background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
                }
                .gam-header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .gam-header-left h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 700;
                    color: #111827;
                }
                .gam-period {
                    background: #15803d;
                    color: #fff;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .gam-source-badge {
                    background: #eff6ff;
                    color: #1d4ed8;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                }
                .gam-division-badge {
                    background: #fef3c7;
                    color: #92400e;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    border: 1px solid #fcd34d;
                }
                .gam-header-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .gam-meta {
                    font-size: 11px;
                    color: #9ca3af;
                }
                .gam-legend {
                    display: flex;
                    gap: 8px;
                    padding: 8px 20px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #f3f4f6;
                    background: #fafafa;
                }
                .gam-legend-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 500;
                }
                .gam-face-legend-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .gam-legend-divider {
                    width: 1px;
                    height: 16px;
                    background: #d1d5db;
                    margin: 0 4px;
                }
                .gam-face-badge {
                    font-size: 8px;
                    font-weight: 800;
                    margin-right: 1px;
                    line-height: 1;
                }
                .gam-face-badge-ok { color: #059669; }
                .gam-face-badge-no { color: #dc2626; }
                .gam-cell-status { font-weight: 600; font-size: 10px; }
                .gam-td-cell {
                    min-width: 32px;
                    width: 32px;
                    max-width: 32px;
                    padding: 2px;
                    text-align: center;
                }
                tbody tr:nth-child(even) .gam-td-no,
                tbody tr:nth-child(even) .gam-td-empcode,
                tbody tr:nth-child(even) .gam-td-name,
                tbody tr:nth-child(even) .gam-td-nik {
                    background: #fafafa;
                }
                .gam-content {
                    overflow-y: auto;
                    flex: 1;
                    padding: 12px 20px 80px; /* Added bottom padding for scroll space */
                }
                .gam-gang-section {
                    margin-bottom: 24px; /* Increased spacing */
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .gam-gang-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, #f9fafb, #f3f4f6);
                    cursor: pointer;
                    user-select: none;
                    transition: background 0.15s;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    border-bottom: 1px solid #e5e7eb;
                }
                .gam-gang-header:hover {
                    background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
                }
                .gam-toggle-icon {
                    font-size: 10px;
                    color: #6b7280;
                    width: 14px;
                }
                .gam-gang-desc {
                    color: #6b7280;
                    font-size: 13px;
                    flex: 1;
                }
                .gam-gang-count {
                    background: #dbeafe;
                    color: #1d4ed8;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                }
                .gam-table-wrapper {
                    overflow-x: auto;
                    overflow-y: visible;
                    width: 100%;
                }
                .gam-table {
                    width: max-content;
                    min-width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                    white-space: nowrap;
                }
                .gam-table thead th {
                    position: sticky;
                    top: 0;
                    background: #f9fafb;
                    border-bottom: 2px solid #e5e7eb;
                    padding: 6px 3px;
                    text-align: center;
                    font-weight: 600;
                    color: #374151;
                    z-index: 2;
                }
                .gam-th-no {
                    width: 30px;
                    min-width: 30px;
                    position: sticky;
                    left: 0;
                    z-index: 3 !important;
                    background: #f9fafb !important;
                }
                .gam-th-empcode {
                    min-width: 80px;
                    max-width: 100px;
                    text-align: left !important;
                    padding-left: 6px !important;
                    position: sticky;
                    left: 30px;
                    z-index: 3 !important;
                    background: #f9fafb !important;
                }
                .gam-th-name {
                    min-width: 140px;
                    max-width: 180px;
                    text-align: left !important;
                    padding-left: 8px !important;
                    position: sticky;
                    left: 110px;
                    z-index: 3 !important;
                    background: #f9fafb !important;
                }
                .gam-th-nik {
                    min-width: 120px;
                    max-width: 140px;
                    text-align: left !important;
                    padding-left: 6px !important;
                    position: sticky;
                    left: 250px;
                    z-index: 3 !important;
                    background: #f9fafb !important;
                }
                .gam-th-day {
                    min-width: 32px;
                    width: 32px;
                    max-width: 32px;
                    text-align: center;
                    padding: 4px 2px;
                }
                .gam-th-sum {
                    min-width: 30px;
                    background: #f0fdf4 !important;
                    color: #15803d !important;
                }
                .gam-sunday {
                    background: #fef2f2 !important;
                    color: #dc2626 !important;
                }
                .gam-holiday {
                    background: #fff7ed !important;
                    color: #ea580c !important;
                }
                .gam-td-no {
                    text-align: center;
                    color: #9ca3af;
                    position: sticky;
                    left: 0;
                    background: #fff;
                    z-index: 1;
                    border-right: 1px solid #f3f4f6;
                }
                .gam-td-empcode {
                    padding: 4px 6px;
                    font-weight: 600;
                    color: #1d4ed8;
                    font-size: 10px;
                    position: sticky;
                    left: 30px;
                    background: #fff;
                    z-index: 1;
                    border-right: 1px solid #f3f4f6;
                    max-width: 100px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .gam-td-name {
                    padding: 4px 8px;
                    font-weight: 500;
                    color: #111827;
                    position: sticky;
                    left: 110px;
                    background: #fff;
                    z-index: 1;
                    border-right: 1px solid #f3f4f6;
                    max-width: 180px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .gam-td-nik {
                    padding: 4px 6px;
                    font-size: 10px;
                    color: #6b7280;
                    position: sticky;
                    left: 250px;
                    background: #fff;
                    z-index: 1;
                    border-right: 1px solid #e5e7eb;
                    max-width: 140px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .gam-td-cell {
                    text-align: center;
                    padding: 3px 2px;
                    font-weight: 600;
                    font-size: 10px;
                    border: 1px solid #f3f4f6;
                    cursor: default;
                    transition: transform 0.1s;
                    min-width: 32px;
                    max-width: 32px;
                }
                .gam-td-cell:hover {
                    transform: scale(1.3);
                    z-index: 5;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    border-radius: 3px;
                }
                .gam-td-sum {
                    text-align: center;
                    font-weight: 700;
                    padding: 3px 4px;
                    border-left: 1px solid #e5e7eb;
                }
                .gam-sum-hadir { color: #15803d; background: #f0fdf4; }
                .gam-sum-cuti { color: #9333ea; background: #faf5ff; }
                .gam-sum-sakit { color: #dc2626; background: #fef2f2; }
                .gam-sum-alpa { color: #dc2626; background: #fecaca; font-weight: 800; }
                .gam-sum-hk { color: #1d4ed8; background: #eff6ff; font-weight: 800; }
                /* Money columns */
                .gam-th-money {
                    min-width: 90px;
                    max-width: 120px;
                    background: #fefce8 !important;
                    color: #854d0e !important;
                    font-size: 9px !important;
                    white-space: nowrap;
                }
                .gam-th-koreksi {
                    background: #fff1f2 !important;
                    color: #dc2626 !important;
                }
                .gam-th-upah-bersih {
                    background: #ecfdf5 !important;
                    color: #15803d !important;
                }
                .gam-td-money {
                    text-align: right;
                    font-size: 10px;
                    font-weight: 600;
                    padding: 3px 6px;
                    color: #475569;
                    white-space: nowrap;
                    border-left: 1px solid #e5e7eb;
                }
                .gam-td-koreksi-val {
                    color: #dc2626 !important;
                    font-weight: 700;
                    background: #fff1f2;
                }
                .gam-td-upah-bersih {
                    color: #15803d !important;
                    font-weight: 700;
                    background: #f0fdf4;
                }
                .gam-td-money-total {
                    text-align: right;
                    font-size: 10px;
                    padding: 3px 6px;
                    white-space: nowrap;
                }
                .gam-row-koreksi {
                    background: #fffbeb !important;
                }
                .gam-row-koreksi .gam-td-no,
                .gam-row-koreksi .gam-td-empcode,
                .gam-row-koreksi .gam-td-name,
                .gam-row-koreksi .gam-td-nik {
                    background: #fffbeb !important;
                }
                .gam-koreksi-badge {
                    margin-left: 4px;
                    font-size: 10px;
                }
                .gam-toggle-payroll-btn {
                    padding: 6px 12px;
                    background: #fefce8;
                    border: 1px solid #fde68a;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #854d0e;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    transition: all 0.2s;
                }
                .gam-toggle-payroll-btn:hover {
                    background: #fef3c7;
                    border-color: #f59e0b;
                }
                .gam-total-row td {
                    background: #f0fdf4 !important;
                    font-weight: 700;
                    color: #15803d;
                    border-top: 2px solid #86efac;
                }
                .gam-td-total-label {
                    text-align: center;
                    font-size: 12px;
                    position: sticky;
                    left: 0;
                    z-index: 1;
                }
                .gam-td-total {
                    text-align: center;
                    font-size: 10px;
                }
                .gam-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 48px;
                }
                .gam-spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid #e5e7eb;
                    border-top-color: #15803d;
                    border-radius: 50%;
                    animation: gam-spin 0.7s linear infinite;
                }
                @keyframes gam-spin {
                    to { transform: rotate(360deg); }
                }
                .gam-error {
                    padding: 32px;
                    text-align: center;
                    color: #dc2626;
                }
                .gam-retry-btn {
                    margin-top: 12px;
                    padding: 8px 16px;
                    background: #dc2626;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .gam-retry-btn:hover {
                    background: #b91c1c;
                }
                .gam-empty {
                    padding: 32px;
                    text-align: center;
                    color: #9ca3af;
                    font-style: italic;
                }
                .gam-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 40px;
                    text-align: center;
                }
                .gam-empty-icon {
                    font-size: 64px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }
                .gam-empty-state h3 {
                    margin: 0 0 8px;
                    font-size: 18px;
                    font-weight: 700;
                    color: #374151;
                }
                .gam-empty-state p {
                    margin: 0 0 20px;
                    color: #6b7280;
                    font-size: 14px;
                    max-width: 450px;
                    line-height: 1.6;
                }
                .gam-empty-hint {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #fef3c7;
                    color: #92400e;
                    padding: 10px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    border: 1px solid #fcd34d;
                }
                .gam-error-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                }
                .gam-loading-detail {
                    font-size: 12px;
                    color: #9ca3af;
                    margin-top: 4px;
                }
                tbody tr:hover .gam-td-no,
                tbody tr:hover .gam-td-empcode,
                tbody tr:hover .gam-td-name,
                tbody tr:hover .gam-td-nik {
                    background: #f0fdf4 !important;
                }
                .gam-print-btn {
                    padding: 6px 12px;
                    background: #fff;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #374151;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    transition: all 0.2s;
                }
                .gam-print-btn:hover {
                    background: #f9fafb;
                    border-color: #9ca3af;
                }
                @media print {
                    @page {
                        size: landscape;
                        margin: 5mm;
                    }
                    body, html {
                       -webkit-print-color-adjust: exact !important;
                       print-color-adjust: exact !important;
                    }
                    .gam-inline-container {
                        width: 100%;
                        background: white;
                        border: none;
                        box-shadow: none;
                        margin: 0;
                        font-family: inherit;
                    }
                    .gam-content {
                        overflow: visible !important;
                        max-height: none !important;
                        padding: 0;
                    }
                    .gam-table-wrapper {
                        overflow: visible !important;
                        max-height: none !important;
                    }
                    /* FIT TABLE TO A4 LANDSCAPE */
                    .gam-table {
                        width: 100% !important;
                        font-size: 8px !important;
                        table-layout: auto !important;
                    }
                    .gam-table thead th {
                        position: static !important;
                        padding: 2px 1px !important;
                        font-size: 8px !important;
                    }
                    .gam-td-no, .gam-td-empcode, .gam-td-name, .gam-td-nik {
                        position: static !important;
                        background-color: transparent !important;
                    }
                    /* HIDE NIK ON PRINT TO SAVE SPACE */
                    .gam-th-nik, .gam-td-nik {
                        display: none !important;
                    }
                    /* MINIMIZE COLUMN WIDTHS AND PADDINGS */
                    .gam-th-no, .gam-td-no { min-width: 15px !important; width: 15px !important; font-size: 7px !important; }
                    .gam-th-empcode, .gam-td-empcode { min-width: 45px !important; max-width: 55px !important; font-size: 7px !important; padding: 1px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .gam-th-name, .gam-td-name { min-width: 80px !important; max-width: 110px !important; padding: 1px 2px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 8px !important; }
                    .gam-th-day, .gam-td-cell { min-width: 14px !important; width: 14px !important; padding: 1px 0 !important; font-size: 8px !important; display: table-cell !important; }
                    .gam-face-badge { display: none !important; }
                    .gam-cell-status { font-size: 8px !important; }
                    .gam-th-sum, .gam-td-sum { min-width: 16px !important; font-size: 8px !important; padding: 1px !important; }
                    /* Money columns in print */
                    .gam-th-money, .gam-td-money { min-width: 50px !important; max-width: 70px !important; font-size: 7px !important; padding: 1px 2px !important; }
                    .gam-koreksi-badge { display: none !important; }

                    .gam-print-btn, .gam-toggle-icon, .gam-toggle-payroll-btn {
                        display: none !important;
                    }
                    .gam-gang-header {
                        position: static !important;
                        page-break-after: avoid;
                        padding: 4px 8px !important;
                        font-size: 10px !important;
                    }
                    .gam-gang-section {
                        page-break-inside: avoid;
                        margin-bottom: 20px;
                        border: 1px solid #e5e7eb;
                    }
                    .gam-td-total-label {
                        position: static !important;
                        font-size: 9px !important;
                    }
                    .gam-td-total {
                        font-size: 8px !important;
                    }
                }
            `}</style>
        </div>
    )
}
