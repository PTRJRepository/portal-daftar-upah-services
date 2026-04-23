$path = "frontend/src/components/employee/EmployeeDetailPage.jsx"
$content = Get-Content -LiteralPath $path -Raw

$dailyReplacement = @"
                {/* Daily Activity Details List */}
                {attendanceList.length > 0 && (
                    <div className="matrix-card" style={{ marginTop: '1rem' }}>
                        <div className="matrix-header activity-panel-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <div>
                                <h3 style={{ color: '#0f172a', fontSize: '1rem' }}>Rincian Aktivitas Harian (Regular)</h3>
                                <div className="activity-panel-meta">
                                    <span>{attendanceList.length} baris</span>
                                    <span>{attendanceTotalHours} jam</span>
                                    <span>Rp {formatCurrency(attendanceTotalAmount)}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`activity-panel-toggle ${expandedPanels.attendanceDetails ? 'expanded' : ''}`}
                                onClick={() => togglePanel('attendanceDetails')}
                            >
                                {expandedPanels.attendanceDetails ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                            </button>
                        </div>
                        {expandedPanels.attendanceDetails && (
                            <div className="overtime-list" style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}>
                                <div className="overtime-summary-box">
                                    <table className="overtime-summary-table">
                                        <thead>
                                            <tr>
                                                <th>Tanggal</th>
                                                <th>Status</th>
                                                <th>Pekerjaan</th>
                                                <th style={{ textAlign: 'center' }}>Jam</th>
                                                <th style={{ textAlign: 'right' }}>Rate/Upah</th>
                                                <th style={{ textAlign: 'right' }}>Jumlah</th>
                                                <th style={{ textAlign: 'center' }}>HK</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceList.map((item, idx) => {
                                                const itemDate = item.date ? new Date(item.date) : null
                                                const itemDayOfWeek = itemDate ? itemDate.getDay() : -1
                                                const itemIsFriday = itemDayOfWeek === 5
                                                const itemIsSunday = itemDayOfWeek === 0
                                                const itemTargetHours = itemIsFriday ? 5 : 7
                                                const itemIsShort = item.hours > 0 && item.hours < itemTargetHours && !itemIsSunday && item.status === 'hadir'
                                                const itemIsExcess = item.hours > itemTargetHours && !itemIsSunday && item.status === 'hadir'

                                                let rowBg
                                                let hkStatusIcon = 'OK'
                                                if (itemIsShort) {
                                                    rowBg = '#fef2f2'
                                                    hkStatusIcon = '!'
                                                } else if (itemIsExcess) {
                                                    rowBg = '#fff7ed'
                                                    hkStatusIcon = '+'
                                                } else if (item.status !== 'hadir') {
                                                    hkStatusIcon = '-'
                                                }

                                                return (
                                                    <tr key={idx} style={{ backgroundColor: rowBg }}>
                                                        <td>
                                                            {item.date ? new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                                        </td>
                                                        <td>
                                                            <span className="legend-dot" style={{
                                                                display: 'inline-block',
                                                                width: '8px',
                                                                height: '8px',
                                                                borderRadius: '50%',
                                                                marginRight: '6px',
                                                                background: statusColors[item.status]?.bg || '#e5e7eb'
                                                            }}></span>
                                                            {statusColors[item.status]?.label === 'H' ? 'Hadir' : item.remarks || item.status}
                                                        </td>
                                                        <td>
                                                            {item.task_desc}
                                                            {item.task_code && <span style={{ color: '#94a3b8', fontSize: '0.8em', marginLeft: '4px' }}>({item.task_code})</span>}
                                                        </td>
                                                        <td style={{
                                                            textAlign: 'center',
                                                            fontWeight: (itemIsShort || itemIsExcess) ? 'bold' : 'normal',
                                                            color: itemIsShort ? '#dc2626' : (itemIsExcess ? '#ea580c' : undefined)
                                                        }}>
                                                            {item.hours > 0 ? item.hours : '-'}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#64748b' }}>
                                                            {item.rate > 0 ? formatCurrency(item.rate) : '-'}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                                            {item.amount > 0 ? formatCurrency(item.amount) : '-'}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>{hkStatusIcon}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
                                                <td colSpan="3">Total</td>
                                                <td style={{ textAlign: 'center' }}>{attendanceTotalHours}</td>
                                                <td></td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(attendanceTotalAmount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Overtime Matrix */}
"@

$content = [regex]::Replace($content, '(?s)\s*\{\/\* Daily Activity Details List.*?\n\s*\{\/\* Overtime Matrix \*\/\}', "`r`n" + $dailyReplacement)

$overtimeReplacement = @"
                    {/* Overtime List Detail - Per Transaksi */}
                    {overtimeList.length > 0 && (
                        <div className="overtime-list">
                            <div className="activity-panel-toolbar">
                                <h4>Rincian Lembur Per Transaksi</h4>
                                <button
                                    type="button"
                                    className={`activity-panel-toggle ${expandedPanels.overtimeDetails ? 'expanded' : ''}`}
                                    onClick={() => togglePanel('overtimeDetails')}
                                >
                                    {expandedPanels.overtimeDetails ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                                </button>
                            </div>

                            {expandedPanels.overtimeDetails && (
                                <div className="overtime-summary-box" style={{ contentVisibility: 'auto', containIntrinsicSize: '520px' }}>
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
                                            {overtimeList.map((trx, idx) => {
                                                const date = trx.date || trx.trx_date || '';
                                                const dayName = trx.day_name || trx.hari || '-';
                                                const dayType = trx.day_type || trx.tipe_hari || '-';
                                                const rawDayType = trx.raw_day_type || null;
                                                const taskCode = trx.task_code || trx.task_desc || 'Lain-lain';
                                                const hours = trx.hours || 0;
                                                const amount = trx.amount_formula || trx.amount || 0;
                                                const formattedDate = date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

                                                return (
                                                    <tr key={idx}>
                                                        <td>{formattedDate}</td>
                                                        <td>{dayName}</td>
                                                        <td>
                                                            <span className={`day-type-badge ${getDayTypeClass(dayType, rawDayType)}`}>
                                                                {formatDayType(dayType, rawDayType)}
                                                            </span>
                                                        </td>
                                                        <td>{taskCode}</td>
                                                        <td className="hours-cell">{hours}</td>
                                                        <td className="amount-cell">{formatCurrency(amount)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="overtime-total-summary">
                                <div className="summary-row">
                                    <span>Total Transaksi:</span>
                                    <strong>{overtimeList.length}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Total Jam:</span>
                                    <strong>{overtimeTotalHours}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Total Lembur:</span>
                                    <strong>{formatCurrency(overtimeTotalAmount)}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Harvest Matrix (Moved from action-buttons) */}
"@

$content = [regex]::Replace($content, '(?s)\s*\{\/\* Overtime List Detail - Per Transaksi \*\/\}.*?\n\s*\{\/\* Harvest Matrix \(Moved from action-buttons\) \*\/\}', "`r`n" + $overtimeReplacement)

$harvestReplacement = @"
                {/* Harvest Matrix (Moved from action-buttons) */}
                {harvestList.length > 0 && (
                    <div className="matrix-card">
                        <div className="matrix-header gradient-header-orange activity-panel-header">
                            <div>
                                <h3>Matriks Panen</h3>
                                <div className="activity-panel-meta">
                                    <span>{harvestList.length} transaksi</span>
                                    <span>{formatCurrency(harvestTotals.weight)} Kg</span>
                                    <span>{formatCurrency(harvestTotals.bunches)} Jjg</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`activity-panel-toggle ${expandedPanels.harvestDetails ? 'expanded' : ''}`}
                                onClick={() => togglePanel('harvestDetails')}
                            >
                                {expandedPanels.harvestDetails ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                            </button>
                        </div>

                        {expandedPanels.harvestDetails && (
                            <div className="overtime-list" style={{ contentVisibility: 'auto', containIntrinsicSize: '480px' }}>
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
                                            {harvestList.map((h, idx) => (
                                                <tr key={idx}>
                                                    <td>{new Date(h.TrxDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                                    <td>{h.GrpRef || '-'}</td>
                                                    <td>{h.ChargeTo || '-'}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: h.TotalWeight > 0 ? 'bold' : 'normal' }}>{formatCurrency(h.TotalWeight)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(h.TotalBunches)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatCurrency(h.Amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
                                                <td colSpan="3">Total</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(harvestTotals.weight)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(harvestTotals.bunches)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(harvestTotals.amount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* SALARY HISTORY SECTION */}
"@

$content = [regex]::Replace($content, '(?s)\s*\{\/\* Harvest Matrix \(Moved from action-buttons\) \*\/\}.*?\n\s*<\/div>\n\n\s*\{\/\* SALARY HISTORY SECTION \*\/\}', "`r`n" + $harvestReplacement)

Set-Content -LiteralPath $path -Value $content
